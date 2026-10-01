# Production operations

CafeDuo runs at `https://cafeduotr.com` on a standalone Docker Compose stack named
`deploy`. Caddy serves HTTPS and proxies the Dokploy panel at
`https://panel.cafeduotr.com`; the app is not deployed through Dokploy's proxy.

## Release flow

`.github/workflows/deploy-vps.yml` deploys a successful main-branch push from the
`CI/CD Pipeline`, or an explicit main-branch manual run. It repeats the security,
lint, type, unit, build and Chromium smoke checks, pins the SSH host key, transfers
that exact Git revision, and executes `deploy/scripts/deploy-production.sh`.
Production deployments are serialized in GitHub and with a server-side file lock.

Configure the `production` GitHub environment with `DEPLOY_HOST`, `DEPLOY_USER`,
`DEPLOY_SSH_KEY`, optionally `DEPLOY_PORT` (22) and `DEPLOY_PATH`
(`/opt/cafeduo-main`). `PRODUCTION_URL` is an environment variable, defaulting to
`https://cafeduotr.com`. Install the matching public key in the server account.
Never store passwords or private keys in the repository. The checked-in
`deploy/ssh_known_hosts` was verified against the running server; replace it only
after verifying a deliberate host-key change through an independent channel.

The SSH preparation step accepts the complete private key copied from its file,
including CRLF, escaped newlines, flattened whitespace, JSON quoting or base64
encoding of the entire file. It reconstructs line wrapping and validates the
result with OpenSSH before any connection. It never prints private key material.
Missing headers, truncated keys and passphrase-protected keys fail with a clear
message; formatting normalization cannot recover missing key data. CI tests use
disposable generated keys and verify that the public key is unchanged and the
private file permissions are 600.

The application environment stays on the server in `/opt/cafeduo-main/.env` with
mode 600. Releases live in `/opt/cafeduo-releases/<commit>`; successful releases
are recorded in `/var/lib/cafeduo/current-source`, `current-commit` and
`/opt/cafeduo-current`. Use the current release's Compose files for future
operations; the canonical directory is retained for environment and Caddy mounts.
Node 22 is used for both builds and the API. Dependency installation uses the
lockfile; the migration CLI is included in production dependencies.

The script backs up the database, environment, previous image IDs and Caddy config,
builds before replacing containers, rejects pending migrations, then verifies
public readiness including the exact commit, PostgreSQL and Redis. It does not
restart Docker. Container memory, CPU and log rotation limits are declared in the
hardening overlay; Redis uses `noeviction` to preserve authentication/rate state.

## Migrations on the existing bootstrap database

Do not replay all historical migrations on a runtime-created database. In
particular `20260513000001_reset_users_keep_admins` deletes user accounts and
inventory. The production wrapper rejects it unless deliberately overridden.

The one-time adoption path is:

```bash
# Run inside a release API container with the production environment.
npm run migrate:adopt
npm run migrate:adopt -- --apply --retire-user-reset
MIGRATION_STATUS_REQUIRE_DB=1 MIGRATION_STATUS_FAIL_ON_PENDING=1 npm run migrate:status
```

Adoption first verifies the existing schema, daily-spin unique index and absence
of duplicate usernames/coupon codes. It applies compatibility/index repairs and
the game-name migration, records already-present bootstrap migrations and retires
the user reset without executing it. Back up first and validate a restored copy.
Production `down`/`redo` requires explicit `ALLOW_PRODUCTION_DOWN=1`.
New migrations must be reviewed, tested `up/down/up` on an isolated database, then
applied explicitly before deployment; deploy does not perform schema changes.

## Recovery

Deployment recovery files are under `/var/backups/cafeduo-deploy/<UTC timestamp>`.
A verification failure restores the previous API/web image IDs, environment and
Caddy configuration. Database changes are never automatically reversed. An image
rollback can only be used while the database remains compatible with that image.

For a manual rollback, use the failed release directory and its backup:

```bash
cp /var/backups/cafeduo-deploy/<timestamp>/.env /opt/cafeduo-releases/<commit>/.env
cd /opt/cafeduo-releases/<commit>
docker compose -p deploy --env-file .env \
  -f deploy/docker-compose.prod.yml -f deploy/docker-compose.hardening.yml \
  -f /var/backups/cafeduo-deploy/<timestamp>/rollback.yml \
  up -d --no-build --no-deps api web
# Restore the backed-up Caddyfile to /opt/cafeduo-main/deploy/Caddyfile and reload.
curl --fail https://cafeduotr.com/api/readiness
```

Daily backups run through the host's existing scheduler and copy database dumps
and environment files to `b2-cafeduo:cafeduo-backups/`. Protect that destination
because environment backups contain secrets. The backup script uses a private
umask, a lock, validates the archive and uploads its checksum. Verify offsite
recovery regularly by restoring into an isolated temporary PostgreSQL container;
never target the live database. The 2026-10-01 maintenance tested a full restore
and migration adoption against a temporary clone, preserving existing records
apart from the intended game display-name normalization.

## Host checks

The host was upgraded to Ubuntu 26.04.1 LTS and rebooted on 2026-10-01. UFW permits
22, 80 and 443. `cafeduo-docker-firewall.service` blocks public Docker port 3000
without blocking Caddy's internal panel connection. Swarm ports remain blocked
from the public network. SSH Fail2ban is active; Cloudflare NTP is synchronized.
Root password login remains enabled until a user-owned SSH key has been installed
and independently verified.

```bash
systemctl --failed
systemctl status cafeduo-docker-firewall fail2ban
fail2ban-client status sshd
ufw status
timedatectl show -p NTPSynchronized
docker ps
curl --fail https://cafeduotr.com/api/readiness
curl --fail -I https://panel.cafeduotr.com
```

Host maintenance recovery files are under
`/var/backups/cafeduo-maintenance/20261001T150742Z`, with an offsite maintenance
copy. They contain private configuration and must remain accessible only to root.
