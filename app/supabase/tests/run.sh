#!/usr/bin/env bash
# Spin up a throwaway Postgres, apply the migrations, run the policy tests.
set -euo pipefail

# Whatever major version this machine happens to have. Pinning 16 meant the
# suite silently didn't run anywhere that shipped 17.
if [ -z "${PGBIN:-}" ]; then
  PGBIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)
fi
PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
if [ ! -x "$PGBIN/initdb" ]; then
  echo "No Postgres found. Set PGBIN to a directory containing initdb." >&2
  exit 1
fi

# initdb creates `postgres`; it does not create one named after the OS user,
# which is what psql would otherwise default to.
PSQL_DB=${PGDATABASE:-postgres}
DIR=$(mktemp -d)
HERE=$(cd "$(dirname "$0")" && pwd)

cleanup() { "$PGBIN/pg_ctl" -D "$DIR/data" stop -s -m immediate >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT

chmod 755 "$DIR"
"$PGBIN/initdb" -D "$DIR/data" -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$DIR/data" -o "-p 5433 -k $DIR" -l "$DIR/log" start >/dev/null
sleep 2

psql -h "$DIR" -p 5433 -U "$(whoami)" -d "$PSQL_DB" -q -v ON_ERROR_STOP=1 -f "$HERE/00_supabase_shim.sql"

# Supabase grants table-level privileges on everything in `public` to `anon`
# and `authenticated`, and sets default privileges so new tables get them too.
# The shim did not, which made the throwaway database more restrictive than
# production and hid a whole class of privilege bug: a column that production
# could not read looked fine here, because nothing could read anything here.
psql -h "$DIR" -p 5433 -U "$(whoami)" -d "$PSQL_DB" -q -v ON_ERROR_STOP=1 <<'GRANTS'
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables    to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
GRANTS
for m in $(ls "$HERE"/../migrations/*.sql | sort); do
  echo "applying $(basename "$m")"
  psql -h "$DIR" -p 5433 -U "$(whoami)" -d "$PSQL_DB" -q -v ON_ERROR_STOP=1 -f "$m"
done
for t in "$HERE"/[0-9][0-9]_*.sql; do
  case "$(basename "$t")" in 00_*) continue ;; esac
  echo ""; echo "### $(basename "$t")"
  psql -h "$DIR" -p 5433 -U "$(whoami)" -d "$PSQL_DB" -f "$t"
done
