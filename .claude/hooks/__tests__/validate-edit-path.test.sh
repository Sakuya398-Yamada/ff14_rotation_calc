#!/usr/bin/env bash
# Manual test for ../validate-edit-path.cjs
#
# Run: bash .claude/hooks/__tests__/validate-edit-path.test.sh
#
# These tests invoke the .cjs script directly (NOT the .sh wrapper) and inject
# the worktree list / project dir via env vars, so no real git worktree setup
# is required. A tmpdir sandbox is created to exercise the "twin file exists in
# worktree" condition.

set -u

HOOK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
JS="$HOOK_DIR/validate-edit-path.cjs"

if [[ ! -f "$JS" ]]; then
  printf 'cjs not found: %s\n' "$JS" >&2
  exit 1
fi

# Sandbox: <TMPROOT>/main is the "main repo", with a registered worktree
# under .claude/worktrees/wt1 and another sibling worktree wt2.
TMPROOT_RAW=$(mktemp -d 2>/dev/null) || TMPROOT_RAW="${TMPDIR:-/tmp}/validate-edit-path-test-$$"
mkdir -p "$TMPROOT_RAW"
trap 'rm -rf "$TMPROOT_RAW"' EXIT
# On Git Bash / MSYS, env vars containing a single path are auto-translated to
# Windows form when handed to a native binary like node.exe — but multi-line
# values (CLAUDE_HOOK_WT_LIST) are not, so the .cjs would see a mix of forms.
# Convert TMPROOT to a Windows-style absolute path up-front so all derived
# paths are consistent. Falls through unchanged on Linux/macOS where cygpath
# does not exist.
if command -v cygpath >/dev/null 2>&1; then
  TMPROOT=$(cygpath -m "$TMPROOT_RAW")
else
  TMPROOT="$TMPROOT_RAW"
fi

MAIN="$TMPROOT/main"
WT="$MAIN/.claude/worktrees/wt1"
WT2="$MAIN/.claude/worktrees/wt2"
mkdir -p "$WT/src" "$WT2"
echo "shared" > "$MAIN/shared.txt"
echo "shared" > "$WT/shared.txt"
echo "main-only" > "$MAIN/main-only.txt"

WT_LIST="$MAIN
$WT
$WT2"

pass=0
fail=0

build_payload() {
  # $1 = tool_name, $2 = file_path
  node -e 'process.stdout.write(JSON.stringify({tool_name:process.argv[1], tool_input:{file_path:process.argv[2]}}))' "$1" "$2"
}

run_case() {
  # $1=name $2=expected_exit $3=tool_name $4=file_path $5=proj_dir
  #   [optional env via prefix vars: ALLOW=1 / WT_LIST_OVERRIDE="..."]
  local name="$1" expected="$2" tool_name="$3" file_path="$4" proj_dir="$5"
  local allow="${ALLOW:-0}"
  local wt_override="${WT_LIST_OVERRIDE-}"
  local payload exit_code
  payload=$(build_payload "$tool_name" "$file_path")
  local effective_wt
  if [[ -n "${wt_override:-}" ]] || [[ -n "${WT_LIST_OVERRIDE+x}" ]]; then
    effective_wt="$wt_override"
  else
    effective_wt="$WT_LIST"
  fi
  set +e
  CLAUDE_HOOK_PROJ_DIR="$proj_dir" \
    CLAUDE_HOOK_WT_LIST="$effective_wt" \
    CLAUDE_ALLOW_MAIN_REPO_EDIT="$allow" \
    node "$JS" >/dev/null 2>&1 <<<"$payload"
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

printf -- '--- validate-edit-path.cjs tests ---\n'

# 1) Non-target tool → ignored
run_case "Bash tool ignored" 0 "Bash" "$MAIN/shared.txt" "$WT"

# 2) Empty file_path → ignored
run_case "empty file_path ignored" 0 "Edit" "" "$WT"

# 3) Working in main repo (proj_dir == main, not a worktree match) → no warn
run_case "working in main repo (no warn)" 0 "Edit" "$MAIN/shared.txt" "$MAIN"

# 4) Working in worktree, file_path INSIDE worktree → correct usage, no warn
run_case "file_path inside current worktree" 0 "Edit" "$WT/shared.txt" "$WT"

# 5) Main-only file (no twin in worktree) → no warn (intentional main-only edit)
run_case "main-only file (no twin)" 0 "Edit" "$MAIN/main-only.txt" "$WT"

# 6) PRIMARY: file_path inside main, twin EXISTS in current worktree → warn
run_case "PRIMARY: main path with twin in worktree (warn)" 1 "Edit" "$MAIN/shared.txt" "$WT"

# 7) PRIMARY repeated for the Write tool
run_case "PRIMARY (Write tool)" 1 "Write" "$MAIN/shared.txt" "$WT"

# 8) file_path lives inside another registered worktree (.claude/worktrees/<other>/) → out of scope
run_case "another worktree path (out of scope)" 0 "Edit" "$MAIN/.claude/worktrees/wt2/foo.txt" "$WT"

# 9) Unrelated path on a different filesystem prefix → out of scope
run_case "unrelated path (out of scope)" 0 "Edit" "/some/other/path/foo.txt" "$WT"

# 10) Opt-out env var → no warn even for the primary case
ALLOW=1 run_case "opt-out via CLAUDE_ALLOW_MAIN_REPO_EDIT=1" 0 "Edit" "$MAIN/shared.txt" "$WT"

# 11) Backslash-style file_path (Windows path) → still detected via normalization
backslash_path=$(printf '%s' "$MAIN/shared.txt" | tr '/' '\\')
run_case "backslash file_path detected" 1 "Edit" "$backslash_path" "$WT"

# 12) Empty worktree list → exit 0 (defensive: not in a git context)
WT_LIST_OVERRIDE="" run_case "empty worktree list" 0 "Edit" "$MAIN/shared.txt" "$WT"

# 13) Worktree-only list (no main entry would be the same as main being the only entry)
#     — single-entry list means the project dir matches main with no extra worktrees,
#     so even a path inside the only entry is considered "working in main", no warn.
WT_LIST_OVERRIDE="$MAIN" run_case "single-entry worktree list = main only" 0 "Edit" "$MAIN/shared.txt" "$MAIN"

# 14) Mixed-case file_path on Windows: file_path uses the same path with different case
#     — should still detect because comparison is case-insensitive
mixed_path=$(printf '%s' "$MAIN/Shared.txt")
# Only meaningful when the actual file exists case-insensitively (Windows). On case-sensitive FS,
# fs.accessSync would fail and we'd exit 0 silently. Skip strict assertion.
set +e
CLAUDE_HOOK_PROJ_DIR="$WT" CLAUDE_HOOK_WT_LIST="$WT_LIST" \
  node "$JS" >/dev/null 2>&1 <<<"$(build_payload "Edit" "$mixed_path")"
mixed_exit=$?
set -e
case "$(uname -s 2>/dev/null || echo unknown)" in
  MINGW*|MSYS*|CYGWIN*)
    if [[ "$mixed_exit" == "1" ]]; then
      printf '  [PASS] mixed-case path detected on Windows (exit=%d)\n' "$mixed_exit"
      pass=$((pass+1))
    else
      printf '  [FAIL] mixed-case path detection on Windows (expected exit=1, got %d)\n' "$mixed_exit"
      fail=$((fail+1))
    fi
    ;;
  *)
    # Case-sensitive FS (Linux/Mac): twin lookup fails → exit 0 is acceptable
    printf '  [SKIP] mixed-case path test (case-sensitive FS, exit=%d)\n' "$mixed_exit"
    ;;
esac

printf '\nResults: %d pass, %d fail\n' "$pass" "$fail"
[[ $fail -eq 0 ]]
