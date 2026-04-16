#!/usr/bin/env bash
# PreToolUse hook for the Bash tool.
# Blocks `git commit -m "<message>"` when the message violates project convention:
#   <feat|fix|refactor|test|docs|chore|style>: <subject> #<issue>
#
# Issue number is required on regular branches but optional on `claude/*` session branches.
# Reads JSON via stdin (Claude Code hook protocol). Exit 2 = block.

set -euo pipefail

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')

# Only inspect git commit invocations
if [[ ! "$command" =~ git[[:space:]]+commit ]]; then
  exit 0
fi

# Skip --amend (modifying existing message — let the user handle it manually)
if [[ "$command" =~ --amend ]]; then
  exit 0
fi

# Extract message: try -m "..." then -m '...' then heredoc payload
msg=""
if [[ "$command" =~ -m[[:space:]]+\"([^\"]+)\" ]]; then
  msg="${BASH_REMATCH[1]}"
elif [[ "$command" =~ -m[[:space:]]+\'([^\']+)\' ]]; then
  msg="${BASH_REMATCH[1]}"
elif [[ "$command" =~ \<\<[\'\"]?EOF[\'\"]?[[:space:]]*$'\n'(.*)$'\n'[[:space:]]*EOF ]]; then
  msg="${BASH_REMATCH[1]}"
fi

# If we cannot extract a message (e.g. `git commit` opens editor, or unusual quoting)
# we let it through rather than producing false positives.
if [[ -z "$msg" ]]; then
  exit 0
fi

first_line=$(printf '%s' "$msg" | head -n 1)

# Detect current branch to relax the issue-number requirement on session branches
current_branch=""
if git -C "${CLAUDE_PROJECT_DIR:-.}" rev-parse --abbrev-ref HEAD >/dev/null 2>&1; then
  current_branch=$(git -C "${CLAUDE_PROJECT_DIR:-.}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
fi

issue_optional=0
case "$current_branch" in
  claude/*) issue_optional=1 ;;
esac

# Validate type prefix (always required)
if [[ ! "$first_line" =~ ^(feat|fix|refactor|test|docs|chore|style):[[:space:]]+.+ ]]; then
  cat >&2 <<EOF
[hook:validate-commit-message] Commit message violates the project convention.

  First line: $first_line
  Expected:   <feat|fix|refactor|test|docs|chore|style>: <subject> [#<issue>]
  Example:    feat: スキルデータモデルを追加 #1

  See .claude/rules/git-conventions.md for details.
EOF
  exit 2
fi

# Validate issue number (relaxed on claude/* branches)
if [[ "$issue_optional" -eq 0 ]] && [[ ! "$first_line" =~ \#[0-9]+ ]]; then
  cat >&2 <<EOF
[hook:validate-commit-message] Commit message is missing the issue number.

  First line:    $first_line
  Current branch: $current_branch
  Expected:      <type>: <subject> #<issue>
  Example:       fix: ダメージ計算のバフ適用順序を修正 #5

  Note: only branches matching 'claude/*' may omit the issue number.
EOF
  exit 2
fi

exit 0
