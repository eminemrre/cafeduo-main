#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1}"

echo "[smoke-vps] Base URL: ${BASE_URL}"

curl_flags=(-sS -L)
if [[ "${BASE_URL}" == http://127.0.0.1* || "${BASE_URL}" == https://127.0.0.1* || "${BASE_URL}" == http://localhost* || "${BASE_URL}" == https://localhost* ]]; then
  # Local smoke checks may hit HTTPS redirect with a domain certificate.
  curl_flags+=(-k)
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
