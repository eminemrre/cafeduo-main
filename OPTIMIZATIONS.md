# CafeDuo Optimization Status

This file is the current optimization and reliability snapshot for the MVP.

## Current Health

Status: MVP-ready.

Completed improvements:

- Backend SQL uses explicit columns in production code; no active `SELECT *` query remains.
- User-facing list endpoints use bounded result sets.
- Lobby and game updates use Socket.IO as the primary realtime path.
- Frontend polling remains a fallback and is kept at 15 seconds or slower.
- Redis cache invalidation uses scan-style behavior instead of `KEYS`.
- Game room Socket.IO access is participant/admin gated.
- Game move and state broadcasts require socket room membership.
- Tank battle settlement uses server-side score submissions to resist spoofed finish payloads.
- OpenAPI loads cleanly after duplicate path cleanup.
- Root Docker Compose now defaults `RATE_LIMIT_PASS_ON_STORE_ERROR=false` and `BLACKLIST_FAIL_MODE=closed`.

## MVP Performance Baseline

Expected MVP scale:

- Small to medium cafe usage.
- Realtime two-player games.
- Admin and cafe-admin operational workflows.
- PostgreSQL as source of truth, Redis for cache/rate-limit/session-adjacent behavior.

Validation evidence:

- `npm.cmd run test:ci`: 812 passing tests.
- `npm.cmd run build`: passing production build.
- `npm.cmd run test:e2e`: 14 passing Playwright tests.
- OpenAPI YAML parse: passing.
- Route/socket registry test: passing.

## Guardrails

Keep these rules in future changes:

- No `SELECT *`.
- Add `LIMIT` to user-facing list queries.
- Use migrations for schema changes.
- Avoid N+1 database patterns in request paths.
- Do not use `redis.keys(pattern)`.
- Keep polling fallback intervals at 15 seconds or slower.
- Never read `localStorage` in React render paths.
- Use `lazyWithRetry()` for route-level pages.
- Keep production auth fail-closed where Redis/token blacklist is involved.

## Watch List

These are not blockers for the current MVP, but they are the next best improvements:

- Add deeper runtime Socket.IO integration tests with two real socket clients.
- Add production smoke automation in Dokploy after every successful deploy.
- Add pagination to any future inventory/history views that can exceed 100 rows.
- Replace legacy startup schema creation over time with migration-only bootstrapping.
- Review font asset warnings from Vite/PWA output if visual font loading regresses in production.

## Quick Audit Commands

```powershell
git grep -n "SELECT \\*" -- backend "*.js"
git grep -n "redis\\.keys" -- backend "*.js"
npm.cmd run test:ci
npm.cmd run build
npm.cmd run test:e2e
```
