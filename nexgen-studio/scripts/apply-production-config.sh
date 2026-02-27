#!/usr/bin/env bash
set -euo pipefail

# One-command production config:
# - Cloudflare DNS upsert for root/www/api
# - Supabase Auth URL patch (and optional Google OAuth provider enable)
#
# Required env vars:
#   APP_DOMAIN
#   FRONTEND_TARGET
#   BACKEND_TARGET
#   CF_API_TOKEN
#   SUPABASE_ACCESS_TOKEN
#   SUPABASE_PROJECT_REF
#
# Optional env vars:
#   API_SUBDOMAIN (default: api)
#   WWW_SUBDOMAIN (default: www)
#   CF_ZONE_ID (auto-detected if omitted)
#   CF_PROXIED (default: false)
#   GOOGLE_CLIENT_ID
#   GOOGLE_CLIENT_SECRET
#   EXTRA_SUPABASE_REDIRECTS (comma-separated)
#
# Example:
#   APP_DOMAIN=nexgencompany.org \
#   FRONTEND_TARGET=myapp.vercel.app \
#   BACKEND_TARGET=myapi.onrender.com \
#   CF_API_TOKEN=... \
#   SUPABASE_ACCESS_TOKEN=... \
#   SUPABASE_PROJECT_REF=yuwgccxezqarbiwrqzzv \
#   ./scripts/apply-production-config.sh

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required env var: $name" >&2
    exit 1
  fi
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
}

require_cmd "curl"
require_cmd "jq"

require_env "APP_DOMAIN"
require_env "FRONTEND_TARGET"
require_env "BACKEND_TARGET"
require_env "CF_API_TOKEN"
require_env "SUPABASE_ACCESS_TOKEN"
require_env "SUPABASE_PROJECT_REF"

API_SUBDOMAIN="${API_SUBDOMAIN:-api}"
WWW_SUBDOMAIN="${WWW_SUBDOMAIN:-www}"
CF_PROXIED="${CF_PROXIED:-false}"
CF_ZONE_ID="${CF_ZONE_ID:-}"
EXTRA_SUPABASE_REDIRECTS="${EXTRA_SUPABASE_REDIRECTS:-}"

SITE_URL="https://${APP_DOMAIN}"
WWW_URL="https://${WWW_SUBDOMAIN}.${APP_DOMAIN}"
API_DOMAIN="${API_SUBDOMAIN}.${APP_DOMAIN}"

if [[ "$FRONTEND_TARGET" == https://* ]]; then
  FRONTEND_TARGET="${FRONTEND_TARGET#https://}"
fi
if [[ "$BACKEND_TARGET" == https://* ]]; then
  BACKEND_TARGET="${BACKEND_TARGET#https://}"
fi

cf_api() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  local url="https://api.cloudflare.com/client/v4${path}"
  local body_file
  body_file="$(mktemp)"
  local status
  if [[ -n "$data" ]]; then
    status="$(curl -sS -o "$body_file" -w "%{http_code}" -X "$method" "$url" \
      -H "Authorization: Bearer ${CF_API_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "$data")"
  else
    status="$(curl -sS -o "$body_file" -w "%{http_code}" -X "$method" "$url" \
      -H "Authorization: Bearer ${CF_API_TOKEN}" \
      -H "Content-Type: application/json")"
  fi
  if [[ "$status" -lt 200 || "$status" -ge 300 ]]; then
    echo "Cloudflare API error: ${method} ${path} (HTTP ${status})" >&2
    cat "$body_file" >&2
    rm -f "$body_file"
    return 1
  fi
  cat "$body_file"
  rm -f "$body_file"
}

detect_zone_id() {
  if [[ -n "$CF_ZONE_ID" ]]; then
    echo "$CF_ZONE_ID"
    return
  fi
  local response
  response="$(cf_api GET "/zones?name=${APP_DOMAIN}")"
  local zone_id
  zone_id="$(echo "$response" | jq -r '.result[0].id // empty')"
  if [[ -z "$zone_id" ]]; then
    echo "Could not find Cloudflare zone for ${APP_DOMAIN}" >&2
    exit 1
  fi
  echo "$zone_id"
}

upsert_cname() {
  local zone_id="$1"
  local fqdn="$2"
  local target="$3"
  local rec_id
  local search
  search="$(cf_api GET "/zones/${zone_id}/dns_records?type=CNAME&name=${fqdn}")"
  rec_id="$(echo "$search" | jq -r '.result[0].id // empty')"
  local conflicts
  conflicts="$(cf_api GET "/zones/${zone_id}/dns_records?name=${fqdn}")"
  local payload
  payload="$(jq -n \
    --arg type "CNAME" \
    --arg name "$fqdn" \
    --arg content "$target" \
    --argjson proxied "$CF_PROXIED" \
    '{type:$type, name:$name, content:$content, proxied:$proxied}')"

  if [[ $DRY_RUN -eq 1 ]]; then
    if [[ -n "$rec_id" ]]; then
      echo "DRY RUN: would update CNAME ${fqdn} -> ${target}"
    else
      echo "DRY RUN: would create CNAME ${fqdn} -> ${target}"
    fi
    return
  fi

  # Remove non-CNAME records that conflict with this hostname.
  while IFS= read -r conflict_id; do
    [[ -z "$conflict_id" ]] && continue
    cf_api DELETE "/zones/${zone_id}/dns_records/${conflict_id}" >/dev/null
    echo "Removed conflicting DNS record on ${fqdn}"
  done < <(echo "$conflicts" | jq -r '.result[] | select(.type != "CNAME") | .id')

  if [[ -n "$rec_id" ]]; then
    cf_api PUT "/zones/${zone_id}/dns_records/${rec_id}" "$payload" >/dev/null
    echo "Updated CNAME ${fqdn} -> ${target}"
  else
    cf_api POST "/zones/${zone_id}/dns_records" "$payload" >/dev/null
    echo "Created CNAME ${fqdn} -> ${target}"
  fi
}

patch_supabase_auth() {
  local redirects=(
    "${SITE_URL}/auth/callback"
    "${WWW_URL}/auth/callback"
    "${SITE_URL}/login"
    "${WWW_URL}/login"
  )
  if [[ -n "$EXTRA_SUPABASE_REDIRECTS" ]]; then
    IFS=',' read -r -a extra <<<"$EXTRA_SUPABASE_REDIRECTS"
    redirects+=("${extra[@]}")
  fi
  local uri_allow_list
  uri_allow_list="$(IFS=,; echo "${redirects[*]}")"

  local payload
  payload="$(jq -n \
    --arg site_url "$SITE_URL" \
    --arg uri_allow_list "$uri_allow_list" \
    '{site_url:$site_url, uri_allow_list:$uri_allow_list}')"

  if [[ -n "${GOOGLE_CLIENT_ID:-}" && -n "${GOOGLE_CLIENT_SECRET:-}" ]]; then
    payload="$(echo "$payload" | jq \
      --arg gid "$GOOGLE_CLIENT_ID" \
      --arg gsecret "$GOOGLE_CLIENT_SECRET" \
      '. + {
        external_google_enabled: true,
        external_google_client_id: $gid,
        external_google_secret: $gsecret
      }')"
  fi

  if [[ $DRY_RUN -eq 1 ]]; then
    echo "DRY RUN: would patch Supabase auth config for ${SUPABASE_PROJECT_REF}"
    echo "         site_url=${SITE_URL}"
    echo "         uri_allow_list=${uri_allow_list}"
    if [[ -n "${GOOGLE_CLIENT_ID:-}" && -n "${GOOGLE_CLIENT_SECRET:-}" ]]; then
      echo "         Google provider: enabled"
    fi
    return
  fi

  curl -fsS -X PATCH "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/config/auth" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$payload" >/dev/null
  echo "Patched Supabase auth config"
}

ZONE_ID="$(detect_zone_id)"

echo "Cloudflare zone: ${ZONE_ID}"
upsert_cname "$ZONE_ID" "$APP_DOMAIN" "$FRONTEND_TARGET"
upsert_cname "$ZONE_ID" "${WWW_SUBDOMAIN}.${APP_DOMAIN}" "$FRONTEND_TARGET"
upsert_cname "$ZONE_ID" "${API_DOMAIN}" "$BACKEND_TARGET"

patch_supabase_auth

echo ""
echo "Done."
echo "Verify:"
echo "  - https://${APP_DOMAIN}"
echo "  - https://${API_DOMAIN}/health"
echo "  - Supabase Google callback (if enabled): https://${SUPABASE_PROJECT_REF}.supabase.co/auth/v1/callback"
