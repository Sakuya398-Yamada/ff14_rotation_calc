#!/usr/bin/env bash
# SessionStart hook (matcher: startup|resume): installs the project's dependencies in
# Claude Code cloud sessions, whose containers start from a fresh clone. Local sessions
# exit at once so an existing node_modules is never reinstalled.
#
# Output goes to stdout as a short banner (Claude Code adds it to Claude's context);
# npm / npx output goes to a log file instead. Failures are reported on stdout and the
# hook still exits 0, because a non-zero exit would only show stderr to the user.
# Needs: npm, network access to the npm registry.

set -uo pipefail

[[ "${CLAUDE_CODE_REMOTE:-}" == "true" ]] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

log="${TMPDIR:-/tmp}/session-start-cloud-deps.log"
: >"$log"

# report_failure <step> <exit code>
report_failure() {
  printf -- '- ⚠ **%s failed** (exit %s; log: `%s`). Run it again before `npm test`. Last lines of the log:\n' "$1" "$2" "$log"
  printf '```\n%s\n```\n' "$(tail -n 15 "$log")"
}

printf '## Cloud setup\n'

# npm writes node_modules/.package-lock.json at the end of an install. Skip only when
# it exists and is not older than package-lock.json (an interrupted install or a lock
# changed by a checkout since the last install both run npm ci again).
marker=node_modules/.package-lock.json
if [[ -f "$marker" && ! package-lock.json -nt "$marker" ]]; then
  printf -- '- npm ci: skipped (node_modules matches package-lock.json)\n'
else
  SECONDS=0
  npm ci --no-audit --no-fund >>"$log" 2>&1
  rc=$?
  if (( rc != 0 )); then
    report_failure "npm ci" "$rc"
    exit 0
  fi
  printf -- '- npm ci: done in %ss\n' "$SECONDS"
fi

# Always regenerate (about 2s) so a schema change since the last run is not missed.
npx prisma generate >>"$log" 2>&1
rc=$?
if (( rc == 0 )); then
  printf -- '- prisma generate: done\n'
else
  report_failure "prisma generate" "$rc"
fi
exit 0
