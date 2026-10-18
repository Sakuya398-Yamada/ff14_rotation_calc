#!/usr/bin/env bash
# Manual test for ../session-start-cloud-deps.sh
#
# Run: bash .claude/hooks/__tests__/session-start-cloud-deps.test.sh
#
# Each case runs the hook against a throwaway project directory (CLAUDE_PROJECT_DIR).
# `npm`, `npx` and `sleep` are stubbed by scripts placed first on PATH. Every call is
# appended to STUB_CALLS_LOG so the commands the hook ran can be asserted. The stubs
# print noise so the test can check that it stays out of stdout (which Claude Code adds
# to Claude's context). STUB_NPM_EXIT / STUB_NPX_EXIT set their exit codes, and
# STUB_NPM_FAIL_TIMES limits npm's failures to its first N calls; a successful `npm ci`
# writes node_modules/.package-lock.json like the real one does. `sleep` returns at once.

set -u

HOOK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$HOOK_DIR/session-start-cloud-deps.sh"

if [[ ! -f "$HOOK" ]]; then
  printf 'hook not found: %s\n' "$HOOK" >&2
  exit 1
fi

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

STUB_BIN="$TMP_ROOT/bin"
STUB_CALLS_LOG="$TMP_ROOT/calls.log"
mkdir -p "$STUB_BIN"
cat >"$STUB_BIN/npm" <<'EOF'
#!/usr/bin/env bash
printf 'npm %s\n' "$*" >>"$STUB_CALLS_LOG"
for _ in $(seq 50); do echo "STUB-NOISE"; done
if [[ "${STUB_NPM_EXIT:-0}" -ne 0 ]] &&
   { [[ -z "${STUB_NPM_FAIL_TIMES:-}" ]] ||
     (( $(grep -c '^npm ' "$STUB_CALLS_LOG") <= STUB_NPM_FAIL_TIMES )); }; then
  echo "STUB-ERR-LAST" >&2
  exit "$STUB_NPM_EXIT"
fi
if [[ "${1:-}" == "ci" ]]; then
  mkdir -p node_modules && touch node_modules/.package-lock.json
fi
EOF
cat >"$STUB_BIN/npx" <<'EOF'
#!/usr/bin/env bash
printf 'npx %s\n' "$*" >>"$STUB_CALLS_LOG"
for _ in $(seq 50); do echo "STUB-NOISE"; done
exit "${STUB_NPX_EXIT:-0}"
EOF
cat >"$STUB_BIN/sleep" <<'EOF'
#!/usr/bin/env bash
printf 'sleep %s\n' "$*" >>"$STUB_CALLS_LOG"
EOF
chmod +x "$STUB_BIN/npm" "$STUB_BIN/npx" "$STUB_BIN/sleep"

pass=0
fail=0

# make_proj <name>  -> prints project path. Only package-lock.json, no node_modules.
make_proj() {
  local dir="$TMP_ROOT/$1"
  mkdir -p "$dir"
  printf '{}\n' >"$dir/package-lock.json"
  printf '%s' "$dir"
}

# run_hook <proj> <CLAUDE_CODE_REMOTE value or "unset"> [npm exit] [npx exit] [npm fail times]
#   -> sets $out (stdout), $err (stderr), $rc
run_hook() {
  local proj="$1" remote="$2"
  : >"$STUB_CALLS_LOG"
  local -a env_args=(CLAUDE_PROJECT_DIR="$proj" TMPDIR="$TMP_ROOT" PATH="$STUB_BIN:$PATH"
    STUB_CALLS_LOG="$STUB_CALLS_LOG" STUB_NPM_EXIT="${3:-0}" STUB_NPX_EXIT="${4:-0}"
    STUB_NPM_FAIL_TIMES="${5:-}")
  if [[ "$remote" != "unset" ]]; then
    env_args+=(CLAUDE_CODE_REMOTE="$remote")
  fi
  # Run from outside the project so the hook has to find it through CLAUDE_PROJECT_DIR
  out=$(cd "$TMP_ROOT" && env -u CLAUDE_CODE_REMOTE "${env_args[@]}" bash "$HOOK" 2>"$TMP_ROOT/stderr")
  rc=$?
  err=$(cat "$TMP_ROOT/stderr")
}

calls() { grep -c -- "$1" "$STUB_CALLS_LOG" 2>/dev/null || true; }

check() {
  local name="$1" ok="$2"
  if [[ "$ok" == "1" ]]; then
    printf '  [PASS] %s\n' "$name"
    pass=$((pass+1))
  else
    printf '  [FAIL] %s\n' "$name"
    printf '%s\n' "$out" | sed 's/^/        | /'
    fail=$((fail+1))
  fi
}

contains() { [[ "$out" == *"$1"* ]] && echo 1 || echo 0; }
lacks() { [[ "$out" != *"$1"* ]] && echo 1 || echo 0; }
is() { [[ "$1" == "$2" ]] && echo 1 || echo 0; }

echo "## session-start-cloud-deps.sh"

# 1. Local session (CLAUDE_CODE_REMOTE unset): exits at once without touching anything
proj=$(make_proj local)
run_hook "$proj" unset
check "local: exit 0" "$(is "$rc" 0)"
check "local: no output" "$(is "$out$err" "")"
check "local: npm not run" "$(is "$(calls '^npm ')" 0)"
check "local: npx not run" "$(is "$(calls '^npx ')" 0)"

# 1b. Anything but "true" counts as local
run_hook "$proj" false
check "remote=false: no output" "$(is "$out$err" "")"
check "remote=false: npm not run" "$(is "$(calls '^npm ')" 0)"

# 2. Fresh cloud session: installs and applies the local D1 migrations, keeps the tool output out of stdout
proj=$(make_proj fresh)
run_hook "$proj" true
check "fresh: exit 0" "$(is "$rc" 0)"
check "fresh: npm ci run once" "$(is "$(calls '^npm ci')" 1)"
check "fresh: no wait for a retry" "$(is "$(calls '^sleep ')" 0)"
check "fresh: installed into CLAUDE_PROJECT_DIR" "$([[ -f "$proj/node_modules/.package-lock.json" ]] && echo 1 || echo 0)"
check "fresh: local D1 migrations run once" "$(is "$(calls '^npx wrangler d1 migrations apply DB --local$')" 1)"
check "fresh: banner heading" "$(contains '## Cloud setup')"
check "fresh: npm ci reported done" "$(contains '- npm ci: done in ')"
check "fresh: no retried note" "$(lacks 'retried once')"
check "fresh: local D1 migrations reported done" "$(contains '- local D1 migrations: done')"
check "fresh: tool output kept out of stdout" "$(lacks 'STUB-NOISE')"
check "fresh: tool output written to the log" "$(is "$(grep -c STUB-NOISE "$TMP_ROOT/session-start-cloud-deps.log")" 100)"
check "fresh: stdout is 3 lines" "$(is "$(printf '%s\n' "$out" | wc -l | tr -d '[:space:]')" 3)"
check "fresh: no stderr" "$(is "$err" "")"

# 3. Resumed session: node_modules is newer than package-lock.json, so npm ci is skipped
proj=$(make_proj resumed)
touch -t 202001010000 "$proj/package-lock.json"
mkdir -p "$proj/node_modules" && touch "$proj/node_modules/.package-lock.json"
run_hook "$proj" true
check "resumed: npm ci skipped" "$(is "$(calls '^npm ci')" 0)"
check "resumed: reported skipped" "$(contains '- npm ci: skipped')"
check "resumed: local D1 migrations still run" "$(is "$(calls '^npx wrangler d1 migrations apply DB --local$')" 1)"

# 4. package-lock.json changed after the last install: npm ci runs again
proj=$(make_proj lock-changed)
mkdir -p "$proj/node_modules" && touch -t 202001010000 "$proj/node_modules/.package-lock.json"
run_hook "$proj" true
check "lock changed: npm ci run" "$(is "$(calls '^npm ci')" 1)"

# 5. node_modules exists but the install never finished (no .package-lock.json)
proj=$(make_proj interrupted)
mkdir -p "$proj/node_modules"
run_hook "$proj" true
check "interrupted install: npm ci run" "$(is "$(calls '^npm ci')" 1)"

# 6. npm ci fails twice: retried only once, still exit 0 (the session goes on), the
#    failure and log tail go to stdout
proj=$(make_proj npm-fails)
run_hook "$proj" true 1 0
check "npm fails: exit 0" "$(is "$rc" 0)"
check "npm fails: npm ci run twice" "$(is "$(calls '^npm ci')" 2)"
check "npm fails: waited 5s before the retry" "$(is "$(grep -- '^sleep ' "$STUB_CALLS_LOG")" 'sleep 5')"
check "npm fails: failure reported" "$(contains 'npm ci failed** (exit 1')"
check "npm fails: log tail included" "$(contains 'STUB-ERR-LAST')"
check "npm fails: no retried note" "$(lacks 'retried once')"
check "npm fails: local D1 migrations not run" "$(is "$(calls '^npx ')" 0)"

# 6b. npm ci fails once (e.g. the proxy cut a download): the retry succeeds and is noted
proj=$(make_proj npm-fails-once)
run_hook "$proj" true 1 0 1
check "npm fails once: exit 0" "$(is "$rc" 0)"
check "npm fails once: npm ci run twice" "$(is "$(calls '^npm ci')" 2)"
check "npm fails once: waited 5s before the retry" "$(is "$(grep -- '^sleep ' "$STUB_CALLS_LOG")" 'sleep 5')"
check "npm fails once: reported done after a retry" "$(contains '- npm ci: done in ')"
check "npm fails once: retried note" "$(contains 's (retried once)')"
check "npm fails once: no failure reported" "$(lacks 'failed**')"
check "npm fails once: retry marked in the log" "$(is "$(grep -c -- '--- npm ci failed (exit 1); retrying in 5s ---' "$TMP_ROOT/session-start-cloud-deps.log")" 1)"
check "npm fails once: local D1 migrations run once" "$(is "$(calls '^npx wrangler d1 migrations apply DB --local$')" 1)"
check "npm fails once: stdout is 3 lines" "$(is "$(printf '%s\n' "$out" | wc -l | tr -d '[:space:]')" 3)"

# 7. Local D1 migrations fail: exit 0, failure reported
proj=$(make_proj npx-fails)
run_hook "$proj" true 0 1
check "migrations fail: exit 0" "$(is "$rc" 0)"
check "migrations fail: npm ci reported done" "$(contains '- npm ci: done in ')"
check "migrations fail: failure reported" "$(contains 'local D1 migrations failed** (exit 1')"
check "migrations fail: says how to retry" "$(contains 'Run `npm run db:migrate` before `npm run dev`')"

echo
printf 'Result: %d passed, %d failed\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]]
