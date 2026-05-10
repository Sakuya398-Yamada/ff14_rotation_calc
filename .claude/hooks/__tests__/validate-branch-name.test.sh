#!/usr/bin/env bash
# Manual test for ../validate-branch-name.sh
#
# Run: bash .claude/hooks/__tests__/validate-branch-name.test.sh
#
# Builds JSON inputs that mimic the PreToolUse hook protocol and feeds them to
# the hook script via stdin. Each case asserts the hook's exit code.
#
# CLAUDE_PROJECT_DIR is irrelevant for this hook (it does not inspect the
# current branch), so we leave it unset.

set -u

HOOK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$HOOK_DIR/validate-branch-name.sh"

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
  bash "$HOOK" >/dev/null 2>&1 <<<"$payload"
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

printf -- '--- validate-branch-name.sh tests ---\n'

# 1) Convention-compliant branch name — allow
run_case "compliant feature branch (allow)" 0 \
  'git checkout -b feature/#42-add-pictomancer-rotation'

# 2) Convention-compliant fix branch via `git switch -c` — allow
run_case "compliant fix branch via switch -c (allow)" 0 \
  'git switch -c fix/#5-fix-damage-calculation'

# 3) Convention violation — must block
run_case "non-conforming name (must block)" 2 \
  'git checkout -b invalid-branch-name'

# 4) Convention violation via `git switch -c` — must block
run_case "non-conforming name via switch -c (must block)" 2 \
  'git switch -c bad-name-no-prefix'

# 5) Exempt: claude/* — allow
run_case "claude/* exempt (allow)" 0 \
  'git checkout -b claude/some-session'

# 6) Exempt: main / master / develop — allow
run_case "main exempt (allow)" 0 \
  'git checkout -b main'
run_case "master exempt (allow)" 0 \
  'git checkout -b master'
run_case "develop exempt (allow)" 0 \
  'git checkout -b develop'

# 7) Non-branch-creating command — ignore
run_case "non-branch command (ignored)" 0 \
  'git status'

# 8) [REGRESSION] commit message body containing `git checkout -b foo` — must allow
#    Before the fix, the regex matched `foo` as a branch name and blocked the
#    entire commit. Issue #242 / discovery: PR #241.
run_case "REGRESSION: commit message mentions 'git checkout -b foo' (allow)" 0 \
  'git commit -m "fix: 実機 git checkout -b foo で動作確認 #240"'

# 9) [REGRESSION] HEREDOC body containing `git switch -c foo` — must allow
heredoc_switch=$(cat <<'CMD'
git commit -m "$(cat <<'EOF'
fix: バグ修正 #5

実機 git switch -c foo / git checkout -b bar で block/allow を検証
EOF
)"
CMD
)
run_case "REGRESSION: HEREDOC mentions 'git switch -c foo' (allow)" 0 \
  "$heredoc_switch"

# 10) [REGRESSION] HEREDOC body containing a non-conforming branch name in
#     `git checkout -b <bad-name>` — must still allow because the outer
#     command is `git commit`, not branch creation.
heredoc_bad=$(cat <<'CMD'
git commit -m "$(cat <<'EOF'
docs: hook の動作例 #242

例: git checkout -b で が block される（で が branch 名として抽出された）
EOF
)"
CMD
)
run_case "REGRESSION: HEREDOC contains broken branch-creation example (allow)" 0 \
  "$heredoc_bad"

printf '\nResults: %d pass, %d fail\n' "$pass" "$fail"
[[ $fail -eq 0 ]]
