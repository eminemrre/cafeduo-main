# CafeDuo Deployment Guide

This project is currently prepared for Dokploy-based deployment from GitHub `main`.

## Recommended Dokploy Setup

Use the GitHub repository as the source and deploy from `main`.

Recommended compose file:

```text
deploy/docker-compose.dokploy.yml
```

Supporting files:

- `Dockerfile` for the backend API.
- `Dockerfile.web` for the frontend build and Nginx static server.
- `deploy/Caddyfile` when using the bundled Caddy reverse proxy.
- `.env.production.example` as the production environment template.

## Required Production Environment

Set these in Dokploy or on the host. Do not commit real values.

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgres://USER:PASSWORD@postgres:5432/cafeduo
REDIS_URL=redis://redis:6379
JWT_SECRET=<64+ random hex chars>
CORS_ORIGIN=https://your-domain.com
COOKIE_DOMAIN=
TRUST_PROXY=1
RATE_LIMIT_STORE=redis
RATE_LIMIT_PASS_ON_STORE_ERROR=false
BLACKLIST_FAIL_MODE=closed
BOOTSTRAP_ADMIN_EMAILS=emin3619@gmail.com
BOOTSTRAP_ADMIN_PASSWORD=<set in Dokploy>
VITE_API_BASE_URL=
VITE_SOCKET_URL=
```

Use this to generate a strong JWT secret:

```bash
openssl rand -hex 64
```

For same-origin deployment, keep `VITE_API_BASE_URL`, `VITE_SOCKET_URL`, and `COOKIE_DOMAIN` empty.

## Deployment Flow

1. Push code to GitHub `main`.
2. Dokploy builds the backend and frontend images.
3. PostgreSQL and Redis start first.
4. API starts after health checks pass.
5. Web container serves the Vite build.
6. Reverse proxy routes:
   - `/api/*` to backend
   - `/socket.io/*` to backend
   - all other paths to frontend

## Database

Schema changes must use `node-pg-migrate`.

Before shipping a schema change locally:

```powershell
npm.cmd run migrate:up
npm.cmd run migrate:down
npm.cmd run migrate:up
npm.cmd run migrate:status
```

If the target production database is empty, the app can initialize baseline tables, but migrations remain the source of truth for ongoing schema changes.

## Health Checks

After deploy:

```bash
curl https://your-domain.com/health
curl https://your-domain.com/readiness
curl https://your-domain.com/api/readiness
```

Readiness should report:

- backend up
- database connected
- Redis status
- Socket.IO client count
- app version/build time when provided

## Smoke Checks

Local gates before pushing:

```powershell
npm.cmd run test:ci
npm.cmd run build
npm.cmd run test:e2e
```

Production smoke when credentials are configured:

```bash
SMOKE_BASE_URL=https://your-domain.com node scripts/smoke/prod-smoke.mjs
```

## Admin Bootstrap

Set:

```env
BOOTSTRAP_ADMIN_EMAILS=emin3619@gmail.com
BOOTSTRAP_ADMIN_PASSWORD=<secure password>
```

On startup and login/register, listed emails are promoted to general admin. If `BOOTSTRAP_ADMIN_PASSWORD` is present, startup can create/reset the bootstrap admin account.

## Security Defaults

Production should use:

- `JWT_SECRET` with 64+ random bytes.
- `BLACKLIST_FAIL_MODE=closed`.
- `RATE_LIMIT_PASS_ON_STORE_ERROR=false`.
- Redis-backed rate limiting and token blacklist.
- Same-origin cookies where possible.
- No committed `.env` files.

## Rollback

In Dokploy, roll back to the previous successful deployment from the UI. If manual rollback is needed, redeploy the previous Git commit SHA and confirm `/readiness`.

## Current MVP Evidence

Latest verified local gates:

- `node --check backend/server.js`
- OpenAPI YAML parse
- `backend/server.routes.test.js`
- `npm.cmd run test:ci` with 812 passing tests
- `npm.cmd run build`
- `npm.cmd run test:e2e` with 14 passing Playwright tests
