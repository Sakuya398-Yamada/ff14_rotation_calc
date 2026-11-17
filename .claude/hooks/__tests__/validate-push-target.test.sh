#!/usr/bin/env bash
# Manual test for ../validate-push-target.sh
#
# Run: bash .claude/hooks/__tests__/validate-push-target.test.sh
#
# Builds JSON inputs that mimic the PreToolUse hook protocol and feeds them to
# the hook script via stdin. Each case asserts the hook's exit code.
#
# A push with no refspec is judged by the branch checked out in the payload's
# "cwd", so the cases below run in throwaway repositories: one on `main` and one
# on an Issue branch. Nothing is pushed (the hook only reads the command).

set -u

HOOK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$HOOK_DIR/validate-push-target.sh"

if [[ ! -f "$HOOK" ]]; then
  printf 'hook not found: %s\n' "$HOOK" >&2
  exit 1
fi

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

make_repo() { # make_repo <dir> <branch>
  git init -q -b main "$1"
  git -C "$1" -c user.name=test -c user.email=test@example.com -c commit.gpgsign=false commit -q --allow-empty -m "init"
  if [[ "$2" != main ]]; then git -C "$1" switch -q -c "$2"; fi
}

ON_MAIN="$WORK/on-main"
ON_ISSUE="$WORK/on-issue"
ISSUE_BRANCH="feature/42-add-pictomancer-rotation"
make_repo "$ON_MAIN" main
make_repo "$ON_ISSUE" "$ISSUE_BRANCH"

pass=0
fail=0
LAST_STDERR=""

run_case() { # run_case <name> <expected exit> <cwd> <command>
  local name="$1" expected="$2" cwd="$3" command="$4"
  local payload exit_code
  payload=$(printf '%s' "$command" | node -e 'const c=require("fs").readFileSync(0,"utf8");process.stdout.write(JSON.stringify({tool_input:{command:c},cwd:process.argv[1]}))' "$cwd")
  LAST_STDERR=$(bash "$HOOK" 2>&1 >/dev/null <<<"$payload")
  exit_code=$?
  if [[ "$exit_code" == "$expected" ]]; then
    printf '  [PASS] %s (exit=%d)\n' "$name" "$exit_code"
    pass=$((pass+1))
  else
    printf '  [FAIL] %s (expected exit=%s, got %d)\n' "$name" "$expected" "$exit_code"
    fail=$((fail+1))
  fi
}

check() { # check <name> <condition result: 0 = ok>
  if [[ "$2" == 0 ]]; then
    printf '  [PASS] %s\n' "$1"
    pass=$((pass+1))
  else
    printf '  [FAIL] %s\n' "$1"
    fail=$((fail+1))
  fi
}

printf -- '--- validate-push-target.sh tests ---\n'

# 1) Pushes that write to the default branch — must block
run_case "git push origin main (must block)" 2 "$ON_ISSUE" \
  'git push origin main'
run_case "git push origin HEAD:main (must block)" 2 "$ON_ISSUE" \
  'git push origin HEAD:main'
run_case "git -C . push origin main (must block)" 2 "$ON_ISSUE" \
  'git -C . push origin main'
run_case "bare git push on main (must block)" 2 "$ON_MAIN" \
  'git push'
run_case "git push --mirror (must block)" 2 "$ON_ISSUE" \
  'git push --mirror'

# 2) Pushes that do not touch the default branch — allow
run_case "git push -u origin <Issue branch> (allow)" 0 "$ON_ISSUE" \
  "git push -u origin $ISSUE_BRANCH"
run_case "bare git push on an Issue branch (allow)" 0 "$ON_ISSUE" \
  'git push'
run_case "git push --tags on an Issue branch (allow)" 0 "$ON_ISSUE" \
  'git push --tags'
# Tags only: the current branch is not judged, so this must pass even on main
run_case "git push --tags on main (allow: tags only)" 0 "$ON_MAIN" \
  'git push --tags'

# 3) Not a push — ignore
run_case "non-push command (ignored)" 0 "$ON_ISSUE" \
  'git status'

# 4) The deny message names the Issue branch pattern without '#' (#609: a '#' in
#    a branch name breaks the Workers Builds preview)
run_case "deny message case (must block)" 2 "$ON_ISSUE" \
  'git push origin main'
case "$LAST_STDERR" in
  *'git switch -c <type>/<issue>-<description>'*) check "deny message shows <type>/<issue>-<description>" 0 ;;
  *) check "deny message shows <type>/<issue>-<description>" 1 ;;
esac
case "$LAST_STDERR" in
  *'#<issue>'*) check "deny message has no '#' before <issue>" 1 ;;
  *) check "deny message has no '#' before <issue>" 0 ;;
esac

printf '\nResults: %d pass, %d fail\n' "$pass" "$fail"
[[ $fail -eq 0 ]]
