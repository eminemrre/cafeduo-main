#!/usr/bin/env bash
set -euo pipefail
umask 077
STACK_DIR="${CAFE_STACK_DIR:-/opt/cafeduo-main}"
LOCAL_DIR="${CAFE_BACKUP_DIR:-/var/backups/cafeduo}"
REMOTE="${CAFE_BACKUP_REMOTE:-b2-cafeduo:cafeduo-backups}"
install -d -m 700 "$LOCAL_DIR"
exec 9>/var/lib/cafeduo/backup.lock
flock -n 9 || { echo 'Another backup is running'; exit 1; }
TS="$(date -u +%Y%m%d-%H%M%S)"
DUMP="$LOCAL_DIR/cafeduo-${TS}.dump"
ENV_COPY="$LOCAL_DIR/cafeduo-env-${TS}.txt"
docker exec deploy-postgres-1 sh -c 'exec pg_dump -Fc --no-owner -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$DUMP"
test -s "$DUMP"
docker exec -i deploy-postgres-1 pg_restore --list < "$DUMP" >/dev/null
cp "$STACK_DIR/.env" "$ENV_COPY"
chmod 600 "$DUMP" "$ENV_COPY"
(cd "$LOCAL_DIR" && sha256sum "$(basename "$DUMP")" > "$(basename "$DUMP").sha256")
rclone copy "$DUMP" "$REMOTE/daily/"
rclone copy "$DUMP.sha256" "$REMOTE/daily/"
rclone copy "$ENV_COPY" "$REMOTE/dokploy-env/"
rclone check "$LOCAL_DIR" "$REMOTE/daily/" --one-way --download --include "$(basename "$DUMP")" --quiet
rclone check "$LOCAL_DIR" "$REMOTE/dokploy-env/" --one-way --download --include "$(basename "$ENV_COPY")" --quiet
# Local cleanup happens only after both offsite transfers are verified.
rm -f "$DUMP" "$ENV_COPY" "$DUMP.sha256"
find "$LOCAL_DIR" -type f -mtime +7 -delete
echo "backup complete: $TS (database and environment transfers verified)"
