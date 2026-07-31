#!/usr/bin/env bash
# Spin up a throwaway Postgres, apply the migrations, run the policy tests.
set -euo pipefail

PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
DIR=$(mktemp -d)
HERE=$(cd "$(dirname "$0")" && pwd)

cleanup() { "$PGBIN/pg_ctl" -D "$DIR/data" stop -s -m immediate >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT

chmod 755 "$DIR"
"$PGBIN/initdb" -D "$DIR/data" -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$DIR/data" -o "-p 5433 -k $DIR" -l "$DIR/log" start >/dev/null
sleep 2

psql -h "$DIR" -p 5433 -U "$(whoami)" -q -v ON_ERROR_STOP=1 -f "$HERE/00_supabase_shim.sql"
for m in $(ls "$HERE"/../migrations/*.sql | sort); do
  echo "applying $(basename "$m")"
  psql -h "$DIR" -p 5433 -U "$(whoami)" -q -v ON_ERROR_STOP=1 -f "$m"
done
psql -h "$DIR" -p 5433 -U "$(whoami)" -f "$HERE/01_rls.sql"
