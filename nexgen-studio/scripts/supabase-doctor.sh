#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

cd "$BACKEND_DIR"

if [[ ! -f ".env" ]]; then
  echo "Missing backend/.env"
  exit 1
fi

DATABASE_URL="$(grep '^DATABASE_URL=' .env | cut -d= -f2- || true)"
SUPABASE_URL="$(grep '^SUPABASE_URL=' .env | cut -d= -f2- || true)"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Missing DATABASE_URL in backend/.env"
  exit 1
fi

DB_HOST="$(echo "$DATABASE_URL" | sed -E 's#.*@([^/:]+).*#\1#')"
DB_PORT="$(echo "$DATABASE_URL" | sed -nE 's#.*:([0-9]+)/.*#\1#p')"
DB_PORT="${DB_PORT:-5432}"

echo "[1/5] Checking Supabase URL..."
if [[ -z "${SUPABASE_URL:-}" ]]; then
  echo "WARN: SUPABASE_URL not set"
else
  echo "OK: SUPABASE_URL is set"
fi

echo "[2/5] Checking database host DNS..."
if getent hosts "$DB_HOST" >/dev/null 2>&1; then
  echo "OK: DNS resolved for $DB_HOST"
else
  echo "ERROR: DNS failed for $DB_HOST"
  echo "Fix local DNS/network first, then rerun this script."
  exit 2
fi

echo "[3/5] Checking database TCP reachability..."
if command -v nc >/dev/null 2>&1; then
  if nc -z -w 3 "$DB_HOST" "$DB_PORT"; then
    echo "OK: TCP connection to $DB_HOST:$DB_PORT works"
  else
    echo "ERROR: Cannot connect to $DB_HOST:$DB_PORT"
    exit 3
  fi
else
  echo "WARN: nc not installed; skipping TCP port check"
fi

echo "[4/5] Running Alembic migration check..."
export DATABASE_URL
set +e
../venv/bin/alembic upgrade head >/tmp/ai_influencer_alembic_doctor.log 2>&1
ALEMBIC_STATUS=$?
set -e
if [[ $ALEMBIC_STATUS -ne 0 ]]; then
  echo "ERROR: Alembic upgrade failed (see /tmp/ai_influencer_alembic_doctor.log)"
  tail -n 60 /tmp/ai_influencer_alembic_doctor.log || true
  exit 4
fi
echo "OK: Alembic migration is up to date"

echo "[5/5] Running backend schema repair..."
../venv/bin/python scripts/repair_users_schema.py
echo "OK: Supabase doctor checks completed"
