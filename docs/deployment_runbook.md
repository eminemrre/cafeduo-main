# Deployment Runbook (Local -> VPS -> Domain)

Last updated: 2026-02-06

## 1) Local quality gate (mandatory)

1. Install and verify dependencies:
   - `npm ci`
2. Create `.env` from `.env.example` and set required values:
   - `JWT_SECRET`
   - `DATABASE_URL`
   - `CORS_ORIGIN`
   - `DB_SSL` (`false` for local Docker Postgres, `true` for managed cloud DB)
3. Run quality checks:
   - `npm run test:ci`
   - `npm run build`
4. Smoke-test critical flows locally:
   - auth (`/api/auth/register`, `/api/auth/login`)
   - game create/join/move
   - reward/coupon and cafe check-in flows

## 2) Production stack files

1. VPS compose stack:
   - `deploy/docker-compose.prod.yml`
2. Reverse proxy + TLS:
   - `deploy/Caddyfile`
3. Production env template:
   - `deploy/.env.production.example`
4. Optional Render blueprint:
   - `render.yaml`
5. Optional GitHub auto-deploy:
   - `.github/workflows/deploy-vps.yml`

## 3) VPS bootstrap

1. Prepare server packages (Ubuntu):
   - `sudo apt update && sudo apt install -y docker.io docker-compose-plugin`
   - `sudo systemctl enable --now docker`
2. Open firewall:
   - `sudo ufw allow 22`
   - `sudo ufw allow 80`
   - `sudo ufw allow 443`
   - `sudo ufw enable`
3. Copy project to VPS and create env:
   - `cp deploy/.env.production.example .env`
   - fill `.env` with real secrets and domain values

## 4) First production deploy (manual)

1. Run:
   - `docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --build`
2. Verify service health:
   - `curl https://<domain>/health`
   - `docker compose -f deploy/docker-compose.prod.yml ps`
3. Verify realtime:
   - open site on 2 browsers/tabs
   - create/join same game and confirm socket updates

## 5) DNS and domain cutover

1. Point DNS `A` record to VPS public IP.
2. Set `SITE_ADDRESS` in `.env`:
   - example: `SITE_ADDRESS=cafeduo.example.com`
3. Set `CORS_ORIGIN` with exact frontend origins:
   - `https://cafeduo.example.com,https://www.cafeduo.example.com`
4. Re-deploy once DNS is live:
   - `docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --build`

## 6) CI/CD deploy option

1. Add repository secrets:
   - `DEPLOY_HOST`, `DEPLOY_PORT`, `DEPLOY_USER`, `DEPLOY_PATH`, `DEPLOY_SSH_KEY`
2. Enable workflow:
   - `.github/workflows/deploy-vps.yml`
3. Trigger:
   - push `main` or `workflow_dispatch`

## 7) Rollback plan

1. Keep previous revision on VPS (Git history).
2. Roll back to previous commit and redeploy:
   - `git checkout <previous_commit>`
   - `docker compose -f deploy/docker-compose.prod.yml --env-file .env up -d --build`
3. Validate:
   - `/health`, login, and one realtime game flow

## 8) Security checklist

- `JWT_SECRET` is strong and rotated.
- `NODE_ENV=production`.
- `TRUST_PROXY=1` behind reverse proxy.
- `CORS_ORIGIN` uses explicit origins (no `*`).
- API/auth rate limit settings are active (`API_RATE_LIMIT_*`, `AUTH_*_RATE_LIMIT_*`).
