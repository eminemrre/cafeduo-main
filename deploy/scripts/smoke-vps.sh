#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1}"

echo "[smoke-vps] Base URL: ${BASE_URL}"

HEALTH_JSON="$(curl -fsS "${BASE_URL}/health")"
echo "[smoke-vps] /health -> ${HEALTH_JSON}"

STATUS_CODE="$(
  curl -sS -o /tmp/cafeduo-smoke-login.json -w "%{http_code}" \
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
