#!/usr/bin/env bash
# Pre-tool-use hook — commit message guardrail.
#
# Blocks `git commit` when the subject line violates the project convention:
#   <type>[(scope)][!]: <subject> #<issue>
#   type = feat | fix | refactor | test | docs | chore | style
#
# - "(scope)" and "!" (breaking change) are optional and follow Conventional Commits.
# - The issue number is required, except on agent session branches (claude/*, copilot/*).
# - Subjects that git generates itself (Merge/Revert/fixup!/squash!) are exempt.
#
# Works under two hosts (the payload arrives as JSON on stdin):
#   - Claude Code  (.claude/settings.json → PreToolUse, matcher "Bash"):
#       {"tool_name":"Bash","tool_input":{"command":"..."},"cwd":"..."}
#   - GitHub Copilot cloud agent / CLI / VS Code (.github/hooks/*.json → preToolUse, matcher "bash"):
#       {"toolName":"bash","toolArgs":{"command":"..."} or "<json string>","cwd":"..."}
# Exit 2 denies the tool call on both hosts (Claude Code feeds stderr back to Claude; Copilot
# also reads the JSON printed on stdout). Exit 0 allows it. Exit 1 is a warning (Claude Code
# continues, Copilot fails closed). JSON is parsed with jq, node or python3, whichever exists.
#
# Extraction is conservative on purpose: if no message can be found in the command
# (e.g. `git commit -F file`, `--amend --no-edit`) the command is allowed through
# instead of producing a false positive. git itself still refuses empty messages.

set -euo pipefail

DOC=".claude/rules/git-conventions.md"

input=$(cat)

# Fast path: skip the JSON parse entirely unless the payload mentions "commit".
case "$input" in
  *commit*) ;;
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
  echo "[hook:validate-commit-message] No JSON parser found (install jq, node or python3). Commit message was NOT validated." >&2
  exit 1
fi
hook_cwd=$(printf '%s' "$input" | extract cwd) || hook_cwd=""

NL=$'\n'
# `git [global options] commit` at a command position (start of line / after ; & | ( or a backtick).
git_commit_re='(^|[;&|(`'"$NL"'])[[:space:]]*git([[:space:]]+(-C|-c|--git-dir|--work-tree|--namespace)[[:space:]]+[^[:space:]]+|[[:space:]]+-[^[:space:]]+)*[[:space:]]+commit([[:space:]]|$)'
# -m "...", -m '...', -am "...", --message="...", --message ... (value captured in group 4)
msg_dq_re='(^|[[:space:]])(-[a-zA-Z]*m|--message)(=|[[:space:]]+)"([^"]*)"'
msg_sq_re="(^|[[:space:]])(-[a-zA-Z]*m|--message)(=|[[:space:]]+)'([^']*)'"
msg_bare_re='(^|[[:space:]])(-[a-zA-Z]*m|--message)(=|[[:space:]]+)([^[:space:]"'"'"'$]+)'
# heredoc body: first non-empty line after `<<EOF` / `<<-'EOF'` / `<<"MSG"` (any delimiter name)
heredoc_re='<<-?[[:space:]]*["'"'"']?[A-Za-z_][A-Za-z0-9_]*["'"'"']?[^'"$NL"']*'"$NL"'+([^'"$NL"']+)'
type_re='^(feat|fix|refactor|test|docs|chore|style)(\([^)]+\))?!?: [^[:space:]]'

# own_match <regex> <group>: sets msg to the group if <regex> matches inside this commit's
# own options, i.e. nothing before the match ends the command (newline, ; & |). Without this,
# text in a heredoc body or in a later command is taken as the subject (e.g. a body line
# that contains `-m "x"`, or `git commit -F msg.txt && cat <<EOF ...`).
own_match() {
  [[ "$rest" =~ $1 ]] || return 1
  local value="${BASH_REMATCH[$2]}" prefix="${rest%%"${BASH_REMATCH[0]}"*}"
  [[ "$prefix" == *[$'\n;&|']* ]] && return 1
  msg="$value"
}

current_branch_of() {
  local dir="$1"
  git -C "$dir" symbolic-ref --short -q HEAD 2>/dev/null \
    || git -C "$dir" rev-parse --abbrev-ref HEAD 2>/dev/null \
    || echo ""
}

rest="$cmd"
while [[ "$rest" =~ $git_commit_re ]]; do
  matched="${BASH_REMATCH[0]}"
  rest="${rest#*"$matched"}"

  # Honour `git -C <dir> commit` when detecting the current branch.
  repo_dir="${CLAUDE_PROJECT_DIR:-${hook_cwd:-.}}"
  if [[ "$matched" =~ -C[[:space:]]+[\"\']?([^[:space:]\"\']+) ]]; then
    repo_dir="${BASH_REMATCH[1]}"
  fi

  msg=""
  own_match "$msg_dq_re" 4 || own_match "$msg_sq_re" 4 || own_match "$msg_bare_re" 4 || true
  # `-m "$(cat <<'EOF' ...)"` or `-F - <<'EOF'`: the subject is the first heredoc line.
  if [[ -z "$msg" || "$msg" == \$\(* ]]; then
    msg=""
    own_match "$heredoc_re" 1 || true
  fi

  # Nothing extractable (e.g. -F <file>, --amend --no-edit): let git decide.
  [[ -z "$msg" ]] && continue

  first_line="${msg%%"$NL"*}"
  # Trim surrounding whitespace.
  first_line="${first_line#"${first_line%%[![:space:]]*}"}"
  first_line="${first_line%"${first_line##*[![:space:]]}"}"

  case "$first_line" in
    Merge\ *|Revert\ *|fixup!\ *|squash!\ *) continue ;;
  esac

  if [[ ! "$first_line" =~ $type_re ]]; then
    deny "[hook:validate-commit-message] Commit message violates the project convention.

  First line: $first_line
  Expected:   <type>[(scope)][!]: <subject> #<issue>
  type:       feat | fix | refactor | test | docs | chore | style
  Example:    feat: スキルデータモデルを追加 #1

  See $DOC for details."
  fi

  current_branch=$(current_branch_of "$repo_dir")
  case "$current_branch" in
    claude/*|copilot/*) issue_optional=1 ;;
    *) issue_optional=0 ;;
  esac

  if [[ "$issue_optional" -eq 0 && ! "$first_line" =~ \#[0-9]+ ]]; then
    deny "[hook:validate-commit-message] Commit message is missing the issue number.

  First line:     $first_line
  Current branch: ${current_branch:-unknown}
  Expected:       <type>: <subject> #<issue>
  Example:        fix: ダメージ計算のバフ適用順序を修正 #5

  Only agent session branches (claude/*, copilot/*) may omit the issue number.
  See $DOC for details."
  fi
done

exit 0
