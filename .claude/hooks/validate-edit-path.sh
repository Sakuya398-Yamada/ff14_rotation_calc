#!/usr/bin/env bash
# PreToolUse hook for the Edit / Write tools.
# Warns (exit 1, stderr) when the supplied file_path points to the MAIN REPO
# while Claude is currently working in a registered git worktree. This catches
# the silent path-mismatch pattern documented in PR #241 / Issue #243 / #246
# where the Edit succeeds against the main repo but pwd-relative bash commands
# run against the worktree, leading to confusing "edited but not reflected"
# failures.
#
# Opt-out: set CLAUDE_ALLOW_MAIN_REPO_EDIT=1 to suppress entirely.
#
# This wrapper is intentionally thin: it gathers the worktree list via git and
# delegates path normalization / detection to validate-edit-path.cjs. Tests can
# invoke the .cjs directly with mock env vars (no git dependency).
# The .cjs extension forces CommonJS even though the project's package.json
# declares "type": "module".
#
# Exit codes:
#   0 = OK / opt-out / outside detection scope
#   1 = warning surfaced to user (does NOT block; tool proceeds)
#
# Audience: per the Claude Code hook protocol, stderr from exit-1 hooks is
# shown to the human operator only — the assistant does not receive it.
# This warning is intended for the human in the loop. See header comment in
# validate-edit-path.cjs for design rationale.

set -euo pipefail

if [[ "${CLAUDE_ALLOW_MAIN_REPO_EDIT:-0}" == "1" ]]; then
  exit 0
fi

proj_dir="${CLAUDE_PROJECT_DIR:-$PWD}"

# `git worktree list --porcelain` first line per entry is `worktree <abs-path>`.
# First entry is the main worktree; the rest are registered linked worktrees.
wt_list=$(git -C "$proj_dir" worktree list --porcelain 2>/dev/null | awk '/^worktree / {print $2}' || true)

if [[ -z "$wt_list" ]]; then
  exit 0
fi

exec env \
  CLAUDE_HOOK_PROJ_DIR="$proj_dir" \
  CLAUDE_HOOK_WT_LIST="$wt_list" \
  node "$(dirname "$0")/validate-edit-path.cjs"
