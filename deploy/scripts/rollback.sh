#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${1:-/opt/cafeduo-main}"
BACKUP_PATH="${DEPLOY_PATH}_backup_latest"

if [[ ! -d "${BACKUP_PATH}" ]]; then
  echo "[rollback] Backup path not found: ${BACKUP_PATH}"
  exit 1
fi

echo "[rollback] Restoring backup ${BACKUP_PATH} -> ${DEPLOY_PATH}"
mkdir -p "${DEPLOY_PATH}"
rsync -a --delete "${BACKUP_PATH}/" "${DEPLOY_PATH}/"

cd "${DEPLOY_PATH}"

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo "[rollback] docker compose is not installed"
  exit 1
fi

echo "[rollback] Redeploying stack from restored source"
"${COMPOSE_CMD[@]}" -f deploy/docker-compose.prod.yml --env-file .env up -d --build --remove-orphans

echo "[rollback] Running smoke check"
bash deploy/scripts/smoke-vps.sh http://127.0.0.1

echo "[rollback] Completed successfully"
