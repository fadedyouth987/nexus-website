#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ENV="$ROOT_DIR/backend/.env"
FRONTEND_ENV="$ROOT_DIR/nexus-app/.env.local"

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

read_file_var() {
  local file="$1"
  local key="$2"
  if [[ ! -f "$file" ]]; then
    return 0
  fi
  grep -E "^${key}=" "$file" | head -n1 | cut -d= -f2- || true
}

upsert_kv() {
  local file="$1"
  local key="$2"
  local value="$3"
  local escaped
  escaped="$(printf '%s\n' "$value" | sed -e 's/[\/&]/\\&/g')"
  if [[ -f "$file" ]] && grep -qE "^${key}=" "$file"; then
    if [[ $DRY_RUN -eq 0 ]]; then
      sed -i -E "s#^${key}=.*#${key}=${escaped}#" "$file"
    fi
  else
    if [[ $DRY_RUN -eq 0 ]]; then
      printf '%s=%s\n' "$key" "$value" >>"$file"
    fi
  fi
  printf '  - %s=%s\n' "$key" "$value"
}

new_jwt_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

APP_DOMAIN="${APP_DOMAIN:-}"
API_DOMAIN="${API_DOMAIN:-}"
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"
DATABASE_URL="${DATABASE_URL:-}"

if [[ -z "$APP_DOMAIN" ]]; then
  echo "Missing APP_DOMAIN. Example:"
  echo "  APP_DOMAIN=studio.example.com API_DOMAIN=api.example.com ./scripts/prod-env-sync.sh"
  exit 1
fi

if [[ -z "$API_DOMAIN" ]]; then
  API_DOMAIN="api.${APP_DOMAIN}"
fi

if [[ -z "$SUPABASE_URL" ]]; then
  SUPABASE_URL="$(read_file_var "$BACKEND_ENV" "SUPABASE_URL")"
fi
if [[ -z "$SUPABASE_URL" ]]; then
  SUPABASE_URL="$(read_file_var "$FRONTEND_ENV" "NEXT_PUBLIC_SUPABASE_URL")"
fi

if [[ -z "$SUPABASE_ANON_KEY" ]]; then
  SUPABASE_ANON_KEY="$(read_file_var "$BACKEND_ENV" "SUPABASE_ANON_KEY")"
fi
if [[ -z "$SUPABASE_ANON_KEY" ]]; then
  SUPABASE_ANON_KEY="$(read_file_var "$FRONTEND_ENV" "NEXT_PUBLIC_SUPABASE_ANON_KEY")"
fi

if [[ -z "$DATABASE_URL" ]]; then
  DATABASE_URL="$(read_file_var "$BACKEND_ENV" "DATABASE_URL")"
fi

if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_ANON_KEY" || -z "$DATABASE_URL" ]]; then
  echo "Missing required values. Provide these env vars or set them in backend/.env:"
  echo "  SUPABASE_URL, SUPABASE_ANON_KEY, DATABASE_URL"
  exit 2
fi

if [[ "$SUPABASE_ANON_KEY" == sb_secret_* ]]; then
  echo "Refusing to write a secret key to frontend env."
  echo "Use SUPABASE_ANON_KEY (publishable anon key), not sb_secret_*."
  exit 3
fi

if [[ "$DATABASE_URL" == postgresql://* ]]; then
  DATABASE_URL="${DATABASE_URL/postgresql:\/\//postgresql+psycopg://}"
fi

if [[ $DRY_RUN -eq 1 ]]; then
  echo "Running in dry-run mode. No files will be changed."
fi

mkdir -p "$(dirname "$BACKEND_ENV")" "$(dirname "$FRONTEND_ENV")"
touch "$BACKEND_ENV" "$FRONTEND_ENV"

SITE_URL="https://${APP_DOMAIN}"
API_URL="https://${API_DOMAIN}"
JWT_SECRET="$(read_file_var "$BACKEND_ENV" "JWT_SECRET")"
if [[ -z "$JWT_SECRET" || "$JWT_SECRET" == "change-this-secret-in-production" ]]; then
  JWT_SECRET="$(new_jwt_secret)"
fi

echo "Updating $BACKEND_ENV"
upsert_kv "$BACKEND_ENV" "DATABASE_URL" "$DATABASE_URL"
upsert_kv "$BACKEND_ENV" "SUPABASE_URL" "$SUPABASE_URL"
upsert_kv "$BACKEND_ENV" "SUPABASE_ANON_KEY" "$SUPABASE_ANON_KEY"
upsert_kv "$BACKEND_ENV" "JWT_SECRET" "$JWT_SECRET"
upsert_kv "$BACKEND_ENV" "CORS_ALLOWED_ORIGINS" "$SITE_URL"

echo "Updating $FRONTEND_ENV"
upsert_kv "$FRONTEND_ENV" "NEXT_PUBLIC_SUPABASE_URL" "$SUPABASE_URL"
upsert_kv "$FRONTEND_ENV" "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$SUPABASE_ANON_KEY"
upsert_kv "$FRONTEND_ENV" "NEXT_PUBLIC_API_URL" "$API_URL"
upsert_kv "$FRONTEND_ENV" "API_URL" "$API_URL"
upsert_kv "$FRONTEND_ENV" "NEXT_PUBLIC_SITE_URL" "$SITE_URL"

echo ""
echo "Done."
echo "Next:"
echo "  1) In Supabase Auth settings set Site URL: $SITE_URL"
echo "  2) Add Redirect URLs:"
echo "     - $SITE_URL/auth/callback"
echo "     - $SITE_URL/login"
echo "  3) Run: ./scripts/production-doctor.sh"
