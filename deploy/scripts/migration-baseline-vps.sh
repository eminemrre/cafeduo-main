#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-report}"
PROJECT_DIR="${2:-$(pwd)}"

cd "$PROJECT_DIR"

if [[ ! -f .env ]]; then
  echo "[migration-baseline-vps] .env not found in ${PROJECT_DIR}"
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  run_compose() { docker compose "$@"; }
else
  if ! command -v docker-compose >/dev/null 2>&1; then
    echo "[migration-baseline-vps] docker compose / docker-compose not found"
    exit 1
  fi
  run_compose() { docker-compose "$@"; }
fi

report() {
  run_compose -f deploy/docker-compose.prod.yml --env-file .env run --rm --build \
    api npm run migrate:baseline:report
}

apply_baseline() {
  run_compose -f deploy/docker-compose.prod.yml --env-file .env run --rm --build \
    api npm run migrate:baseline:apply -- --include-superseded-performance
}

migrate_up() {
  run_compose -f deploy/docker-compose.prod.yml --env-file .env run --rm --build \
    api npm run migrate:up
}

status() {
  run_compose -f deploy/docker-compose.prod.yml --env-file .env run --rm --build \
    api npm run migrate:status
}

case "$MODE" in
  report)
    report
    ;;
  apply)
    report
    apply_baseline
    status
    migrate_up
    status
    ;;
  status)
    status
    ;;
  *)
    echo "Usage: bash deploy/scripts/migration-baseline-vps.sh [report|apply|status] [project_dir]"
    exit 1
    ;;
esac
