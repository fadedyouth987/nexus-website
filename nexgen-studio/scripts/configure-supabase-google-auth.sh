#!/usr/bin/env bash
set -euo pipefail

# Automates enabling Google OAuth provider in Supabase using Management API.
# Required env vars:
#   SUPABASE_ACCESS_TOKEN
#   SUPABASE_PROJECT_REF
#   GOOGLE_CLIENT_ID
#   GOOGLE_CLIENT_SECRET
#
# Optional env vars:
#   SITE_URL (default: http://127.0.0.1:3000)
#   ADDITIONAL_REDIRECT_URLS (comma-separated)
#
# Example:
#   SUPABASE_ACCESS_TOKEN=... \
#   SUPABASE_PROJECT_REF=yuwgccxezqarbiwrqzzv \
#   GOOGLE_CLIENT_ID=...apps.googleusercontent.com \
#   GOOGLE_CLIENT_SECRET=... \
#   ./scripts/configure-supabase-google-auth.sh

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required env var: $name" >&2
    exit 1
  fi
}

require_env "SUPABASE_ACCESS_TOKEN"
require_env "SUPABASE_PROJECT_REF"
require_env "GOOGLE_CLIENT_ID"
require_env "GOOGLE_CLIENT_SECRET"

SITE_URL="${SITE_URL:-http://127.0.0.1:3000}"
AUTH_CALLBACK="${SITE_URL%/}/auth/callback"

REDIRECTS="${AUTH_CALLBACK}"
if [[ -n "${ADDITIONAL_REDIRECT_URLS:-}" ]]; then
  REDIRECTS="${REDIRECTS},${ADDITIONAL_REDIRECT_URLS}"
fi

echo "Configuring Supabase auth provider for project: ${SUPABASE_PROJECT_REF}"

curl -fsS -X PATCH "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d @- <<JSON
{
  "site_url": "${SITE_URL}",
  "uri_allow_list": "${REDIRECTS}",
  "external_google_enabled": true,
  "external_google_client_id": "${GOOGLE_CLIENT_ID}",
  "external_google_secret": "${GOOGLE_CLIENT_SECRET}"
}
JSON

echo ""
echo "Supabase Google provider enabled."
echo "Now ensure Google Cloud OAuth has this redirect URI:"
echo "  https://${SUPABASE_PROJECT_REF}.supabase.co/auth/v1/callback"
