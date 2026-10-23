#!/usr/bin/env bash
# Exports the production D1 database to a gzipped SQL file and keeps the newest 30 of them.
# Runs once a day from cron on the home server; setup, the API token's permissions and the
# restore steps are in docs/d1-backup.md.
#
# Needs: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in the environment, gzip, and
# `npm ci` done in this repository (wrangler comes from its node_modules). The database is
# named by its binding DB, so wrangler takes the ID from wrangler.jsonc: no lookup permission
# is needed, and the backup follows the config if a restore switches it to a new database.
# D1_BACKUP_DIR sets where the files go.

set -euo pipefail
umask 077 # the dump holds every row, and wrangler's log line carries a download URL

: "${CLOUDFLARE_API_TOKEN:?is not set}"
: "${CLOUDFLARE_ACCOUNT_ID:?is not set}"

readonly PREFIX="ff14-rotation-calc"
readonly KEEP=30
backup_dir="${D1_BACKUP_DIR:-$HOME/backups/ff14-rotation-calc-d1}"

cd "$(dirname "$0")/.."
mkdir -p "$backup_dir"

# UTC, so the names sort by time whatever the server's time zone (no colons, for copies to Windows)
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
sql="$backup_dir/.${PREFIX}-${stamp}.sql"
out="$backup_dir/${PREFIX}-${stamp}.sql.gz"
trap 'rm -f "$sql" "$out.part"' EXIT

# -y: a remote export otherwise asks for confirmation, since it blocks other queries while it runs
./node_modules/.bin/wrangler d1 export DB --remote -y --output "$sql"
if [[ ! -s "$sql" ]]; then
	echo "d1-backup: the export is empty; keeping the old backups" >&2
	exit 1
fi
gzip -c "$sql" >"$out.part"
mv "$out.part" "$out"

# Prune only after a good export, so a run of failed days never eats the old generations
printf '%s\0' "$backup_dir/$PREFIX"-*.sql.gz | sort -z | head -z -n -"$KEEP" | xargs -0 -r rm -f --
echo "d1-backup: saved $out"
