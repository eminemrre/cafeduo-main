#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1}"

echo "[smoke-vps] Base URL: ${BASE_URL}"

curl_flags=(-sS -L)
if [[ "${BASE_URL}" == http://127.0.0.1* || "${BASE_URL}" == https://127.0.0.1* || "${BASE_URL}" == http://localhost* || "${BASE_URL}" == https://localhost* ]]; then
  site_address="$(grep -E '^SITE_ADDRESS=' .env 2>/dev/null | head -n1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs || true)"
  if [[ -n "${site_address}" && "${site_address}" != "localhost" ]]; then
    # Caddy TLS sertifikası domain üzerinden çalıştığı için localhost smoke'u SNI resolve ile domain'e yönlendir.
    BASE_URL="https://${site_address}"
    curl_flags+=(--resolve "${site_address}:443:127.0.0.1")
    echo "[smoke-vps] Resolved local smoke URL to ${BASE_URL} via 127.0.0.1"
  else
    # Fallback: local URL için self-signed/hostname uyumsuz TLS olasılığına izin ver.
    curl_flags+=(-k)
  fi
fi

HEALTH_JSON="$(curl -f "${curl_flags[@]}" "${BASE_URL}/health")"
echo "[smoke-vps] /health -> ${HEALTH_JSON}"

STATUS_CODE="$(
  curl "${curl_flags[@]}" -o /tmp/cafeduo-smoke-login.json -w "%{http_code}" \
    -X POST "${BASE_URL}/api/auth/login" \
    -H 'Content-Type: application/json' \
    --data '{"email":"smoke.invalid@example.com","password":"wrong-pass-123"}'
)"

if [[ "${STATUS_CODE}" != "401" && "${STATUS_CODE}" != "429" ]]; then
  echo "[smoke-vps] Unexpected login status: ${STATUS_CODE}"
  cat /tmp/cafeduo-smoke-login.json || true
  exit 1
fi

echo "[smoke-vps] Invalid login status accepted (${STATUS_CODE})"
echo "[smoke-vps] DONE"
