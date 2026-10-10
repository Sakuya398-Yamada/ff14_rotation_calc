#!/usr/bin/env bash
# Manual test for the "Template update check" block of ../session-start-info.sh
#
# Run: bash .claude/hooks/__tests__/session-start-info.test.sh
#
# Each case runs the hook against a throwaway git repo (CLAUDE_PROJECT_DIR).
# `git ls-remote` is stubbed by a `git` wrapper placed first on PATH; every
# other git subcommand is delegated to the real git. The stub's output and exit
# code come from STUB_LS_REMOTE_OUT / STUB_LS_REMOTE_EXIT, and every ls-remote
# call is appended to STUB_LS_REMOTE_LOG so the 24h cache can be asserted.

set -u

HOOK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$HOOK_DIR/session-start-info.sh"

if [[ ! -f "$HOOK" ]]; then
  printf 'hook not found: %s\n' "$HOOK" >&2
  exit 1
fi

REAL_GIT="$(command -v git)"
TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

STUB_BIN="$TMP_ROOT/bin"
mkdir -p "$STUB_BIN"
cat >"$STUB_BIN/git" <<EOF
#!/usr/bin/env bash
if [[ "\${1:-}" == "ls-remote" ]]; then
  printf '%s\n' "\$*" >>"\$STUB_LS_REMOTE_LOG"
  if [[ -n "\${STUB_LS_REMOTE_OUT:-}" ]]; then
    printf '%s\n' "\$STUB_LS_REMOTE_OUT"
  fi
  exit "\${STUB_LS_REMOTE_EXIT:-0}"
fi
exec "$REAL_GIT" "\$@"
EOF
chmod +x "$STUB_BIN/git"

pass=0
fail=0

# make_repo <name> [version]  -> prints repo path. Without version, no template-version file.
make_repo() {
  local dir="$TMP_ROOT/$1" version="${2:-}"
  mkdir -p "$dir/.claude"
  "$REAL_GIT" init -q "$dir"
  if [[ -n "$version" ]]; then
    printf 'repo=example-owner/example-template\nversion=%s\n' "$version" >"$dir/.claude/template-version"
  fi
  printf '%s' "$dir"
}

# run_hook <repo> <ls-remote stdout> <ls-remote exit>  -> sets $out, $rc
run_hook() {
  local repo="$1"
  set +e
  out=$(cd "$repo" && CLAUDE_PROJECT_DIR="$repo" PATH="$STUB_BIN:$PATH" \
    STUB_LS_REMOTE_OUT="$2" STUB_LS_REMOTE_EXIT="$3" STUB_LS_REMOTE_LOG="$TMP_ROOT/ls-remote.log" \
    bash "$HOOK" 2>&1)
  rc=$?
  set -e
}

ls_remote_calls() {
  if [[ -f "$TMP_ROOT/ls-remote.log" ]]; then
    wc -l <"$TMP_ROOT/ls-remote.log" | tr -d '[:space:]'
  else
    printf '0'
  fi
}

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

TAGS_V2=$'0123456789abcdef0123456789abcdef01234567\trefs/tags/v2.0.0'

echo "## session-start-info.sh: Template update check"

# 1. Up to date
rm -f "$TMP_ROOT/ls-remote.log"
repo=$(make_repo uptodate v2.0.0)
run_hook "$repo" "$TAGS_V2" 0
check "up to date: exit 0" "$([[ $rc -eq 0 ]] && echo 1 || echo 0)"
check "up to date: banner shows up to date" "$(contains 'Local: `v2.0.0` / Latest: `v2.0.0` — up to date')"
check "up to date: no update warning" "$(lacks 'Template update available')"
check "up to date: queried upstream once" "$([[ $(ls_remote_calls) -eq 1 ]] && echo 1 || echo 0)"

# 2. Cache hit: the second run within 24h must not touch the network
run_hook "$repo" "" 128
check "cache: second run still up to date" "$(contains 'Latest: `v2.0.0` — up to date')"
check "cache: no ls-remote on second run" "$([[ $(ls_remote_calls) -eq 1 ]] && echo 1 || echo 0)"

# 3. Update available
rm -f "$TMP_ROOT/ls-remote.log"
repo=$(make_repo outdated v1.0.0)
run_hook "$repo" "$TAGS_V2" 0
check "update: exit 0" "$([[ $rc -eq 0 ]] && echo 1 || echo 0)"
check "update: warning shown" "$(contains '⚠ **Template update available**: local `v1.0.0` → latest `v2.0.0`')"
check "update: release notes URL" "$(contains 'https://github.com/example-owner/example-template/releases/tag/v2.0.0')"
check "update: compare URL" "$(contains 'https://github.com/example-owner/example-template/compare/v1.0.0...v2.0.0')"

# 4. No template-version file: the section is skipped entirely
rm -f "$TMP_ROOT/ls-remote.log"
repo=$(make_repo nofile)
run_hook "$repo" "$TAGS_V2" 0
check "no file: exit 0" "$([[ $rc -eq 0 ]] && echo 1 || echo 0)"
check "no file: no Template version section" "$(lacks '## Template version')"
check "no file: no ls-remote" "$([[ $(ls_remote_calls) -eq 0 ]] && echo 1 || echo 0)"

# 5. Fetch failure (offline): unknown, hook keeps going, nothing cached
rm -f "$TMP_ROOT/ls-remote.log"
repo=$(make_repo offline v2.0.0)
run_hook "$repo" "" 128
check "offline: exit 0" "$([[ $rc -eq 0 ]] && echo 1 || echo 0)"
check "offline: Latest unknown" "$(contains 'Local: `v2.0.0` / Latest: unknown')"
check "offline: rest of banner still printed" "$(contains '## 行動原則リマインダー')"
check "offline: failure is not cached" "$([[ ! -f "$repo/.git/template-version-check" ]] && echo 1 || echo 0)"

echo
printf 'Result: %d passed, %d failed\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]]
