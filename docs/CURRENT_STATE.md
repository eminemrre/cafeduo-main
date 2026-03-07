# CafeDuo Current State

Last updated: 2026-03-07

## Summary

CafeDuo is live at `https://cafeduotr.com` and currently operates with cookie-first authentication, strict production deploy gating, and authenticated public smoke validation.

Current repo-head validation:

- `npm run test` passes
- `npm run test:ci` passes with `68.26%` line coverage and `52%` branch coverage
- `npm run build` passes
- `npm run migrate:status` passes in informational mode when DB is unreachable locally
- `npm run test:e2e -- --project=chromium` passes locally, including the new dual-web-server Playwright setup
- Production health endpoint returns `OK`
- Production version endpoint returns a live commit hash

## Source Of Truth

Use these as the primary operational references:

- [`DEPLOYMENT.md`](/home/emin/cafeduo-main/DEPLOYMENT.md)
- [`.github/workflows/deploy-vps.yml`](/home/emin/cafeduo-main/.github/workflows/deploy-vps.yml)
- [`docs/COOKIE_AUTH_TROUBLESHOOTING.md`](/home/emin/cafeduo-main/docs/COOKIE_AUTH_TROUBLESHOOTING.md)
- [`docs/PRODUCTION_MIGRATION_BASELINE.md`](/home/emin/cafeduo-main/docs/PRODUCTION_MIGRATION_BASELINE.md)

Historical analysis documents are useful for context, but they are not the source of truth for current production behavior.

## Current Production Decisions

- Deployment model: same-origin frontend + backend behind `cafeduotr.com`
- Auth model: cookie-first, header/handshake fallback still enabled for compatibility
- Cookie domain: `COOKIE_DOMAIN=` must stay empty for same-origin deployment
- Cookie policy: `sameSite='lax'`, `secure=true` in production
- JWT secret policy: production startup and deploy validation require `JWT_SECRET` length `>= 64`
- Blacklist policy: `BLACKLIST_FAIL_MODE=closed`
- Rate-limit store failure policy: production defaults to fail-closed unless explicitly overridden
- Public smoke: validates authenticated cookie flow, `/api/auth/me`, socket auth, and logout
- Deploy gate: production env secrets, migration status, and smoke must pass before release

## Active Risks

- The main operational risk is no longer auth or deploy gating; it is keeping GitHub Actions aligned with the new Playwright dual-web-server readiness model so CI matches local behavior.
- Overall coverage is now materially improved, but direct component coverage remains low for large realtime files such as `TankBattle.tsx` and `RetroChess.tsx`.
- Root local `.env` can still trigger a Vite warning if it contains `NODE_ENV`; this is a local operator issue, not a production runtime issue.
- Manual edits on VPS `.env` remain temporary unless `DEPLOY_ENV_B64` is updated in GitHub secrets.

## Immediate Priorities

1. Confirm the latest GitHub Actions run is green on the Playwright dual-web-server fix.
2. Raise direct component coverage on `TankBattle.tsx` and `RetroChess.tsx` now that global coverage targets are met.
3. Continue decomposing oversized frontend/backend orchestration files without changing public behavior.

## E2E Policy

- Blocking CI now uses `smoke-critical` Chromium Playwright coverage.
- `npm run test:all` is aligned to that blocking contract and now runs unit tests plus Chromium `@smoke`.
- Full multi-browser Playwright coverage remains available through `npm run test:all:full` or dedicated workflow runs.
- `@smoke` covers auth, shop, and dashboard/check-in bootstrap paths.
- `@advanced` covers heavier realtime and mobile/regression scenarios.
- Advanced Playwright runs stay visible through scheduled or manual workflow execution instead of blocking every push.
