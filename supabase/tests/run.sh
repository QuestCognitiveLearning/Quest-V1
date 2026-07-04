#!/usr/bin/env bash
# SQL test runner for the local Supabase stack (never prod).
#
#   supabase start            # once
#   ./supabase/tests/run.sh   # runs every *.test.sql in this directory
#
# Each test file must begin with `begin;` and end with `rollback;` so it
# leaves the scratch database untouched. Assertions are plpgsql `assert`
# statements inside `do` blocks — any failure aborts the file with a
# non-zero exit, and ON_ERROR_STOP makes that fail the run.
#
# DB_URL can be overridden, but defaults to the supabase-local port so it
# cannot accidentally point at production.
set -euo pipefail

DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

fail=0
for f in "$DIR"/*.test.sql; do
  name="$(basename "$f")"
  if psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null 2>"$DIR/.last_err"; then
    echo "ok   $name"
  else
    echo "FAIL $name"
    sed 's/^/     /' "$DIR/.last_err"
    fail=1
  fi
done
rm -f "$DIR/.last_err"
exit $fail
