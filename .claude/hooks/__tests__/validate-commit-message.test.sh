#!/usr/bin/env bash
# Manual test for ../validate-commit-message.sh
#
# Run: bash .claude/hooks/__tests__/validate-commit-message.test.sh
#
# Builds JSON inputs that mimic the PreToolUse hook protocol and feeds them to
# the hook script via stdin. Each case asserts the hook's exit code.
#
# CLAUDE_PROJECT_DIR is overridden to a non-existent path so the hook's git
# branch lookup fails and `current_branch` becomes empty, forcing the strict
# "issue number required" branch — independent of whatever branch the test is
# actually run from.

set -u

HOOK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$HOOK_DIR/validate-commit-message.sh"

if [[ ! -f "$HOOK" ]]; then
  printf 'hook not found: %s\n' "$HOOK" >&2
  exit 1
fi

pass=0
fail=0

run_case() {
  local name="$1" expected="$2" command="$3"
  local payload exit_code
  payload=$(printf '%s' "$command" | node -e 'const c=require("fs").readFileSync(0,"utf8");process.stdout.write(JSON.stringify({tool_input:{command:c}}))')
  set +e
  CLAUDE_PROJECT_DIR=/nonexistent bash "$HOOK" >/dev/null 2>&1 <<<"$payload"
  exit_code=$?
  set -e
  if [[ "$exit_code" == "$expected" ]]; then
    printf '  [PASS] %s (exit=%d)\n' "$name" "$exit_code"
    pass=$((pass+1))
  else
    printf '  [FAIL] %s (expected exit=%s, got %d)\n' "$name" "$expected" "$exit_code"
    fail=$((fail+1))
  fi
}

printf -- '--- validate-commit-message.sh tests ---\n'

# 1) Simple double-quoted, valid format
run_case "simple double-quoted (valid)" 0 \
  'git commit -m "feat: スキルを追加 #1"'

# 2) HEREDOC form — the regression target.
#    Before the fix, the `-m "..."` regex would greedily capture
#    `$(cat <<'\''EOF'\''` as the subject line and block.
heredoc_cmd=$(cat <<'CMD'
git commit -m "$(cat <<'EOF'
fix: バグ修正 #5

Co-Authored-By: Claude
EOF
)"
CMD
)
run_case "HEREDOC \$(cat <<'EOF') multi-line (regression: was false-positive)" 0 \
  "$heredoc_cmd"

# 3) Single-quoted, valid format
run_case "simple single-quoted (valid)" 0 \
  "git commit -m 'feat: 機能追加 #1'"

# 4) Invalid type prefix — must block
run_case "invalid type prefix (must block)" 2 \
  'git commit -m "wip 進行中 #1"'

# 5) Missing issue number on a non-claude branch — must block
run_case "missing issue number (must block, non-claude branch)" 2 \
  'git commit -m "feat: 機能追加"'

# 6) --amend — hook intentionally skips validation
run_case "--amend (skipped)" 0 \
  'git commit --amend -m "feat: 何でも"'

# 7) Non-commit invocation — hook ignores
run_case "non-commit invocation (ignored)" 0 \
  'git status'

# 8) HEREDOC with invalid type prefix — must still block
heredoc_bad=$(cat <<'CMD'
git commit -m "$(cat <<'EOF'
wip not allowed #1

body
EOF
)"
CMD
)
run_case "HEREDOC with invalid type prefix (must block)" 2 \
  "$heredoc_bad"

printf '\nResults: %d pass, %d fail\n' "$pass" "$fail"
[[ $fail -eq 0 ]]
