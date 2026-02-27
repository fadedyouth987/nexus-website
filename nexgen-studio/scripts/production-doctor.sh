#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ENV="$ROOT_DIR/backend/.env"
FRONTEND_ENV="$ROOT_DIR/nexus-app/.env.local"

ok() { echo "OK: $*"; }
warn() { echo "WARN: $*"; }
err() { echo "ERROR: $*"; }

read_env_var() {
  local file="$1"
  local key="$2"
  if [[ ! -f "$file" ]]; then
    return 0
  fi
  grep -E "^${key}=" "$file" | head -n1 | cut -d= -f2- || true
}

require_nonempty() {
  local name="$1"
  local value="$2"
  if [[ -z "${value:-}" ]]; then
    err "Missing $name"
    return 1
  fi
  ok "$name is set"
  return 0
}

echo "[1/6] Loading environment files..."
if [[ ! -f "$BACKEND_ENV" ]]; then
  err "Missing backend/.env"
  exit 1
fi
if [[ ! -f "$FRONTEND_ENV" ]]; then
  err "Missing nexus-app/.env.local"
  exit 1
fi
ok "Env files found"

DATABASE_URL="$(read_env_var "$BACKEND_ENV" "DATABASE_URL")"
SUPABASE_URL="$(read_env_var "$BACKEND_ENV" "SUPABASE_URL")"
SUPABASE_ANON_KEY="$(read_env_var "$BACKEND_ENV" "SUPABASE_ANON_KEY")"
NEXT_PUBLIC_SUPABASE_URL="$(read_env_var "$FRONTEND_ENV" "NEXT_PUBLIC_SUPABASE_URL")"
NEXT_PUBLIC_SUPABASE_ANON_KEY="$(read_env_var "$FRONTEND_ENV" "NEXT_PUBLIC_SUPABASE_ANON_KEY")"
NEXT_PUBLIC_API_URL="$(read_env_var "$FRONTEND_ENV" "NEXT_PUBLIC_API_URL")"

echo "[2/6] Validating required app settings..."
FAIL=0
require_nonempty "DATABASE_URL" "$DATABASE_URL" || FAIL=1
require_nonempty "SUPABASE_URL" "$SUPABASE_URL" || FAIL=1
require_nonempty "SUPABASE_ANON_KEY" "$SUPABASE_ANON_KEY" || FAIL=1
require_nonempty "NEXT_PUBLIC_SUPABASE_URL" "$NEXT_PUBLIC_SUPABASE_URL" || FAIL=1
require_nonempty "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$NEXT_PUBLIC_SUPABASE_ANON_KEY" || FAIL=1
require_nonempty "NEXT_PUBLIC_API_URL" "$NEXT_PUBLIC_API_URL" || FAIL=1
if [[ $FAIL -ne 0 ]]; then
  exit 2
fi

echo "[3/6] Checking production URL hygiene..."
if [[ "$NEXT_PUBLIC_API_URL" == *"127.0.0.1"* || "$NEXT_PUBLIC_API_URL" == *"localhost"* ]]; then
  warn "NEXT_PUBLIC_API_URL points to localhost. Set this to your production API URL before going live."
else
  ok "NEXT_PUBLIC_API_URL is not localhost"
fi
if [[ "$NEXT_PUBLIC_SUPABASE_URL" != "$SUPABASE_URL" ]]; then
  warn "Frontend and backend Supabase URLs differ."
else
  ok "Frontend/backend Supabase URLs match"
fi

echo "[4/6] Testing Supabase reachability..."
SUPABASE_HOST="$(echo "$SUPABASE_URL" | sed -E 's#https?://([^/]+)/?.*#\1#')"
if getent hosts "$SUPABASE_HOST" >/dev/null 2>&1; then
  ok "Supabase host resolves: $SUPABASE_HOST"
else
  err "Supabase host DNS failed: $SUPABASE_HOST"
  exit 3
fi
if curl -fsS --max-time 8 "$SUPABASE_URL/rest/v1/" >/dev/null 2>&1; then
  ok "Supabase REST endpoint reachable"
else
  warn "Supabase REST endpoint did not return a successful response (may still be normal without headers)"
fi

echo "[5/6] Optional Cloudflare DNS checks..."
APP_DOMAIN="${APP_DOMAIN:-}"
CF_ZONE_ID="${CF_ZONE_ID:-}"
CF_API_TOKEN="${CF_API_TOKEN:-}"
if [[ -n "$APP_DOMAIN" && -n "$CF_ZONE_ID" && -n "$CF_API_TOKEN" ]]; then
  if ! command -v jq >/dev/null 2>&1; then
    warn "jq not found, skipping Cloudflare DNS record parsing"
  else
    CF_RESP="$(curl -fsS "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records?name=$APP_DOMAIN" \
      -H "Authorization: Bearer $CF_API_TOKEN" \
      -H "Content-Type: application/json" || true)"
    COUNT="$(echo "$CF_RESP" | jq -r '.result | length' 2>/dev/null || echo "0")"
    if [[ "$COUNT" -gt 0 ]]; then
      ok "Cloudflare DNS has record(s) for $APP_DOMAIN"
    else
      warn "No Cloudflare DNS record found for $APP_DOMAIN"
    fi
  fi
else
  warn "Set APP_DOMAIN, CF_ZONE_ID, and CF_API_TOKEN to enable Cloudflare DNS validation."
fi

echo "[6/6] Optional Supabase auth-config check..."
SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-}"
if [[ -n "$SUPABASE_ACCESS_TOKEN" && -n "$SUPABASE_PROJECT_REF" ]]; then
  CODE="$(curl -sS -o /tmp/supabase_project_config.json -w "%{http_code}" \
    "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/config/auth" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" || true)"
  if [[ "$CODE" == "200" ]]; then
    ok "Supabase auth config API reachable"
  else
    warn "Supabase auth config API check failed (HTTP $CODE). Verify token scope."
  fi
else
  warn "Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF to validate Supabase Auth config."
fi

echo ""
echo "Production doctor completed."
