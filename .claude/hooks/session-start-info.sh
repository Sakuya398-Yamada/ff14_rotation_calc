#!/usr/bin/env bash
# SessionStart hook: prints a short status banner so Claude knows what the
# repository looks like at the start of a session.
#
# Output goes to stdout. Claude Code surfaces it as additional system context.

set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
short_status=$(git status --short 2>/dev/null | head -n 20)
ahead_behind=$(git rev-list --left-right --count HEAD...@{upstream} 2>/dev/null || echo "")

printf '## Repository status\n'
printf -- '- Branch: `%s`\n' "$branch"
if [[ -n "$ahead_behind" ]]; then
  ahead=$(printf '%s' "$ahead_behind" | awk '{print $1}')
  behind=$(printf '%s' "$ahead_behind" | awk '{print $2}')
  printf -- '- Ahead/Behind upstream: %s / %s\n' "$ahead" "$behind"
fi
if [[ -n "$short_status" ]]; then
  printf -- '- Working tree (truncated to 20 lines):\n```\n%s\n```\n' "$short_status"
else
  printf -- '- Working tree: clean\n'
fi

exit 0
