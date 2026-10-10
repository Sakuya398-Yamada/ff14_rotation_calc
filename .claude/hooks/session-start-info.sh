#!/usr/bin/env bash
# SessionStart hook: prints a short status banner so Claude knows what the
# repository looks like at the start of a session (startup, resume, /clear and
# after compaction — no matcher is set in settings.json so it runs for all).
#
# Output goes to stdout. Claude Code adds it to Claude's context.
# Needs: git. The template update check additionally needs network access
# (silently skipped when offline; the result is cached for 24h under .git/).

set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

branch=$(git symbolic-ref --short -q HEAD 2>/dev/null || git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
short_status=$(git status --short 2>/dev/null | head -n 20 || true)
ahead_behind=$(git rev-list --left-right --count 'HEAD...@{upstream}' 2>/dev/null || echo "")

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

# --- Ghost worktree detection ---------------------------------------------
# Compare the launch cwd (Claude's project directory) against the registered
# worktree list. If the launch cwd lives under `.claude/worktrees/<name>/` but
# is NOT a registered worktree, warn the model: edits made via that path
# will silently land in a gitignored area.
launch_pwd="$PWD"
toplevel=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
worktree_paths=$(git worktree list --porcelain 2>/dev/null | awk '/^worktree / {print $2}')

# Normalize paths for comparison:
#   - backslash -> forward slash
#   - lowercase (Windows is case-insensitive; Git's output and bash's $PWD differ)
#   - strip trailing slash
#   - convert MSYS-style "/d/foo" -> "d:/foo" so it matches Git's "D:/foo" output
norm_path() {
  local p
  p=$(printf '%s' "$1" | tr '\\' '/' | tr '[:upper:]' '[:lower:]')
  p="${p%/}"
  if [[ "$p" =~ ^/([a-z])(/.*|$) ]]; then
    p="${BASH_REMATCH[1]}:${BASH_REMATCH[2]}"
  fi
  printf '%s' "$p"
}
n_orig=$(norm_path "$launch_pwd")
n_top=$(norm_path "$toplevel")

is_registered_worktree=0
while IFS= read -r wt; do
  [[ -z "$wt" ]] && continue
  n_wt=$(norm_path "$wt")
  if [[ "$n_orig" == "$n_wt" ]]; then
    is_registered_worktree=1
    break
  fi
done <<<"$worktree_paths"

# Always show registered worktrees (so the model can cross-check).
if [[ -n "$worktree_paths" ]]; then
  printf '\n## Git worktrees (registered)\n'
  while IFS= read -r wt; do
    [[ -z "$wt" ]] && continue
    printf -- '- `%s`\n' "$wt"
  done <<<"$worktree_paths"
fi

# Ghost detection: cwd lives under .claude/worktrees/<name>/ but is not in the list.
if [[ -n "$n_top" ]] \
   && [[ "$n_orig" != "$n_top" ]] \
   && [[ "$is_registered_worktree" -eq 0 ]] \
   && [[ "$n_orig" == *"/.claude/worktrees/"* ]]; then
  printf '\n## ⚠ Ghost worktree detected\n'
  printf -- '- Launch cwd: `%s`\n' "$launch_pwd"
  printf -- '- Main repo (git toplevel): `%s`\n' "$toplevel"
  printf -- '- This path looks like a worktree but is **not registered** (likely a leftover after `git worktree remove`).\n'
  printf -- '- Use the **main repo absolute path** for `Edit`/`Write` `file_path` and `gh ... --body-file <abs>` invocations. Edits to the launch cwd will land in a gitignored area and silently disappear.\n'
  printf -- '- For git operations, prefer `git -C "%s" ...` over relying on the current shell pwd.\n' "$toplevel"
fi

# --- Template update check -------------------------------------------------
# `.claude/template-version` holds the upstream template repo and the version
# this project has adopted. Compare it against the newest `v*` tag on the
# upstream repo and tell the model when a newer template release exists.
# Network failures are silent (offline is fine); the result is cached for 24h
# under the common git dir (shared by all worktrees) so the check does not slow
# down every session start.
tv_file="${toplevel:-.}/.claude/template-version"
if [[ -f "$tv_file" ]]; then
  tv_repo=$(sed -n 's/^repo=//p' "$tv_file" | head -n 1 | tr -d '[:space:]' || true)
  tv_local=$(sed -n 's/^version=//p' "$tv_file" | head -n 1 | tr -d '[:space:]' || true)
  if [[ -n "$tv_repo" && -n "$tv_local" ]]; then
    git_dir=$(git rev-parse --git-common-dir 2>/dev/null || echo ".git")
    cache="$git_dir/template-version-check"
    now=$(date +%s)
    cache_mtime=$(stat -c %Y "$cache" 2>/dev/null || stat -f %m "$cache" 2>/dev/null || echo 0)
    # version_newer <a> <b>: true when tag <a> sorts after tag <b> (sort -V).
    version_newer() { [[ "$1" != "$2" && "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -n 1)" == "$1" ]]; }
    latest=""
    if [[ -f "$cache" ]] && (( now - cache_mtime < 86400 )); then
      latest=$(tr -d '[:space:]' <"$cache" || true)
      # A cached tag older than the local version means the project adopted a
      # release after the cache was written (#367): treat it as stale and refetch
      # instead of waiting out the 24h, so a real newer release is not missed.
      if version_newer "$tv_local" "$latest"; then
        latest=""
      fi
    fi
    if [[ -z "$latest" ]]; then
      ls_remote=(git ls-remote --tags --refs --sort=-v:refname "https://github.com/${tv_repo}.git" 'v*')
      # `timeout --version` rather than `command -v timeout`: Git Bash on Windows also has
      # C:\Windows\System32\timeout.exe (an unrelated wait command) on PATH, which would
      # make the check fail silently and always report "Latest: unknown".
      if timeout --version >/dev/null 2>&1; then
        latest=$(timeout 8 "${ls_remote[@]}" 2>/dev/null | head -n 1 | awk -F/ '{print $NF}' || true)
      else
        latest=$("${ls_remote[@]}" 2>/dev/null | head -n 1 | awk -F/ '{print $NF}' || true)
      fi
      if [[ -n "$latest" ]]; then
        printf '%s\n' "$latest" >"$cache" 2>/dev/null || true
      fi
    fi

    printf '\n## Template version\n'
    if [[ -z "$latest" ]]; then
      printf -- '- Local: `%s` / Latest: unknown (offline or fetch failed) — skip the update check this session\n' "$tv_local"
    elif ! version_newer "$latest" "$tv_local"; then
      # Equal, or upstream older than local: never suggest a downgrade (#367).
      printf -- '- Local: `%s` / Latest: `%s` — up to date\n' "$tv_local" "$latest"
    else
      printf -- '- ⚠ **Template update available**: local `%s` → latest `%s` (`%s`)\n' "$tv_local" "$latest" "$tv_repo"
      printf -- '- Release notes: https://github.com/%s/releases/tag/%s\n' "$tv_repo" "$latest"
      printf -- '- Diff: https://github.com/%s/compare/%s...%s\n' "$tv_repo" "$tv_local" "$latest"
      printf -- '- `/issue-start` Phase 1 手順 0.5 で **一度だけ** ユーザーに更新用 Issue の起票を提案する（無人セッションでは実行報告に記載するだけ）。作業中の Issue のブランチでテンプレートを直接更新しない（1 Issue = 1 PR）\n'
    fi
  fi
fi

printf '\n## 行動原則リマインダー\n'
printf -- '- 仕様・設計の分岐のように「ユーザーが決めること」は質問し、コードや環境のように「調べれば分かること」は自分で調べる\n'
printf -- '- 探索・実装の節目で、把握したことと次の一手を 2〜3 行で共有する（回答を待って止まるのは Phase の確認ポイントだけ）\n'
printf -- '- 完了を報告する前にテスト・リント・動作確認で検証し、検証できなかった項目は明記する\n'

exit 0
