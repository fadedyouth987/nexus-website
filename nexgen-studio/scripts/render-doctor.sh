#!/usr/bin/env bash
set -euo pipefail

# Checks whether a Render backend URL is serving this FastAPI app correctly.
#
# Usage:
#   RENDER_BACKEND_URL=https://ai-backend.onrender.com ./scripts/render-doctor.sh
# or:
#   ./scripts/render-doctor.sh https://ai-backend.onrender.com

URL="${RENDER_BACKEND_URL:-${1:-}}"
if [[ -z "$URL" ]]; then
  echo "Usage: RENDER_BACKEND_URL=https://your-service.onrender.com ./scripts/render-doctor.sh"
  exit 1
fi

URL="${URL%/}"

echo "[1/3] Checking ${URL}/health ..."
HEALTH_CODE="$(curl -sS -o /tmp/render_health_body.txt -w "%{http_code}" "${URL}/health" || true)"
echo "HTTP ${HEALTH_CODE}"
cat /tmp/render_health_body.txt || true
echo ""

echo "[2/3] Checking ${URL}/docs ..."
DOCS_CODE="$(curl -sS -o /tmp/render_docs_body.txt -w "%{http_code}" "${URL}/docs" || true)"
echo "HTTP ${DOCS_CODE}"
head -c 300 /tmp/render_docs_body.txt || true
echo ""
echo ""

echo "[3/3] Diagnosis ..."
if [[ "$HEALTH_CODE" == "200" ]]; then
  echo "OK: Render backend is serving FastAPI correctly."
  exit 0
fi

if [[ "$HEALTH_CODE" == "404" ]]; then
  cat <<'EOF'
FAIL: /health is 404. Most likely Render is not running backend/src.main:app.
Verify Render settings:
  - Root Directory: backend
  - Build Command: pip install -r requirements.txt && alembic upgrade head
  - Start Command: uvicorn src.main:app --host 0.0.0.0 --port $PORT
Then redeploy.
EOF
  exit 2
fi

if [[ "$HEALTH_CODE" == "000" ]]; then
  cat <<'EOF'
FAIL: Could not connect to Render URL.
Check service URL, deployment status, and public accessibility.
EOF
  exit 3
fi

cat <<EOF
FAIL: Unexpected /health response code ${HEALTH_CODE}.
Inspect Render logs for startup/runtime errors.
EOF
exit 4
