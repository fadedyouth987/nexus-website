#!/usr/bin/env bash
set -euo pipefail

# Resets web DNS records for a Cloudflare zone to a clean Vercel + Render layout:
#   @   -> FRONTEND_TARGET (CNAME)
#   www -> FRONTEND_TARGET (CNAME)
#   api -> BACKEND_TARGET  (CNAME)
#
# Required env vars:
#   APP_DOMAIN
#   CF_ZONE_ID
#   CF_API_TOKEN
#   FRONTEND_TARGET
#   BACKEND_TARGET
#
# Optional:
#   API_SUBDOMAIN (default: api)
#   WWW_SUBDOMAIN (default: www)
#   CF_PROXIED (default: false)
#
# Example:
#   APP_DOMAIN=nexgencompany.org \
#   CF_ZONE_ID=... \
#   CF_API_TOKEN=... \
#   FRONTEND_TARGET=ai-frontend.vercel.app \
#   BACKEND_TARGET=ai-backend.onrender.com \
#   ./scripts/reset-cloudflare-dns.sh

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
require_env "CF_ZONE_ID"
require_env "CF_API_TOKEN"
require_env "FRONTEND_TARGET"
require_env "BACKEND_TARGET"

API_SUBDOMAIN="${API_SUBDOMAIN:-api}"
WWW_SUBDOMAIN="${WWW_SUBDOMAIN:-www}"
CF_PROXIED="${CF_PROXIED:-false}"
MANAGE_ROOT_RECORD="${MANAGE_ROOT_RECORD:-true}"

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

delete_conflicting_records_for_name() {
  local fqdn="$1"
  local existing
  existing="$(cf_api GET "/zones/${CF_ZONE_ID}/dns_records?name=${fqdn}")"
  while IFS= read -r row; do
    [[ -z "$row" ]] && continue
    local rec_id rec_type rec_name rec_content
    rec_id="$(echo "$row" | jq -r '.id')"
    rec_type="$(echo "$row" | jq -r '.type')"
    rec_name="$(echo "$row" | jq -r '.name')"
    rec_content="$(echo "$row" | jq -r '.content // ""')"
    # Keep TXT records (verification/mail policy). Remove web-routing records.
    if [[ "$rec_type" == "TXT" ]]; then
      continue
    fi
    if [[ $DRY_RUN -eq 1 ]]; then
      echo "DRY RUN: would delete ${rec_type} ${rec_name} -> ${rec_content}"
    else
      set +e
      local delete_output
      delete_output="$(cf_api DELETE "/zones/${CF_ZONE_ID}/dns_records/${rec_id}" 2>&1)"
      local delete_status=$?
      set -e
      if [[ $delete_status -eq 0 ]]; then
        echo "Deleted ${rec_type} ${rec_name} -> ${rec_content}"
      else
        if echo "$delete_output" | grep -q '"code":1052'; then
          echo "Skipping protected record (${rec_type} ${rec_name}) managed by Cloudflare/R2"
        else
          echo "$delete_output" >&2
          return 1
        fi
      fi
    fi
  done < <(echo "$existing" | jq -c '.result[]')
}

upsert_cname() {
  local fqdn="$1"
  local target="$2"
  local existing
  existing="$(cf_api GET "/zones/${CF_ZONE_ID}/dns_records?type=CNAME&name=${fqdn}")"
  local rec_id
  rec_id="$(echo "$existing" | jq -r '.result[0].id // empty')"
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

  if [[ -n "$rec_id" ]]; then
    cf_api PUT "/zones/${CF_ZONE_ID}/dns_records/${rec_id}" "$payload" >/dev/null
    echo "Updated CNAME ${fqdn} -> ${target}"
  else
    cf_api POST "/zones/${CF_ZONE_ID}/dns_records" "$payload" >/dev/null
    echo "Created CNAME ${fqdn} -> ${target}"
  fi
}

ROOT_NAME="${APP_DOMAIN}"
WWW_NAME="${WWW_SUBDOMAIN}.${APP_DOMAIN}"
API_NAME="${API_SUBDOMAIN}.${APP_DOMAIN}"

echo "Resetting Cloudflare DNS in zone ${CF_ZONE_ID}"
echo "Domain: ${APP_DOMAIN}"

if [[ "$MANAGE_ROOT_RECORD" == "true" ]]; then
  delete_conflicting_records_for_name "$ROOT_NAME"
else
  echo "Skipping root (@) record management by MANAGE_ROOT_RECORD=false"
fi
delete_conflicting_records_for_name "$WWW_NAME"
delete_conflicting_records_for_name "$API_NAME"

if [[ "$MANAGE_ROOT_RECORD" == "true" ]]; then
  upsert_cname "$ROOT_NAME" "$FRONTEND_TARGET"
fi
upsert_cname "$WWW_NAME" "$FRONTEND_TARGET"
upsert_cname "$API_NAME" "$BACKEND_TARGET"

echo ""
echo "Done."
echo "Verify:"
echo "  getent hosts ${ROOT_NAME}"
echo "  getent hosts ${WWW_NAME}"
echo "  getent hosts ${API_NAME}"
