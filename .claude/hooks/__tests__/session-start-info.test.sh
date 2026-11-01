#!/usr/bin/env bash
# Manual test for the "Template update check" block of ../session-start-info.sh
#
# Run: bash .claude/hooks/__tests__/session-start-info.test.sh
#
# Each case runs the hook against a throwaway git repo (CLAUDE_PROJECT_DIR).
# `git ls-remote` is stubbed by a `git` wrapper placed first on PATH; every
# other git subcommand is delegated to the real git. The stub's output and exit
# code come from STUB_LS_REMOTE_OUT / STUB_LS_REMOTE_EXIT, and every ls-remote
# call is appended to STUB_LS_REMOTE_LOG so the number of upstream queries can be
# asserted (the hook queries upstream on every run and uses the cache only when the
# query fails, issue-driven-dev-starter#61).

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
check "up to date: no cached mark when fetched" "$(lacks '(cached ')"

TAGS_V210=$'0123456789abcdef0123456789abcdef01234567\trefs/tags/v2.1.0'

# 2. Online, upstream always wins over a fresh cache (issue-driven-dev-starter#61: a cache
#    written before a new release reported `up to date` for up to 24h)
run_hook "$repo" "$TAGS_V210" 0
check "fresh cache, remote newer: warning shown" "$(contains '⚠ **Template update available**: Local `v2.0.0` → Latest `v2.1.0`')"
check "fresh cache, remote newer: queried upstream again" "$([[ $(ls_remote_calls) -eq 2 ]] && echo 1 || echo 0)"
check "fresh cache, remote newer: cache refreshed" "$([[ "$(tr -d '[:space:]' <"$repo/.git/template-version-check")" == "v2.1.0" ]] && echo 1 || echo 0)"

# 2b. Offline: the last fetched tag is the fallback, and the banner marks it as cached
printf 'v2.0.0\n' >"$repo/.git/template-version-check"
run_hook "$repo" "" 128
check "offline with cache: up to date from cache" "$(contains 'Local: `v2.0.0` / Latest: `v2.0.0` (cached ')"
check "offline with cache: cached mark says the fetch failed" "$(contains 'h ago; fetch failed, may miss newer releases) — up to date')"
check "offline with cache: upstream was still tried" "$([[ $(ls_remote_calls) -eq 3 ]] && echo 1 || echo 0)"

# 3. Update available
rm -f "$TMP_ROOT/ls-remote.log"
repo=$(make_repo outdated v1.0.0)
run_hook "$repo" "$TAGS_V2" 0
check "update: exit 0" "$([[ $rc -eq 0 ]] && echo 1 || echo 0)"
check "update: warning shown" "$(contains '⚠ **Template update available**: Local `v1.0.0` → Latest `v2.0.0`')"
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

TAGS_V201=$'0123456789abcdef0123456789abcdef01234567\trefs/tags/v2.0.1'

# 6. Stale cache (cached < local, e.g. the project adopted a newer release
#    while a fresh cache still held the previous tag, #367): the cache is
#    ignored, upstream is queried again, and no update is reported
rm -f "$TMP_ROOT/ls-remote.log"
repo=$(make_repo stalecache v2.0.1)
printf 'v2.0.0\n' >"$repo/.git/template-version-check"
run_hook "$repo" "$TAGS_V201" 0
check "stale cache: exit 0" "$([[ $rc -eq 0 ]] && echo 1 || echo 0)"
check "stale cache: no update warning" "$(lacks 'Template update available')"
check "stale cache: up to date with refetched tag" "$(contains 'Local: `v2.0.1` / Latest: `v2.0.1` — up to date')"
check "stale cache: refetched from upstream" "$([[ $(ls_remote_calls) -eq 1 ]] && echo 1 || echo 0)"
check "stale cache: cache refreshed" "$([[ "$(tr -d '[:space:]' <"$repo/.git/template-version-check")" == "v2.0.1" ]] && echo 1 || echo 0)"

# 7. Stale cache and the refetch fails: unknown, never a downgrade warning
rm -f "$TMP_ROOT/ls-remote.log"
repo=$(make_repo stalecache-offline v2.0.1)
printf 'v2.0.0\n' >"$repo/.git/template-version-check"
run_hook "$repo" "" 128
check "stale cache offline: exit 0" "$([[ $rc -eq 0 ]] && echo 1 || echo 0)"
check "stale cache offline: Latest unknown" "$(contains 'Local: `v2.0.1` / Latest: unknown')"
check "stale cache offline: no update warning" "$(lacks 'Template update available')"

# 8. Cache newer than local and offline: update reported from the cache, marked as cached
rm -f "$TMP_ROOT/ls-remote.log"
repo=$(make_repo newercache v1.0.0)
printf 'v2.0.0\n' >"$repo/.git/template-version-check"
run_hook "$repo" "" 128
check "newer cache offline: warning shown" "$(contains '⚠ **Template update available**: Local `v1.0.0` → Latest `v2.0.0`')"
check "newer cache offline: cached mark" "$(contains '(cached ')"
check "newer cache offline: upstream was still tried" "$([[ $(ls_remote_calls) -eq 1 ]] && echo 1 || echo 0)"

# 8b. Cache newer than upstream while online (e.g. a release was withdrawn): upstream wins
rm -f "$TMP_ROOT/ls-remote.log"
repo=$(make_repo newercache-online v2.0.1)
printf 'v2.1.0\n' >"$repo/.git/template-version-check"
run_hook "$repo" "$TAGS_V201" 0
check "newer cache online: up to date with the fetched tag" "$(contains 'Local: `v2.0.1` / Latest: `v2.0.1` — up to date')"
check "newer cache online: no update warning" "$(lacks 'Template update available')"
check "newer cache online: cache refreshed" "$([[ "$(tr -d '[:space:]' <"$repo/.git/template-version-check")" == "v2.0.1" ]] && echo 1 || echo 0)"

# 9. Upstream itself is older than local (e.g. a pre-release adopter): no warning
rm -f "$TMP_ROOT/ls-remote.log"
repo=$(make_repo aheadoflatest v2.0.1)
run_hook "$repo" "$TAGS_V2" 0
check "local ahead: no update warning" "$(lacks 'Template update available')"
check "local ahead: shown as up to date" "$(contains 'Local: `v2.0.1` / Latest: `v2.0.0` — up to date')"

# The default branch's version (origin/HEAD -> origin/main) also counts as adopted: a worktree
# whose branch is merely behind the default branch must not prompt for a duplicate update issue.
# make_repo_with_default <name> <branch version> <default-branch version>  -> prints repo path.
# Commits .claude/template-version at the default version, points origin/main and origin/HEAD at
# that commit, then leaves the working-tree file at the branch version (what the hook reads).
make_repo_with_default() {
  local dir
  dir=$(make_repo "$1" "$3")
  "$REAL_GIT" -C "$dir" add .claude/template-version
  "$REAL_GIT" -C "$dir" -c user.name=t -c user.email=t@example.com commit -q -m "default at $3"
  "$REAL_GIT" -C "$dir" update-ref refs/remotes/origin/main HEAD
  "$REAL_GIT" -C "$dir" symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/main
  printf 'repo=example-owner/example-template\nversion=%s\n' "$2" >"$dir/.claude/template-version"
  printf '%s' "$dir"
}

cache_is() { [[ "$(tr -d '[:space:]' <"$repo/.git/template-version-check")" == "$1" ]] && echo 1 || echo 0; }

TAGS_V203=$'0123456789abcdef0123456789abcdef01234567\trefs/tags/v2.0.3'

# 10. Branch behind the default branch, which already has the latest: adopted, no warning
rm -f "$TMP_ROOT/ls-remote.log"
repo=$(make_repo_with_default behind-default-latest v2.0.2 v2.0.3)
run_hook "$repo" "$TAGS_V203" 0
check "behind default (default == latest): exit 0" "$([[ $rc -eq 0 ]] && echo 1 || echo 0)"
check "behind default (default == latest): up to date on the default branch" "$(contains 'Local: `v2.0.2` (this branch) / `origin/main`: `v2.0.3` / Latest: `v2.0.3` — up to date on the default branch; this branch is behind it')"
check "behind default (default == latest): no update warning" "$(lacks 'Template update available')"
check "behind default (default == latest): cache written" "$(cache_is v2.0.3)"

# 11. Branch behind the default branch, latest newer than both: warning as before
rm -f "$TMP_ROOT/ls-remote.log"
repo=$(make_repo_with_default behind-default-outdated v2.0.2 v2.0.3)
run_hook "$repo" "$TAGS_V210" 0
check "behind default, latest newer: warning shown" "$(contains '⚠ **Template update available**: Local `v2.0.2` → Latest `v2.1.0`')"
check "behind default, latest newer: default branch version noted" "$(contains '`origin/main` is at `v2.0.3` (this branch is behind it)')"

# 12. Branch == default branch, latest newer: warning as before, no "behind" note
rm -f "$TMP_ROOT/ls-remote.log"
repo=$(make_repo_with_default same-as-default v2.0.3 v2.0.3)
run_hook "$repo" "$TAGS_V210" 0
check "branch == default: warning shown" "$(contains '⚠ **Template update available**: Local `v2.0.3` → Latest `v2.1.0`')"
check "branch == default: no behind note" "$(lacks 'this branch is behind it')"

# 13. Cache older than the default branch's version, online: fetched from upstream
rm -f "$TMP_ROOT/ls-remote.log"
repo=$(make_repo_with_default behind-default-stalecache v2.0.2 v2.0.3)
printf 'v2.0.2\n' >"$repo/.git/template-version-check"
run_hook "$repo" "$TAGS_V203" 0
check "behind default, stale cache: refetched from upstream" "$([[ $(ls_remote_calls) -eq 1 ]] && echo 1 || echo 0)"
check "behind default, stale cache: up to date on the default branch" "$(contains 'up to date on the default branch')"
check "behind default, stale cache: cache refreshed" "$(cache_is v2.0.3)"

# 13b. Cache older than the default branch's version, offline: the cache says nothing useful
rm -f "$TMP_ROOT/ls-remote.log"
repo=$(make_repo_with_default behind-default-stalecache-offline v2.0.2 v2.0.3)
printf 'v2.0.2\n' >"$repo/.git/template-version-check"
run_hook "$repo" "" 128
check "behind default, stale cache offline: Latest unknown" "$(contains 'Local: `v2.0.2` / Latest: unknown')"
check "behind default, stale cache offline: no update warning" "$(lacks 'Template update available')"

# 14. Branch behind the default branch and offline: unknown, no warning
rm -f "$TMP_ROOT/ls-remote.log"
repo=$(make_repo_with_default behind-default-offline v2.0.2 v2.0.3)
run_hook "$repo" "" 128
check "behind default offline: Latest unknown" "$(contains 'Local: `v2.0.2` / Latest: unknown')"
check "behind default offline: no update warning" "$(lacks 'Template update available')"

# 15. Branch ahead of the default branch: judged by this branch alone
rm -f "$TMP_ROOT/ls-remote.log"
repo=$(make_repo_with_default ahead-of-default v2.0.3 v2.0.2)
run_hook "$repo" "$TAGS_V203" 0
check "ahead of default: up to date" "$(contains 'Local: `v2.0.3` / Latest: `v2.0.3` — up to date')"
check "ahead of default: not reported via the default branch" "$(lacks 'on the default branch')"

echo
printf 'Result: %d passed, %d failed\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]]
