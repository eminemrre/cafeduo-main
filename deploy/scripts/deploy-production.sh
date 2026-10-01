#!/usr/bin/env bash
set -euo pipefail
umask 077
PROJECT_DIR="${1:-/opt/cafeduo-main}"
EXPECTED_SHA="${2:?Expected commit SHA is required}"
SITE_URL="${3:-https://cafeduotr.com}"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
[[ "$EXPECTED_SHA" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid commit SHA'; exit 1; }
[[ -f "$PROJECT_DIR/.env" ]] || { echo 'Server-managed .env is missing'; exit 1; }
mkdir -p /var/lib/cafeduo/releases /var/backups/cafeduo-deploy
exec 9>/var/lib/cafeduo/deploy.lock
flock -n 9 || { echo 'Another deployment is running'; exit 1; }
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="/var/backups/cafeduo-deploy/$STAMP"
mkdir -p "$BACKUP"
cp -a "$PROJECT_DIR/.env" "$BACKUP/.env"
docker inspect deploy-api-1 deploy-web-1 > "$BACKUP/containers.json"
docker exec deploy-postgres-1 sh -c 'exec pg_dump -Fc --no-owner -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$BACKUP/database.dump"
test -s "$BACKUP/database.dump"
docker exec -i deploy-postgres-1 pg_restore --list < "$BACKUP/database.dump" > "$BACKUP/database.toc"
python3 - "$PROJECT_DIR/.env" "$SOURCE_DIR/.env" "$EXPECTED_SHA" <<'PY'
import datetime,os,sys
from pathlib import Path
source,target,sha=sys.argv[1:]
lines=[line for line in Path(source).read_text().splitlines() if not line.startswith(('APP_VERSION=','APP_BUILD_TIME=','EXPOSE_API_ERRORS='))]
lines += ['APP_VERSION='+sha,'APP_BUILD_TIME='+datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),'EXPOSE_API_ERRORS=false']
Path(target).write_text('\n'.join(lines)+'\n');os.chmod(target,0o600)
PY
COMPOSE=(docker compose -p deploy --env-file "$SOURCE_DIR/.env" -f "$SOURCE_DIR/deploy/docker-compose.prod.yml" -f "$SOURCE_DIR/deploy/docker-compose.hardening.yml")
"${COMPOSE[@]}" config --quiet
"${COMPOSE[@]}" build api web
"${COMPOSE[@]}" run --rm --no-deps -e MIGRATION_STATUS_REQUIRE_DB=1 -e MIGRATION_STATUS_FAIL_ON_PENDING=1 api npm run migrate:status
# Roll back application images and environment; never roll production data back
# automatically or run destructive down migrations.
python3 - "$BACKUP/containers.json" "$BACKUP/rollback.yml" <<'PY'
import json,sys
items=json.load(open(sys.argv[1]));lines=['services:']
for item in items:
    service='api' if item['Name']=='/deploy-api-1' else 'web'
    lines += ['  '+service+':','    image: '+item['Image']]
open(sys.argv[2],'w').write('\n'.join(lines)+'\n')
PY
rollback() {
  echo '[deploy] Verification failed; restoring previous application images.'
  trap - ERR
  if [[ -f "$BACKUP/Caddyfile" ]]; then
    cp "$BACKUP/Caddyfile" "$PROJECT_DIR/deploy/Caddyfile"
    docker exec deploy-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile || true
  fi
  cp -a "$BACKUP/.env" "$SOURCE_DIR/.env"
  docker compose -p deploy --env-file "$SOURCE_DIR/.env" -f "$SOURCE_DIR/deploy/docker-compose.prod.yml" -f "$SOURCE_DIR/deploy/docker-compose.hardening.yml" -f "$BACKUP/rollback.yml" up -d --no-build --no-deps api web
}
trap rollback ERR
"${COMPOSE[@]}" up -d --no-build --wait --wait-timeout 120 postgres redis api web
docker exec deploy-caddy-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
# Caddy currently mounts the canonical project config, so update that file after
# the application is healthy. Keep the original for rollback of proxy settings.
cp -a "$PROJECT_DIR/deploy/Caddyfile" "$BACKUP/Caddyfile"
cp "$SOURCE_DIR/deploy/Caddyfile" "$PROJECT_DIR/deploy/Caddyfile"
if ! docker exec deploy-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
  cp "$BACKUP/Caddyfile" "$PROJECT_DIR/deploy/Caddyfile"
  false
fi
python3 - "$SITE_URL" "$EXPECTED_SHA" <<'PY'
import json,sys,time,urllib.request
url,sha=sys.argv[1:]
for attempt in range(30):
    try:
        with urllib.request.urlopen(url.rstrip('/')+'/api/readiness',timeout=10) as response:body=json.load(response)
        assert body['status']=='ready' and body['version']==sha and body['checks']['database'] and body['checks']['redis']['ready']
        with urllib.request.urlopen(url,timeout=10) as response:assert response.status==200
        print('[deploy] Public readiness, database, Redis and exact commit verified.');break
    except Exception:
        if attempt==29:raise
        time.sleep(2)
PY
trap - ERR
cp -a "$SOURCE_DIR/.env" "$PROJECT_DIR/.env"
printf '%s\n' "$SOURCE_DIR" > /var/lib/cafeduo/current-source
printf '%s\n' "$EXPECTED_SHA" > /var/lib/cafeduo/current-commit
ln -sfn "$SOURCE_DIR" /opt/cafeduo-current
echo "[deploy] Completed $EXPECTED_SHA; recovery data: $BACKUP"
