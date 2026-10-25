#!/usr/bin/env bash
# Pre-tool-use hook — self-matching `pkill -f` / `pgrep -f` guardrail.
#
# The Bash tool runs each command in a shell whose own command line contains the whole command
# text (`bash -c '... eval '"'"'<command>'"'"' ...'`). `pkill -f <pattern>` matches the pattern
# against full command lines, so when the pattern also matches that text, pkill kills the shell
# running it (exit 144) and everything after it in the command is skipped; `pgrep -f` lists the
# shell as a live match. Wrapping one character in brackets (`[n]ode`) is not enough when the
# target is also spelled out elsewhere in the same command.
#
# Blocks `pkill` / `pgrep` at a command position (start of the command, after ; & | ( ` or a
# newline, also behind if / then / do / while / ! / { / sudo / timeout N ... and a path) when:
#   -f / --full is given, -A / --ignore-ancestors and -x / --exact are not, and
#   the pattern, read as the extended regex pkill uses, matches the command text itself
#   (newlines read as spaces, as they are when pkill reads a command line).
# A pattern built from a variable or a command substitution cannot be checked and is blocked.
# An invalid regex is let through: pkill rejects it itself without signalling anything.
# Bodies of quoted heredocs (<<'X', <<"X", <<\X) are not searched for commands (they are text,
# such as a PR body), but they still count as command text for the match.
#
# Works under two hosts (the payload arrives as JSON on stdin), like the other validate-* hooks:
#   {"tool_name":"Bash","tool_input":{"command":"..."}}  or  {"toolName":"bash","toolArgs":...}
# Exit 2 denies the tool call (Claude Code feeds stderr back to Claude). Exit 0 allows it. JSON is
# parsed with jq, node or python3, whichever exists; with none of them the call is denied. If the
# hook itself crashes or times out, Claude Code blocks the call through "onFailure": "block".

set -euo pipefail

input=$(cat)

# Fast path: skip the JSON parse unless the payload can contain pkill / pgrep.
case "$input" in
  *pkill*|*pgrep*) ;;
  *) exit 0 ;;
esac

extract_command() { # reads the hook payload from stdin
  if command -v jq >/dev/null 2>&1; then
    jq -r '
      def args: (.toolArgs // {}) | if type == "string" then (fromjson? // {}) else . end;
      .tool_input.command // (args | .command) // ""'
  elif command -v node >/dev/null 2>&1; then
    node -e '
      let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
        try {
          const j = JSON.parse(s);
          let a = j.toolArgs; if (typeof a === "string") { try { a = JSON.parse(a); } catch (e) { a = {}; } }
          process.stdout.write((j.tool_input && j.tool_input.command) || (a && a.command) || "");
        } catch (e) {}
      });'
  elif command -v python3 >/dev/null 2>&1; then
    python3 -I -c '
import json, sys
try:
    j = json.load(sys.stdin)
    a = j.get("toolArgs") or {}
    if isinstance(a, str):
        try:
            a = json.loads(a)
        except Exception:
            a = {}
    sys.stdout.write((j.get("tool_input") or {}).get("command") or (a or {}).get("command") or "")
except Exception:
    pass'
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

HOWTO="  Started with run_in_background? Stop it with TaskStop (its task ID) instead; that also
  stops the child processes it started, which pkill can leave behind.
  Otherwise make the pattern unable to match its own command text:
    - wrap one character in brackets ([n]ode dev-server) and do not spell the target
      literally anywhere else in the same command, or
    - add -A (--ignore-ancestors, procps-ng 4.0.1+), or
    - kill by PID (e.g. kill \$(lsof -ti:<port>))."

if ! cmd=$(printf '%s' "$input" | extract_command); then
  deny "[hook:validate-pkill-pattern] No JSON parser found (install jq, node or python3), so the pkill/pgrep pattern cannot be checked. The command is blocked instead of being let through unchecked."
fi

NL=$'\n'
flat=${cmd//"$NL"/ }

# strip_quoted_heredocs <text> — <text> without the bodies of quoted heredocs. Unquoted heredoc
# bodies stay: their `...` and $(...) do run.
strip_quoted_heredocs() {
  local line cmp out="" delim="" strip_tabs=0
  local hd_re="(^|[^<])<<(-?)[[:space:]]*(\\\\([A-Za-z0-9_]+)|'([^']+)'|\"([^\"]+)\")"
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ -n "$delim" ]]; then
      cmp=$line
      if [[ $strip_tabs == 1 ]]; then cmp=${line#"${line%%[!$'\t']*}"}; fi
      if [[ "$cmp" == "$delim" ]]; then delim=""; fi
      continue
    fi
    out+="$line$NL"
    if [[ "$line" =~ $hd_re ]]; then
      delim="${BASH_REMATCH[4]}${BASH_REMATCH[5]}${BASH_REMATCH[6]}"
      if [[ "${BASH_REMATCH[2]}" == "-" ]]; then strip_tabs=1; else strip_tabs=0; fi
    fi
  done <<<"$1"
  printf '%s' "$out"
}

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
        ';'|'&'|'|'|')'|'`'|"$NL") break ;;
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

# `pkill` / `pgrep` at a command position, optionally behind reserved words, prefix commands,
# VAR=value assignments and a path. The last group is the text after it.
lead='((if|then|do|else|elif|while|until|time|!|[{]|sudo|nohup|command|exec|env|xargs|nice|timeout[[:space:]]+[^[:space:]]+|[A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*)[[:space:]]+)*'
proc_re='(^|[;&|(`'"$NL"'])[[:space:]]*'"$lead"'([^[:space:];&|()`]*/|\\)?(pkill|pgrep)([[:space:]]|$)(.*)'
signal_re='^-([0-9]+|(SIG)?[A-Z][A-Z0-9+-]+)$'

rest=$(strip_quoted_heredocs "$cmd")
while [[ "$rest" =~ $proc_re ]]; do
  rest=${BASH_REMATCH[${#BASH_REMATCH[@]} - 1]}
  words "$rest"
  full=0 skip=0 icase=0 take=0 opts_done=0 found=0 pattern="" pdyn=0
  for ((j = 0; j < ${#WORDS[@]}; j++)); do
    w=${WORDS[j]}
    if [[ $take == 1 ]]; then take=0; continue; fi
    if [[ $opts_done == 0 && "$w" == "--" ]]; then
      opts_done=1
    elif [[ $opts_done == 0 && "$w" == --?* ]]; then
      case "${w%%=*}" in
        --full) full=1 ;;
        --ignore-ancestors|--exact) skip=1 ;;
        --ignore-case) icase=1 ;;
        --queue|--pgroup|--group|--older|--parent|--session|--signal|--terminal|--euid|--uid|--pidfile|--runstates|--cgroup|--ns|--nslist|--delimiter)
          [[ "$w" == *=* ]] || take=1 ;;
      esac
    elif [[ $opts_done == 0 && "$w" =~ $signal_re ]]; then
      : # pkill -9 / -KILL / -SIGTERM
    elif [[ $opts_done == 0 && "$w" == -?* ]]; then
      for ((k = 1; k < ${#w}; k++)); do
        case "${w:k:1}" in
          f) full=1 ;;
          A|x) skip=1 ;;
          i) icase=1 ;;
          [qgGOPstuUFrd]) [[ $k -eq $((${#w} - 1)) ]] && take=1; break ;;
        esac
      done
    elif [[ $found == 0 ]]; then
      found=1; pattern=$w; pdyn=${DYN[j]}
    fi
  done
  [[ $found == 1 && $full == 1 && $skip == 0 ]] || continue

  if [[ $pdyn == 1 ]]; then
    deny "[hook:validate-pkill-pattern] The pkill/pgrep -f pattern '$pattern' is built from a variable or a command substitution, so it cannot be checked against this command's own text. The Bash tool runs the command in a shell whose command line contains that text; if the pattern matches it, pkill kills that shell (exit 144) and skips the rest of the command, and pgrep lists it as a match.

$HOWTO"
  fi

  matched=0
  if [[ $icase == 1 ]]; then shopt -s nocasematch; fi
  if [[ "$flat" =~ $pattern ]]; then matched=1; fi
  shopt -u nocasematch
  if [[ $matched == 1 ]]; then
    deny "[hook:validate-pkill-pattern] The pkill/pgrep -f pattern '$pattern' also matches this command's own text. The Bash tool runs the command in a shell whose command line contains that text, so pkill would kill that shell (exit 144) and skip the rest of the command, and pgrep would list it as a match.

$HOWTO"
  fi
done

exit 0
