# CafeDuo Current State

Last updated: 2026-03-06

## Summary

CafeDuo is currently live at `https://cafeduotr.com` and running on cookie-first authentication.

Current validated state:

- Live health endpoint returns `OK`
- Live version endpoint reports a current production commit
- `npm run test:ci` passes
- `npm run build` passes
- `npm run migrate:status` runs locally, but only reports file-based status when the database is unreachable
- Sprint 1 coverage target is now met locally: `lines 62.6%`, `statements 61.27%`, `functions 65%`, `branches 45.06%`
- Targeted Chromium game E2E passes locally: `e2e/game.spec.ts`

## Current Source Of Truth

Use these as the primary operational references:

- [`DEPLOYMENT.md`](/home/emin/cafeduo-main/DEPLOYMENT.md)
- [`.github/workflows/deploy-vps.yml`](/home/emin/cafeduo-main/.github/workflows/deploy-vps.yml)
- [`docs/COOKIE_AUTH_TROUBLESHOOTING.md`](/home/emin/cafeduo-main/docs/COOKIE_AUTH_TROUBLESHOOTING.md)

Historical analysis documents remain useful, but they are not the primary source of truth for current production behavior.

## Current Production Decisions

- Deployment model: same-origin frontend + backend behind `cafeduotr.com`
- Auth model: cookie-first, dual-mode fallback still enabled
- Cookie domain: `COOKIE_DOMAIN=` must stay empty for same-origin deployment
- Cookie policy: `sameSite='lax'`, `secure=true` in production
- Public smoke: must validate authenticated cookie flow
- Deploy gate: production env secrets and migration status must be validated before deploy

## Known Risks

- Public smoke depends on `DEPLOY_SITE_URL`, `SMOKE_LOGIN_EMAIL`, and `SMOKE_LOGIN_PASSWORD` secrets being present and valid
- Manual edits on VPS `.env` are temporary unless `DEPLOY_ENV_B64` is updated in GitHub secrets
- Coverage is still significantly lower than the desired level for large realtime game components

## Immediate Priorities

1. Keep production deploy fail-fast on env validation, migration status, and authenticated smoke.
2. Raise coverage on large realtime and social game components.
3. Reduce build warnings and heavy component maintenance cost.

## Local Build Note

- Root local `.env` should not define `NODE_ENV` for Vite builds.
- If a local build still warns about `NODE_ENV`, remove it from the gitignored root `.env` and keep runtime-only values in deployment env files instead.
- Real secrets stay in private env files or GitHub secrets and must never be committed or logged.
