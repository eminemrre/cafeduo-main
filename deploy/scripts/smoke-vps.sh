#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1}"

echo "[smoke-vps] Base URL: ${BASE_URL}"

curl_flags=(-sS -L)
if [[ "${BASE_URL}" == http://127.0.0.1* || "${BASE_URL}" == https://127.0.0.1* || "${BASE_URL}" == http://localhost* || "${BASE_URL}" == https://localhost* ]]; then
  site_address_raw="$(grep -E '^SITE_ADDRESS=' .env 2>/dev/null | head -n1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs || true)"
  site_address="$(echo "${site_address_raw}" | cut -d',' -f1 | xargs | sed -E 's#^https?://##' | sed -E 's#/.*$##')"
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

VERSION_JSON="$(curl -f "${curl_flags[@]}" "${BASE_URL}/api/meta/version")"
echo "[smoke-vps] /api/meta/version -> ${VERSION_JSON}"
if [[ -n "${SMOKE_EXPECT_COMMIT:-}" ]]; then
  VERSION_COMMIT="$(printf '%s' "${VERSION_JSON}" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("commit",""))')"
  if [[ "${VERSION_COMMIT}" != "${SMOKE_EXPECT_COMMIT}" ]]; then
    echo "[smoke-vps] commit mismatch. expected=${SMOKE_EXPECT_COMMIT} actual=${VERSION_COMMIT}"
    exit 1
  fi
  echo "[smoke-vps] commit check passed (${VERSION_COMMIT})"
fi

INDEX_HEADERS="$(curl -sSI "${curl_flags[@]}" "${BASE_URL}/" | tr -d '\r')"
if ! echo "${INDEX_HEADERS}" | grep -qi "cache-control: .*no-cache"; then
  echo "[smoke-vps] index cache-control is not no-cache"
  echo "${INDEX_HEADERS}"
  exit 1
fi
echo "[smoke-vps] index cache-control check passed"

if [[ -n "${SMOKE_EXPECT_COMMIT:-}" ]]; then
  INDEX_HTML="$(curl -fsS "${curl_flags[@]}" "${BASE_URL}/")"
  FRONT_COMMIT="$(
    printf '%s' "${INDEX_HTML}" \
      | grep -oE '<meta name="cafeduo:app-version" content="[^"]+"' \
      | sed -E 's/.*content="([^"]+)"/\1/' \
      | head -n1 || true
  )"
  if [[ -z "${FRONT_COMMIT}" ]]; then
    echo "[smoke-vps] frontend commit marker missing in index.html"
    exit 1
  fi
  if [[ "${FRONT_COMMIT}" != "${SMOKE_EXPECT_COMMIT}" ]]; then
    echo "[smoke-vps] frontend commit mismatch. expected=${SMOKE_EXPECT_COMMIT} actual=${FRONT_COMMIT}"
    exit 1
  fi
  echo "[smoke-vps] frontend commit check passed (${FRONT_COMMIT})"
fi

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
