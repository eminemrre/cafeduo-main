# AGENTS.md

CafeDuo is a gamified loyalty platform for university cafés: users check in at a café, play
two-player games, earn points and redeem them for rewards.

Stack: Node + Express (CommonJS), React + Vite + TypeScript, PostgreSQL, Redis, Socket.IO.

## Commands

- `npm run dev` — backend (nodemon) and frontend (Vite) together
- `npm test` — Jest unit tests; `npm run test:ci` adds coverage
- `npm run quality` — lint + typecheck
- `npm run build` — Vite production build
- `npm run test:e2e:smoke` — Playwright smoke suite (Chromium)
- `npm run migrate:create <name>` / `migrate:up` / `migrate:down` / `migrate:status`
- `npm run smoke:live` — production health probe

## Workflow

- Work on a branch and open a pull request. A push to `main` deploys to production through
  Dokploy, so `main` only receives reviewed merges.
- `.github/workflows/deploy-vps.yml` is the retired pipeline; Dokploy pulls `main` and runs
  `deploy/docker-compose.dokploy.yml`.
- Husky's pre-commit hook runs lint-staged (eslint --fix + prettier --write on staged files).
- Production: https://cafeduotr.com, health check `/api/health`.

## Validation before finishing

```bash
npm run quality          # lint + typecheck
npm test                 # unit tests
npm run build            # Vite build must succeed
npm run test:e2e:smoke   # when touching user flows
npm run migrate:status   # when touching migrations
```

## Must-follow constraints

### Database

- **Never use `SELECT *`** — always list columns; it keeps payloads small and survives schema
  changes.
- **Always add `LIMIT`** to user-facing queries (leaderboard, inventory, history). Default 100 for
  lists, 50 for leaderboards.
- **Use `node-pg-migrate` for all schema changes** — never extend the `initDb` DDL in
  `backend/server.js`.
- **Test migrations both ways**: `npm run migrate:up && npm run migrate:down && npm run migrate:up`.
- **No N+1 queries** — no queries inside loops; batch with `ANY($1)`, `UNNEST`, CTEs or JOINs.

### Redis

- **Never use `redis.keys(pattern)`** — it blocks Redis; iterate with `scan()`. `clearCache()`
  already does.

### Frontend

- **No 4-second polling** — use the Socket.IO `lobby_updated` event; polling fallback is at most
  15s.
- **Never read `localStorage` in the render path** — batch reads in `useEffect`.
- **Load route components with `lazyWithRetry()`** — never import Games, Dashboard,
  AdminDashboard, CafeDashboard, Store or ResetPasswordPage directly.
- **All `import.meta.env` access goes through `lib/viteEnv.ts`** (`getViteEnvVar()`), because
  Jest's CommonJS output cannot parse `import.meta`. That module holds the only `no-new-func`
  exception.

### Security

- **`JWT_SECRET` must be at least 64 characters in production** — generate it with
  `openssl rand -hex 64`; the server refuses to start otherwise.
- **Never log `password_hash` or tokens.**
- **`BLACKLIST_FAIL_MODE=closed` in production** — reject auth when the Redis blacklist check
  fails.
- **Never return database error details to clients** — 5xx responses are generic; diagnostics
  go to the logger.

## Repo conventions

### Layout

- Backend is CommonJS (`.js`); frontend is TypeScript (`.ts`/`.tsx`).
- Backend entry `backend/server.js`; frontend entry `index.tsx`, `App.tsx`.
- Tests are co-located (`*.test.ts(x)`, `*.test.js`). Shared types live in root `types.ts`.
- Frontend `@/*` maps to the repo root (not `src/`); the backend uses relative paths only.
- `shared/gameRegistry.js` is CommonJS and read by both backend and frontend.

### Architecture

- HTTP: `backend/routes/` → handlers/controllers → services/repositories; middleware includes
  `authenticateToken`, `csrfMiddleware` and Redis-backed rate limiting.
- Realtime: Socket.IO authenticates with the JWT in `socket.auth.token`
  (`backend/middleware/socketAuth.js`). Events: `join_game`, `leave_game`, `game_state_updated`,
  `game_room_error`, `lobby_updated`. Sockets only carry server notifications; player actions go
  through the authenticated HTTP game endpoints. `game_move` and `update_game_state` are rejected.
  Call `emitLobbyUpdate(tableCode)` after game mutations, and emit only after the DB commit.
- Competitive games (Bilgi Yarışı, Nişancı Düellosu) run only the server-authoritative protocol.
  No new game is created or joined while `GAME_ENGINE_V2_ENABLED` is false, and legacy
  live/score/state/winner writes answer `410 LEGACY_PROTOCOL_DISABLED`.
- Game state changes go through the game handlers; chess moves use `gameMoveService.js` with
  transaction locking.
- Settlement (`backend/handlers/game/settlementUtils.js`): the winner receives
  `min(stake, loser.points)`.
- Live submissions are deduplicated by
  `submissionKey = "{prefix}|{gameId}|{user}|{round}|{score}|{done}"`.

### Database

- Pool size comes from `DB_POOL_MAX` (default 20) and `DB_POOL_MIN` (default 2).
- Migrations live in `migrations/`; see `20240224000002_add_performance_indexes.js` for index
  patterns.
- Breaking changes need multi-step migrations: add nullable → backfill → make non-nullable →
  deploy code. Never remove, rename or lossily retype a column in one step.

### Caching

- Invalidate the lobby cache through `lobbyCacheService.onGameCreated/onGameJoined/onGameDeleted/onGameFinished`.
- Clear patterns with `clearCache('pattern:*')` (SCAN-based).

### Environment variables

- Frontend variables need the `VITE_` prefix.
- Never commit `.env` files; templates are `.env.example` and `.env.production.example`.
- E2E: `scripts/e2e/run-with-env.cjs` boots a fixed admin (`e2e.admin@example.com` /
  `E2eAdmin!2026`) through `BOOTSTRAP_ADMIN_EMAILS`/`BOOTSTRAP_ADMIN_PASSWORD`.

### Testing (Jest)

- `jest.config.js` is generated by `scripts/automation/gen-jest-config.py` — edit the generator.
- react-router 8 and `cookie-es` are ESM-only: `jest.transform.js` emits CJS for react-router and
  `cookie-es` maps to `__mocks__/cookie-es.cjs`.
- The config key is `setupFilesAfterEnv`; a misspelling silently skips the setup file.
- Mock `lib/api`, `lib/multiplayer` and `lib/socket` with `jest.mock` (see
  `hooks/useLiveScoreGame.test.ts`).
- With fake timers, assert that a timer was armed via a `setTimeout` spy instead of invoking the
  callback directly.
- Coverage exclusions (WebGL/Pixi overlays, barrels) live in the config generator; do not remove
  tests to change them.
- CI runs `scripts/automation/audit-gate.mjs` (no allowlist): keep `npm audit` at zero.

### E2E (Playwright)

- `@smoke` specs run on every push (`ci.yml`), `@advanced` nightly (`playwright.yml`); tag new
  specs accordingly.
- `bootstrapAuthenticatedPage` takes `skipCheckInRecovery` for flows that already checked in via
  the API.
- Check-in recovery timeouts (8s/15s) are deliberately generous; do not shrink them.

## Important locations

| Purpose            | Location                                |
| ------------------ | --------------------------------------- |
| DB migrations      | `migrations/`                           |
| Backend middleware | `backend/middleware/`                   |
| Game handlers      | `backend/handlers/gameHandlers.js`      |
| Socket auth        | `backend/middleware/socketAuth.js`      |
| Lobby cache        | `backend/services/lobbyCacheService.js` |
| API client         | `lib/api.ts`                            |
| Socket client      | `lib/socket.ts`                         |
| Type definitions   | `types.ts`                              |
| Test setup         | `test-setup.ts`                         |

## Known gotchas

- **Memory fallback mode**: without a database the app runs on `backend/store/memoryState.js`.
  Never assume the DB is connected — check `await isDbConnected()`. Test the memory path by
  pointing `DATABASE_URL` at an unreachable database.
- **Email canonicalization**: Gmail addresses are canonicalized (`user+tag@gmail.com` →
  `user@gmail.com`) for login, registration and password reset; see
  `backend/controllers/authController.js`.
- **Table codes** normalize to `MASA##` (`5` and `MASA05` → `MASA05`). The logic exists in both
  `hooks/useGames.ts` and `backend/server.js`; change both.
- **Bootstrap admins**: emails in `BOOTSTRAP_ADMIN_EMAILS` are promoted to admin on login,
  registration and server start (`promoteBootstrapAdmins()`).
- **Rate limiting**: auth endpoints are stricter than the general API. Redis-backed limits need
  `REDIS_URL` and fall back to memory without it; `RATE_LIMIT_PASS_ON_STORE_ERROR=false` rejects
  requests when Redis fails (recommended in production).
- **PWA is enabled**: `vite-plugin-pwa` generates a service worker with `registerType:
'autoUpdate'` (`vite.config.ts`), so a deploy reaches open clients on their next load.
- **Toy fallbacks carry labels in the display face**: `public/landing/toys/*.webp` are stills of
  the Three.js scene, rendered through the dev-only page `toy-render.html` (git-excluded via
  `.git/info/exclude`, so recreate it when missing; it must import `@fontsource/baloo-2/800.css`
  and wait for `document.fonts.load('100px "Baloo 2"')`). Re-render them whenever the display
  face or its weight changes — `toy-render.html?layout=single&only=knight`, sized 720×720 with
  `deviceScaleFactor: 2`, converted with `magick <png> -quality 84 <webp>`.
- **Production images install without dev dependencies**, so `prepare` must stay
  `husky || true`.
