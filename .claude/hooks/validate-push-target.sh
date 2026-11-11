#!/usr/bin/env bash
# Pre-tool-use hook — direct push to the default branch guardrail.
#
# Changes reach the default branch only through a pull request that a person merges (CLAUDE.md
# 「開発フロー」5). settings.json allows `git push` / `git push origin *` / `git push -u origin *`
# without a prompt so that Issue branches can be pushed, and a permission deny only matches the
# command text: it stops `git push origin main`, but not `git push` while on main or
# `git -C . push origin main`. This hook works out which remote branches each `git push` writes
# and blocks it (exit 2) when one of them is protected:
#   main, master, and the branch refs/remotes/<remote>/HEAD points to (when it is set)
#
# Destination of each push:
#   <src>:<dst>, :<dst>, +...   <dst> (refs/heads/ and heads/ are stripped; other refs/* are not branches)
#   <name>                      <name>; HEAD and @ are the current branch
#   a * pattern                 blocked when it matches a protected branch
#   : (the matching refspec)    blocked when a protected branch exists locally
#   -d / --delete <name>...     each <name>
#   --tags, tag <name> alone    tags only: no branch is pushed
#   no refspec                  by push.default (git config, or `git -c push.default=...` in the command):
#                               upstream / tracking -> the upstream branch, nothing -> none,
#                               matching -> blocked when a protected branch exists locally,
#                               current / simple (the default) -> the current branch
#   --all / --branches          blocked when a protected branch exists locally
#   --mirror                    always blocked
# The current branch and its upstream are read in the payload's cwd (or CLAUDE_PROJECT_DIR), after
# any `git -C <dir>`; a `cd` earlier in the command is not followed (that holds for HEAD and @ too).
# A refspec, or a -C directory needed to read the current branch, built from a variable or a command
# substitution cannot be checked and is blocked. `git` counts at a command position: the start, after
# ; & | ( ` $( or a newline, also behind env / timeout / nice ... with their options, VAR=value and a
# path. Text in quotes and heredoc bodies is skipped, except the `...` and $(...) that run in it.
#
# Not covered, because the hook does not run what the command runs: a push inside a string handed to
# another shell (`sh -c '...'`, `bash -c`), a git alias, a script or a make target that pushes, a
# prefix whose option takes a word (`sudo -u <user> git push`), remote.<name>.push refspecs. GitHub
# branch protection stops those too (the template's docs/customization.md "settings.json の権限").
#
# Works under two hosts (the payload arrives as JSON on stdin), like the other validate-* hooks:
#   {"tool_name":"Bash","tool_input":{"command":"..."},"cwd":"..."}  or  {"toolName":"bash","toolArgs":...}
# Exit 2 denies the tool call (Claude Code feeds stderr back to Claude). Exit 0 allows it. JSON is
# parsed with jq, node or python3, whichever exists; with none of them the call is denied. If the
# hook itself crashes or times out, Claude Code blocks the call through "onFailure": "block".

set -euo pipefail

DOC=".claude/rules/git-conventions.md"

input=$(cat)

# Fast path: skip the JSON parse unless the payload can contain a git push.
case "$input" in
  *push*) ;;
  *) exit 0 ;;
esac

extract() { # extract <command|cwd>  — reads the hook payload from stdin
  local field="$1"
  if command -v jq >/dev/null 2>&1; then
    jq -r --arg f "$field" '
      def args: (.toolArgs // {}) | if type == "string" then (fromjson? // {}) else . end;
      if $f == "command" then (.tool_input.command // (args | .command) // "") else (.cwd // "") end'
  elif command -v node >/dev/null 2>&1; then
    node -e '
      let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
        try {
          const j = JSON.parse(s); const f = process.argv[1];
          if (f === "cwd") { process.stdout.write(j.cwd || ""); return; }
          let a = j.toolArgs; if (typeof a === "string") { try { a = JSON.parse(a); } catch (e) { a = {}; } }
          process.stdout.write((j.tool_input && j.tool_input.command) || (a && a.command) || "");
        } catch (e) {}
      });' "$field"
  elif command -v python3 >/dev/null 2>&1; then
    python3 -I -c '
import json, sys
try:
    j = json.load(sys.stdin); f = sys.argv[1]
    if f == "cwd":
        sys.stdout.write(j.get("cwd") or "")
    else:
        a = j.get("toolArgs") or {}
        if isinstance(a, str):
            try:
                a = json.loads(a)
            except Exception:
                a = {}
        sys.stdout.write((j.get("tool_input") or {}).get("command") or (a or {}).get("command") or "")
except Exception:
    pass' "$field"
  else
    return 1
  fi
}

deny() { # deny <message> — blocks the tool call and reports the reason on both hosts
  local msg="$1"
  if command -v jq >/dev/null 2>&1; then
    jq -cn --arg m "$msg" '{permissionDecision: "deny", permissionDecisionReason: $m}'
  fi
  printf '%s\n' "$msg" >&2
  exit 2
}

if ! cmd=$(printf '%s' "$input" | extract command); then
  deny "[hook:validate-push-target] No JSON parser found (install jq, node or python3), so the push destination cannot be checked. The command is blocked instead of being let through unchecked."
fi
cwd=$(printf '%s' "$input" | extract cwd || true)
cwd=${cwd:-${CLAUDE_PROJECT_DIR:-$PWD}}
export LC_ALL=C # byte offsets: the scanner (awk) and the slices below (bash) must count the same way

NL=$'\n'

# The scanner: prints the byte offset (0-based) right after each `git ` at a command position whose
# simple command has a `push` word. It follows single and double quotes, `...`, $(...), heredocs
# (quoted bodies are text; unquoted bodies are text apart from their `...` and $(...)) and comments.
SCAN=$(cat <<'AWK'
BEGIN {
  RS = "\001"
  W = "[^ \t\n;&|()`\"']"
  P = "(" W "*/)?(sudo|nohup|command|exec|env|xargs|nice|timeout|stdbuf|ionice|time|if|then|do|else|elif|while|until|!|[{])"
  OPTS = "([ \t]+(-" W "*|[0-9]" W "*))*"
  ASSIGN = "[A-Za-z_][A-Za-z0-9_]*=" W "*"
  RE = "^((" P OPTS "|" ASSIGN ")[ \t]+)*[\"']?(" W "*/|\\\\)?git[\"']?([ \t]|$)"
}
{ s = (NR == 1 ? $0 : s RS $0) }
# Characters are read from ch[], split once: substr() on the whole text is O(n) per call in some awks.
function try(i,   w, j, r) {
  w = ""
  for (j = i; j <= n && j < i + 400 && ch[j] != "\n"; j++) w = w ch[j]
  if (!match(w, RE)) return
  r = substr(w, RLENGTH + 1)
  sub(/[;&|)`].*/, "", r)
  if (r ~ /(^|[ \t])push([ \t]|$)/) print i + RLENGTH - 1
}
function heredoc(i,   j, c, d, q, t) { # at "<<": queue the heredoc, return the index after its word
  j = i + 2; t = 0; d = ""; q = 0
  if (ch[j] == "-") { t = 1; j++ }
  while (ch[j] == " " || ch[j] == "\t") j++
  while (j <= n) {
    c = ch[j]
    if (index(" \t\n;&|()<>", c)) break
    if (c == "'" || c == "\"") { q = 1; j++; continue }
    if (c == "\\") { q = 1; d = d ch[j + 1]; j += 2; continue }
    d = d c; j++
  }
  if (d != "") { nh++; hd[nh] = d; hq[nh] = q; ht[nh] = t }
  return j
}
END {
  n = split(s, ch, ""); i = 1; st = "N"; cmd = 1; k = 0; nh = 0; cur = 0
  while (i <= n) {
    if (st == "B") { # at the start of a line of a heredoc body
      for (e = i; e <= n && ch[e] != "\n"; e++) ;
      t0 = i; if (ht[cur]) while (t0 < e && ch[t0] == "\t") t0++
      if (e - t0 == length(hd[cur]) && substr(s, t0, e - t0) == hd[cur]) {
        i = e + 1
        if (cur < nh) { cur++ } else { nh = 0; cur = 0; st = "N"; cmd = 1 }
        continue
      }
      if (hq[cur]) { i = e + 1; continue }
      st = "H"; continue
    }
    c = ch[i]
    if (st == "S") { if (c == "'") st = "N"; i++; continue }
    if (st == "D" || st == "H") {
      if (c == "\\") { i += 2; continue }
      if (st == "D" && c == "\"") { st = "N"; i++; continue }
      if (st == "H" && c == "\n") { st = "B"; i++; continue }
      if (c == "$" && ch[i + 1] == "(") { k++; fr[k] = st; ft[k] = "("; fd[k] = 0; st = "N"; cmd = 1; i += 2; continue }
      if (c == "`") { k++; fr[k] = st; ft[k] = "`"; st = "N"; cmd = 1; i++; continue }
      i++; continue
    }
    # st == "N": shell words
    if (cmd && c != " " && c != "\t") { try(i); cmd = 0 }
    if (c == "\\") { i += 2; continue }
    if (c == "'") { st = "S" }
    else if (c == "\"") { st = "D" }
    else if (c == "`") {
      if (k > 0 && ft[k] == "`") { st = fr[k]; k-- }
      else { k++; fr[k] = "N"; ft[k] = "`"; cmd = 1 }
    }
    else if (c == "$" && ch[i + 1] == "(") { k++; fr[k] = "N"; ft[k] = "("; fd[k] = 0; cmd = 1; i += 2; continue }
    else if (c == "(") { if (k > 0) fd[k]++; cmd = 1 }
    else if (c == ")") { if (k > 0 && ft[k] == "(") { if (fd[k] > 0) fd[k]--; else { st = fr[k]; k-- } } }
    else if (c == ";" || c == "&" || c == "|") { cmd = 1 }
    else if (c == "\n") { cmd = 1; if (nh > 0 && cur == 0) { cur = 1; st = "B" } }
    else if (c == "#" && (i == 1 || index(" \t\n;&|()", ch[i - 1]))) {
      while (i <= n && ch[i] != "\n") i++
      continue
    }
    else if (c == "<" && ch[i + 1] == "<") {
      if (ch[i + 2] == "<") { i += 3; continue }
      i = heredoc(i); continue
    }
    i++
  }
}
AWK
)

# words <text> — splits the simple command at the start of <text> into shell words with the
# quotes removed, stopping at an unquoted ; & | ) ` or newline. WORDS gets the words; DYN[i] is 1
# when word i contains an expansion ($var, ${...}, $(...), `...`) the hook cannot evaluate.
words() {
  local s="$1" n=${#1} i=0 c nc w="" have=0 dyn=0 q=""
  WORDS=(); DYN=()
  while [[ $i -lt $n ]]; do
    c=${s:i:1}; nc=${s:i+1:1}
    if [[ "$q" == "'" ]]; then
      if [[ "$c" == "'" ]]; then q=""; else w+=$c; fi
    elif [[ "$q" == '"' ]]; then
      case "$c" in
        '"') q="" ;;
        \\) if [[ "$nc" == "$NL" ]]; then i=$((i + 1))
            elif [[ -n "$nc" && '"\$`' == *"$nc"* ]]; then w+=$nc; i=$((i + 1))
            else w+=$c; fi ;;
        '`') dyn=1; w+=$c ;;
        '$') if is_expansion "$nc"; then dyn=1; fi; w+=$c ;;
        *) w+=$c ;;
      esac
    else
      case "$c" in
        ' '|$'\t')
          if [[ $have == 1 ]]; then WORDS+=("$w"); DYN+=("$dyn"); w=""; have=0; dyn=0; fi
          i=$((i + 1)); continue ;;
        '&') if [[ "$w" == *[\<\>] || "$nc" == '>' ]]; then w+=$c; else break; fi ;;
        ';'|'|'|')'|'`'|"$NL") break ;;
        '#') if [[ $have == 0 ]]; then break; fi; w+=$c ;;
        "'"|'"') q=$c ;;
        \\)
          i=$((i + 2))
          if [[ "$nc" == "$NL" ]]; then continue; fi # line continuation: not part of any word
          w+=$nc; have=1; continue ;;
        '$') if is_expansion "$nc" || [[ "$nc" == "'" || "$nc" == '"' ]]; then dyn=1; fi; w+=$c ;;
        *) w+=$c ;;
      esac
    fi
    have=1; i=$((i + 1))
  done
  if [[ $have == 1 ]]; then WORDS+=("$w"); DYN+=("$dyn"); fi
}

is_expansion() { # is_expansion <char after $>
  [[ -n "$1" ]] && { [[ "$1" == [A-Za-z0-9_] ]] || [[ '{(@*#?!$-' == *"$1"* ]]; }
}

g() { git -C "$dir" "$@" 2>/dev/null; } # git in the directory the push runs in
matches_protected() { # matches_protected <branch or pattern> — prints the protected branch it names
  local p
  for p in "${protected[@]}"; do
    if [[ "$1" == *"*"* ]]; then
      # shellcheck disable=SC2053 # a refspec's * is a pattern
      [[ "$p" == $1 ]] && { echo "$p"; return 0; }
    elif [[ "$1" == "$p" ]]; then
      echo "$p"; return 0
    fi
  done
  return 1
}
protected_local() { # prints the first protected branch that exists locally
  local p
  for p in "${protected[@]}"; do g show-ref --verify --quiet "refs/heads/$p" && { echo "$p"; return 0; }; done
  return 1
}
redir_only='^([0-9]*|&)(>|>>|<|<<<|>&|<&)$' # a redirection whose target is the next word
redir='^([0-9]*|&)[<>]'                      # a redirection with its target attached

blocked() { # blocked <branch> <command words>
  deny "[hook:validate-push-target] This push writes to '$1', the default branch (protected here: ${protected[*]}).

  Changes reach the default branch only through a pull request that a person merges.
  Push the Issue branch instead:  git push -u origin <branch>
  Committed on the default branch by mistake? Keep the commits on an Issue branch first:
    git switch -c <type>/<issue>-<description>
  Blocked: $2
  See $DOC (自動検証)."
}

offsets=$(printf '%s' "$cmd" | awk "$SCAN")
for off in $offsets; do
  words "${cmd:off:8000}"

  # git's own options, up to the subcommand
  dir=$cwd dir_dyn=0 push_default="" j=0
  while [[ $j -lt ${#WORDS[@]} ]]; do
    w=${WORDS[j]}
    case "$w" in
      -C)
        j=$((j + 1)); d=${WORDS[j]:-}
        [[ ${DYN[j]:-0} == 1 ]] && dir_dyn=1
        case "$d" in
          \~) d=$HOME ;;
          \~/*) d="$HOME/${d#\~/}" ;;
        esac
        if [[ "$d" == /* ]]; then dir=$d; else dir="$dir/$d"; fi ;;
      -c)
        j=$((j + 1)); kv=${WORDS[j]:-}
        k=${kv%%=*}; k=$(printf '%s' "$k" | tr '[:upper:]' '[:lower:]')
        if [[ "$k" == "push.default" ]]; then push_default=${kv#*=}; fi ;;
      --git-dir|--work-tree|--namespace|--config-env|--super-prefix) j=$((j + 1)) ;;
      -*) ;;
      *) break ;;
    esac
    j=$((j + 1))
  done
  [[ "${WORDS[j]:-}" == "push" ]] || continue
  shown="git ${WORDS[*]}"

  # push's own options and arguments
  remote="" repo_opt="" refspecs=() refdyn=() all=0 mirror=0 delete=0 take=0 tag=0 tags=0 opts_done=0
  for ((j = j + 1; j < ${#WORDS[@]}; j++)); do
    w=${WORDS[j]}
    if [[ $take == 1 ]]; then take=0; continue; fi
    if [[ $tag == 1 ]]; then tag=0; continue; fi # `tag <name>` pushes refs/tags/<name>
    if [[ "$w" =~ $redir_only ]]; then take=1; continue; fi
    if [[ "$w" =~ $redir ]]; then continue; fi
    if [[ $opts_done == 0 && "$w" == "--" ]]; then opts_done=1; continue; fi
    if [[ $opts_done == 0 && "$w" == --?* ]]; then
      case "${w%%=*}" in
        --all|--branches) all=1 ;;
        --mirror) mirror=1 ;;
        --tags) tags=1 ;;
        --delete) delete=1 ;;
        --repo) if [[ "$w" == *=* ]]; then repo_opt=${w#*=}; else take=1; fi ;;
        --push-option|--receive-pack|--exec) [[ "$w" == *=* ]] || take=1 ;;
      esac
      continue
    fi
    if [[ $opts_done == 0 && "$w" == -?* ]]; then
      for ((c = 1; c < ${#w}; c++)); do # a cluster such as -ud; -o takes the rest or the next word
        case "${w:c:1}" in
          d) delete=1 ;;
          o) [[ $c -eq $((${#w} - 1)) ]] && take=1; break ;;
        esac
      done
      continue
    fi
    if [[ -z "$remote" ]]; then remote=$w; continue; fi
    if [[ "$w" == "tag" ]]; then tag=1; tags=1; continue; fi
    refspecs+=("$w"); refdyn+=("${DYN[j]}")
  done
  remote=${remote:-$repo_opt}

  cur=""
  if [[ $dir_dyn == 0 ]]; then cur=$(g symbolic-ref --quiet --short HEAD || true); fi
  if [[ -z "$remote" && -n "$cur" ]]; then
    remote=$(g config --get "branch.$cur.pushRemote" || g config --get remote.pushDefault || g config --get "branch.$cur.remote" || true)
  fi
  remote=${remote:-origin}
  protected=(main master)
  head=$(g symbolic-ref --quiet --short "refs/remotes/$remote/HEAD" || true)
  head=${head#"$remote"/}
  if [[ -n "$head" && "$head" != main && "$head" != master ]]; then protected+=("$head"); fi


  if [[ $mirror == 1 ]]; then blocked "${protected[0]}" "$shown"; fi
  if [[ $all == 1 ]]; then
    if p=$(protected_local); then blocked "$p" "$shown"; fi
    continue
  fi

  needs_cur=0
  [[ ${#refspecs[@]} -eq 0 ]] && needs_cur=1
  [[ ${#refspecs[@]} -eq 0 && $tags == 1 ]] && needs_cur=0 # --tags / tag <name> alone pushes only tags
  for r in ${refspecs[@]+"${refspecs[@]}"}; do [[ $delete == 0 && ( "${r#+}" == HEAD || "${r#+}" == @ ) ]] && needs_cur=1; done
  if [[ $dir_dyn == 1 && $needs_cur == 1 ]]; then
    deny "[hook:validate-push-target] The directory of this push is built from a variable or a command substitution, so the branch it pushes cannot be checked against the default branch. Write the path and the branch literally (git push -u origin <branch>).
  Blocked: $shown"
  fi

  if [[ ${#refspecs[@]} -eq 0 ]]; then
    [[ $tags == 0 && -n "$cur" ]] || continue # tags only, detached HEAD or not a repository
    push_default=${push_default:-$(g config --get push.default || true)}
    case "${push_default:-simple}" in
      nothing) continue ;;
      matching) if p=$(protected_local); then blocked "$p" "$shown"; fi; continue ;;
      upstream|tracking) dst=$(g config --get "branch.$cur.merge" || true); dst=${dst#refs/heads/} ;;
      *) dst=$cur ;;
    esac
    if [[ -n "$dst" ]] && p=$(matches_protected "$dst"); then blocked "$p" "$shown"; fi
    continue
  fi

  for ((k = 0; k < ${#refspecs[@]}; k++)); do
    r=${refspecs[k]#+}
    if [[ ${refdyn[k]} == 1 ]]; then
      deny "[hook:validate-push-target] The refspec '$r' is built from a variable or a command substitution, so it cannot be checked against the default branch. Write the branch name literally, or use HEAD (git push -u origin HEAD).
  Blocked: $shown"
    fi
    if [[ "$r" == ":" ]]; then # the matching refspec: every branch that exists on both sides
      if p=$(protected_local); then blocked "$p" "$shown"; fi
      continue
    elif [[ "$r" == *:* ]]; then
      dst=${r#*:}
    elif [[ $delete == 0 && ( "$r" == HEAD || "$r" == @ ) ]]; then
      dst=$cur
    else
      dst=$r
    fi
    case "$dst" in # git reads heads/<name> as refs/heads/<name>; other refs/* are not branches
      refs/heads/*) dst=${dst#refs/heads/} ;;
      heads/*) dst=${dst#heads/} ;;
      refs/*) continue ;;
    esac
    if [[ -n "$dst" ]] && p=$(matches_protected "$dst"); then blocked "$p" "$shown"; fi
  done
done

exit 0
