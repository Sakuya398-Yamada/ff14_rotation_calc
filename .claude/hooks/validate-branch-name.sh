#!/usr/bin/env bash
# Pre-tool-use hook — branch name guardrail.
#
# Blocks branch creation when the new name violates the project convention:
#   <feature|fix|refactor|docs>/#<issue>-<kebab-case-description>
#
# Covered commands:
#   git checkout -b|-B <name>        git checkout --orphan <name>
#   git switch -c|-C <name>          git switch --create|--force-create|--orphan <name>
#   git branch [-f|-t|...] <name>    git worktree add [...] -b|-B <name> <path>
#
# Exempt:
#   claude/* , copilot/*       agent session branches (Claude Code on the web / Copilot cloud agent)
#   main / master / develop    long-lived branches
#
# Works under two hosts (the payload arrives as JSON on stdin):
#   - Claude Code  (.claude/settings.json → PreToolUse, matcher "Bash"):
#       {"tool_name":"Bash","tool_input":{"command":"..."},"cwd":"..."}
#   - GitHub Copilot cloud agent / CLI / VS Code (.github/hooks/*.json → preToolUse, matcher "bash"):
#       {"toolName":"bash","toolArgs":{"command":"..."} or "<json string>","cwd":"..."}
# Exit 2 denies the tool call on both hosts (Claude Code feeds stderr back to Claude; Copilot
# also reads the JSON printed on stdout). Exit 0 allows it. Exit 1 is a warning (Claude Code
# continues, Copilot fails closed). JSON is parsed with jq, node or python3, whichever exists.

set -euo pipefail

DOC=".claude/rules/git-conventions.md"

input=$(cat)

# Fast path: skip the JSON parse unless the payload can contain a branch-creating command.
case "$input" in
  *checkout*|*switch*|*branch*|*worktree*) ;;
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
  echo "[hook:validate-branch-name] No JSON parser found (install jq, node or python3). Branch name was NOT validated." >&2
  exit 1
fi

NL=$'\n'
# `git [global options] <subcommand>` at a command position.
git_re='(^|[;&|(`'"$NL"'])[[:space:]]*git([[:space:]]+(-C|-c|--git-dir|--work-tree|--namespace)[[:space:]]+[^[:space:]]+|[[:space:]]+-[^[:space:]]+)*[[:space:]]+'
opt='([[:space:]]+-[^[:space:]]+)*'
# A branch name token, optionally quoted (group captured by the caller).
name='["'"'"']?([^[:space:]"'"'"';&|()`-][^[:space:]"'"'"';&|()`]*)'
checkout_re="^checkout${opt}[[:space:]]+(-b|-B|--orphan)[[:space:]]+${name}"
switch_re="^switch${opt}[[:space:]]+(-c|-C|--create|--force-create|--orphan)(=|[[:space:]]+)${name}"
branch_re='^branch([[:space:]]+(-f|--force|-t|--track|--no-track|-q|--quiet))*[[:space:]]+'"${name}"
worktree_re="^worktree[[:space:]]+add${opt}[[:space:]]+(-b|-B)[[:space:]]+${name}"
convention_re='^(feature|fix|refactor|docs)/#[0-9]+-[a-z0-9]+(-[a-z0-9]+)*$'

candidates=()
rest="$cmd"
while [[ "$rest" =~ $git_re ]]; do
  rest="${rest#*"${BASH_REMATCH[0]}"}"
  if [[ "$rest" =~ $checkout_re ]]; then
    candidates+=("${BASH_REMATCH[3]}")
  elif [[ "$rest" =~ $switch_re ]]; then
    candidates+=("${BASH_REMATCH[4]}")
  elif [[ "$rest" =~ $branch_re ]]; then
    candidates+=("${BASH_REMATCH[3]}")
  elif [[ "$rest" =~ $worktree_re ]]; then
    candidates+=("${BASH_REMATCH[3]}")
  fi
done

[[ ${#candidates[@]} -eq 0 ]] && exit 0

for branch in "${candidates[@]}"; do
  case "$branch" in
    claude/*|copilot/*|main|master|develop) continue ;;
  esac
  if [[ ! "$branch" =~ $convention_re ]]; then
    deny "[hook:validate-branch-name] Branch name '$branch' violates the project convention.

  Expected: <feature|fix|refactor|docs>/#<issue-number>-<kebab-case-description>
  Example:  feature/#42-add-pictomancer-rotation
            fix/#5-fix-damage-calculation

  Description: lowercase letters, digits and single hyphens only.
  Exempt: claude/*, copilot/*, main, master, develop.
  See $DOC for details."
  fi
done

exit 0
