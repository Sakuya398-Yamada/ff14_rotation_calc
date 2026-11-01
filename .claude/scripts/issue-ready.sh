#!/usr/bin/env bash
# issue-ready.sh — open Issues that can be started now, Issues waiting on dependencies, and parent
# Issues, from the dependencies written both as GitHub's blocked-by relationship and as
# "依存: #N" lines in the Issue body (dependencies.md of the issue-start skill).
#
# Usage: issue-ready.sh [--json] [--repo OWNER/REPO]
#   --json   print JSON instead of the human-readable list
#   --repo   repository to read (default: gh resolves it from the current git remote)
#
# Needs only bash (3.2+) and gh: every JSON response is processed by gh's built-in jq
# (`gh api --jq`), so jq, node and python3 are not required. Only REST endpoints are used (the gh
# GraphQL commands are refused in Claude Code cloud sessions), and pages are fetched one by one
# instead of with --paginate (which stops at page 2 there).
#
# Issues labelled `meta` are left out. Issues with sub-issues are listed as parents. A dependency
# counts when either source has it; an Issue is blocked while any of its dependencies is open.
# A body line counts only when it starts with "依存:" (optionally as a list item; a full-width
# colon also counts), so prose that quotes 「依存: #N」 is not read as a dependency, and owner/repo#N
# on such a line is skipped. Differences between the two sources, and dependencies closed as
# not_planned / duplicate or not found, are reported as notes.

set -euo pipefail
set -f

json=0 repo='{owner}/{repo}'
while [[ $# -gt 0 ]]; do
  case "$1" in
    --json) json=1 ;;
    --repo) repo="${2:?--repo needs OWNER/REPO}"; shift ;;
    --repo=*) repo="${1#--repo=}" ;;
    -h|--help) sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "issue-ready: unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done
command -v gh >/dev/null 2>&1 || { echo "issue-ready: gh (GitHub CLI) is required" >&2; exit 1; }

US=$'\x1f' nl=$'\n'
full=$(gh api "repos/$repo" --jq .full_name)

# Indexed arrays keyed by Issue number (bash 3.2 has no associative arrays). "${a[@]+"${a[@]}"}"
# keeps an empty array from tripping `set -u` before bash 4.4.
nums=() title=() tjson=() labels=() meta=() sub_total=() sub_done=() rel_known=() rel_total=() body_deps=() is_open=()

# 1. Open Issues, 100 per page. Pull requests come back as "PR" lines so the page size still counts.
issue_jq='.[] | if .pull_request then "PR" else [
  (.number | tostring), .title, (.title | tojson), ([.labels[].name] | tojson),
  (any(.labels[]; .name == "meta") | tostring),
  ((.sub_issues_summary.total // 0) | tostring), ((.sub_issues_summary.completed // 0) | tostring),
  (.issue_dependencies_summary != null | tostring),
  ((.issue_dependencies_summary.total_blocked_by // 0) | tostring),
  ([(.body // "") | split("\n")[] | select(test("^[ \\t]*([-*][ \\t]+)?依存[:：]"))
    | sub("^[ \\t]*([-*][ \\t]+)?依存[:：]"; "") | scan("(?:^|[^A-Za-z0-9_/])#([0-9]+)") | .[0]]
    | map(tonumber) | unique | map(tostring) | join(" "))
] | join("\u001f") end'
page=1
while :; do
  out=$(gh api "repos/$repo/issues?state=open&per_page=100&page=$page" --jq "$issue_jq")
  count=0
  while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    count=$((count + 1))
    [[ "$line" != PR ]] || continue
    IFS="$US" read -r n t tj lb me st sd rk rt bd <<<"$line"
    nums+=("$n"); title[n]=$t; tjson[n]=$tj; labels[n]=$lb; meta[n]=$me
    sub_total[n]=$st; sub_done[n]=$sd; rel_known[n]=$rk; rel_total[n]=$rt; body_deps[n]=$bd; is_open[n]=1
  done <<<"$out"
  [[ $count -eq 100 ]] || break
  page=$((page + 1))
done
# The API lists the newest first; work in ascending order so every list comes out sorted.
sorted=$(printf '%s\n' ${nums[@]+"${nums[@]}"} | sort -n)
nums=()
for n in $sorted; do nums+=("$n"); done

# 2. blocked-by relationships, only for Issues that have any. Same-repository blockers go to
# rel_deps; open blockers in other repositories are kept as owner/repo#N.
rel_deps=() ext_open=() dep_state=() dep_reason=()
for n in ${nums[@]+"${nums[@]}"}; do
  [[ "${rel_total[n]}" != 0 ]] || continue
  rels=$(gh api "repos/$repo/issues/$n/dependencies/blocked_by?per_page=100" \
    --jq '.[] | [(.number | tostring), .state, (.state_reason // ""), (.repository_url | sub(".*/repos/"; ""))] | join("\u001f")')
  rd="" eo=""
  while IFS="$US" read -r m s r rr; do
    [[ -n "$m" ]] || continue
    if [[ "$rr" == "$full" ]]; then
      rd+="${rd:+ }$m"; dep_state[m]=$s; dep_reason[m]=$r
    elif [[ "$s" == open ]]; then
      eo+="${eo:+ }$rr#$m"
    fi
  done <<<"$rels"
  rel_deps[n]=$rd; ext_open[n]=$eo
done

# 3. State of each dependency: open Issues are known from step 1, blockers from step 2. Numbers
# only in a body and not open are fetched one by one; a number that does not exist is "missing".
dep_status() { # dep_status <n> -> sets dep_state[n] / dep_reason[n]
  local m="$1" r s rs
  [[ -z "${dep_state[m]:-}" ]] || return 0
  if [[ -n "${is_open[m]:-}" ]]; then dep_state[m]=open; dep_reason[m]=""; return 0; fi
  if r=$(gh api "repos/$repo/issues/$m" --jq '[.state, (.state_reason // "")] | join("\u001f")' 2>/dev/null); then
    IFS="$US" read -r s rs <<<"$r"
    dep_state[m]=$s; dep_reason[m]=$rs
  else
    dep_state[m]=missing; dep_reason[m]=""
  fi
}

in_list() { [[ " $2 " == *" $1 "* ]]; }
hashes() { local o="" x; for x in $1; do o+="${o:+ }#$x"; done; printf '%s' "${o:-なし}"; }

# 4. Classify. deps = body ∪ relationship; blocked while any is open. When the API has no
# dependency summary (e.g. a GitHub Enterprise Server without issue dependencies), only the body
# is used and the two sources are not compared.
status=() open_deps=() notes=() body_only=() rel_only=() blocking=() global_notes=""
for n in ${nums[@]+"${nums[@]}"}; do
  [[ "${meta[n]}" != true ]] || continue
  [[ "${rel_known[n]}" == true ]] ||
    global_notes="blocked by を API から読めない Issue がある（本文の「依存:」だけで判定した）"
  deps="${body_deps[n]}"
  for m in ${rel_deps[n]:-}; do in_list "$m" "$deps" || deps+="${deps:+ }$m"; done
  deps=$(printf '%s\n' $deps | sort -n)
  od="" nt="" bo="" ro=""
  for m in $deps; do
    [[ "$m" != "$n" ]] || continue
    dep_status "$m"
    case "${dep_state[m]}" in
      open) od+="${od:+ }$m" ;;
      missing) nt+="${nt:+$US}依存 #$m が見つからない" ;;
      *) case "${dep_reason[m]}" in
           not_planned|duplicate) nt+="${nt:+$US}依存 #$m は ${dep_reason[m]} で閉じている（依存した変更は入っていない）" ;;
         esac ;;
    esac
    [[ "${rel_known[n]}" == true ]] || continue
    in_list "$m" "${rel_deps[n]:-}" || bo+="${bo:+ }$m"
    in_list "$m" "${body_deps[n]}" || ro+="${ro:+ }$m"
  done
  [[ -z "$bo$ro" ]] ||
    nt+="${nt:+$US}本文だけにある依存: $(hashes "$bo") / blocked by だけにある依存: $(hashes "$ro")"
  open_deps[n]=$od; notes[n]=$nt; body_only[n]=$bo; rel_only[n]=$ro
  if [[ "${sub_total[n]}" != 0 ]]; then status[n]=parent
  elif [[ -n "$od" || -n "${ext_open[n]:-}" ]]; then status[n]=blocked
  else status[n]=ready; fi
done
for n in ${nums[@]+"${nums[@]}"}; do
  [[ -n "${status[n]:-}" ]] || continue
  for m in ${open_deps[n]}; do blocking[m]="${blocking[m]:-}${blocking[m]:+ }$n"; done
done

numarr() { local o="" x; for x in $1; do o+="${o:+,}$x"; done; printf '[%s]' "$o"; }
strarr() { local o="" x IFS="$2"; for x in $1; do o+="${o:+,}\"$x\""; done; printf '[%s]' "$o"; }

if [[ $json == 1 ]]; then
  printf '{"repo":"%s","notes":%s,"issues":[' "$full" "$(strarr "$global_notes" "$US")"
  first=1
  for n in ${nums[@]+"${nums[@]}"}; do
    [[ -n "${status[n]:-}" ]] || continue
    [[ $first == 1 ]] || printf ','
    first=0
    printf '{"number":%s,"title":%s,"status":"%s","labels":%s,"blocked_by":%s,"external_blocked_by":%s,"blocking":%s,"body_only":%s,"relation_only":%s,"sub_issues":{"total":%s,"completed":%s},"notes":%s}' \
      "$n" "${tjson[n]}" "${status[n]}" "${labels[n]}" "$(numarr "${open_deps[n]}")" \
      "$(strarr "${ext_open[n]:-}" ' ')" "$(numarr "${blocking[n]:-}")" "$(numarr "${body_only[n]}")" \
      "$(numarr "${rel_only[n]}")" "${sub_total[n]}" "${sub_done[n]}" "$(strarr "${notes[n]}" "$US")"
  done
  printf ']}\n'
  exit 0
fi

count_words() { local c=0 x; for x in $1; do c=$((c + 1)); done; printf '%s' "$c"; }
section() { # section <heading> <lines>
  local c=0
  [[ -z "$2" ]] || c=$(printf '%s\n' "$2" | grep -c .)
  printf '## %s (%s)\n' "$1" "$c"
  [[ -z "$2" ]] || printf '%s\n' "$2"
}
ready="" blocked="" parents="" notes_out=""
[[ -z "$global_notes" ]] || notes_out="0	- $global_notes"$'\n'
for n in ${nums[@]+"${nums[@]}"}; do
  b="${blocking[n]:-}" bl=""
  [[ -z "$b" ]] || bl="塞いでいる: $(hashes "$b")"
  case "${status[n]:-}" in
    ready)
      ready+="$(count_words "$b")	$n	- #$n ${title[n]}${bl:+（$bl）}"$'\n' ;;
    blocked)
      w="${open_deps[n]:+$(hashes "${open_deps[n]}")}"
      [[ -z "${ext_open[n]:-}" ]] || w+="${w:+ }${ext_open[n]}"
      blocked+="$n	- #$n ${title[n]} ← $w${bl:+（$bl）}"$'\n' ;;
    parent)
      parents+="$n	- #$n ${title[n]}（sub-issue ${sub_done[n]}/${sub_total[n]} 完了${bl:+、$bl}）"$'\n' ;;
    *) continue ;;
  esac
  if [[ -n "${notes[n]}" ]]; then
    while IFS= read -r x; do notes_out+="$n	- #$n: $x"$'\n'; done <<<"${notes[n]//$US/$nl}"
  fi
done
section "着手できる" "$(printf '%s' "$ready" | sort -t $'\t' -k1,1nr -k2,2n | cut -f3-)"
section "依存待ち" "$(printf '%s' "$blocked" | sort -t $'\t' -k1,1n | cut -f2-)"
section "親（子の完了待ち）" "$(printf '%s' "$parents" | sort -t $'\t' -k1,1n | cut -f2-)"
section "注意" "$(printf '%s' "$notes_out" | sort -s -t $'\t' -k1,1n | cut -f2-)"
