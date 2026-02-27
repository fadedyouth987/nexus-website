#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/nexus-app"
BACKEND_LOG="/tmp/ai_influencer_backend.log"
FRONTEND_LOG="/tmp/ai_influencer_frontend.log"

kill_port() {
  local port="$1"
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
  elif command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti "tcp:${port}" 2>/dev/null || true)"
    if [[ -n "${pids}" ]]; then
      kill -9 ${pids}
    fi
  fi
}

is_backend_up() {
  curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1
}

is_frontend_up() {
  curl -fsS http://127.0.0.1:3000 >/dev/null 2>&1
}

echo "[1/6] Normalizing backend DATABASE_URL in backend/.env ..."
if [[ -f "$BACKEND_DIR/.env" ]]; then
  sed -i -E 's#^DATABASE_URL=postgresql://#DATABASE_URL=postgresql+psycopg://#' "$BACKEND_DIR/.env"
  sed -i -E 's#^(DATABASE_URL=postgresql\\+psycopg://[^:]+:[^@]*)@@#\\1%40@#' "$BACKEND_DIR/.env"
fi

echo "[2/6] Running backend migrations ..."
cd "$BACKEND_DIR"
export DATABASE_URL="$(grep '^DATABASE_URL=' .env | cut -d= -f2-)"
DB_HOST="$(echo "$DATABASE_URL" | sed -E 's#.*@([^/:]+).*#\1#')"
if [[ -n "${DB_HOST:-}" ]] && ! getent hosts "$DB_HOST" >/dev/null 2>&1; then
  echo "[2/6] Could not resolve database host: $DB_HOST"
  echo "      Check internet/DNS and Supabase connection string in backend/.env"
  echo "      Current DATABASE_URL host is unreachable from this machine."
fi
set +e
MIGRATION_OUTPUT="$(../venv/bin/alembic upgrade head 2>&1)"
MIGRATION_STATUS=$?
set -e
if [[ $MIGRATION_STATUS -ne 0 ]]; then
  echo "$MIGRATION_OUTPUT"
  if command -v rg >/dev/null 2>&1; then
    RECOVERABLE="$(echo "$MIGRATION_OUTPUT" | rg -qi "already exists|DuplicateObject|relation .* already exists" && echo yes || echo no)"
  else
    RECOVERABLE="$(echo "$MIGRATION_OUTPUT" | grep -Eqi "already exists|DuplicateObject|relation .* already exists" && echo yes || echo no)"
  fi
  if [[ "$RECOVERABLE" == "yes" ]]; then
    echo "[2/6] Existing DB objects detected; stamping Alembic to head ..."
    ../venv/bin/alembic stamp head
  else
    if echo "$MIGRATION_OUTPUT" | grep -qi "failed to resolve host"; then
      echo ""
      echo "Supabase DNS lookup failed. Verify your machine can resolve:"
      echo "  $DB_HOST"
      echo "Then retry:"
      echo "  ./scripts/dev-start.sh"
    fi
    echo "[2/6] Migration failed with a non-recoverable error."
    exit "$MIGRATION_STATUS"
  fi
fi

echo "[3/6] Repairing backend users schema (if needed) ..."
../venv/bin/python scripts/repair_users_schema.py || true

echo "[4/6] Freeing stale processes on ports 8000 and 3000 ..."
pkill -f "uvicorn src.main:app --host 127.0.0.1 --port 8000" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
pkill -f "next/dist/bin/next dev" 2>/dev/null || true
kill_port 8000
kill_port 3000

echo "[5/6] Starting backend on http://127.0.0.1:8000 ..."
if is_backend_up; then
  BACKEND_PID="$(pgrep -f "uvicorn src.main:app --host 127.0.0.1 --port 8000" | head -n1 || true)"
  echo "Backend already running (pid: ${BACKEND_PID:-unknown})"
else
  : >"$BACKEND_LOG"
  nohup ../venv/bin/python -m uvicorn src.main:app --host 127.0.0.1 --port 8000 >"$BACKEND_LOG" 2>&1 &
  BACKEND_PID=$!
fi

echo "[6/6] Starting frontend on http://127.0.0.1:3000 ..."
cd "$FRONTEND_DIR"
if is_frontend_up; then
  FRONTEND_PID="$(pgrep -f "next dev -p 3000" | head -n1 || true)"
  echo "Frontend already running (pid: ${FRONTEND_PID:-unknown})"
else
  : >"$FRONTEND_LOG"
  nohup bash -lc "cd \"$FRONTEND_DIR\" && npm run dev -- -H 127.0.0.1" >"$FRONTEND_LOG" 2>&1 &
  FRONTEND_PID=$!
fi

for _ in $(seq 1 20); do
  if is_backend_up; then
    break
  fi
  sleep 0.5
done

if ! is_backend_up; then
  echo ""
  echo "Backend failed to become healthy on http://127.0.0.1:8000."
  echo "Last backend log lines:"
  tail -n 80 "$BACKEND_LOG" || true
  exit 1
fi

echo ""
echo "Started."
echo "Backend PID:  $BACKEND_PID  (log: $BACKEND_LOG)"
echo "Frontend PID: $FRONTEND_PID (log: $FRONTEND_LOG)"
echo ""
echo "Check status:"
echo "  curl http://127.0.0.1:8000/health"
echo "  open http://127.0.0.1:3000"
