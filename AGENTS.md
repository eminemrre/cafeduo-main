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
- `npm run test:e2e:v2` — two-context ranked quiz/aim suite; starts the stack with
  `GAME_ENGINE_V2_ENABLED=true`
- `npm run game-engine:transition` — read-only dry run for retiring pre-v2 active games;
  `--apply` requires explicit approval and an environment gate
- `npm run migrate:create <name>` / `migrate:up` / `migrate:down` / `migrate:status`
- `npm run smoke:live` — production health probe

## Workflow

- Work on a branch and open a pull request. A push to `main` deploys to production, so `main`
  only receives reviewed merges.
- Production deploys through `.github/workflows/deploy-vps.yml` (after a green `CI/CD Pipeline`
  on a `main` push): SSH → `deploy/scripts/deploy-production.sh` with
  `deploy/docker-compose.prod.yml` + `docker-compose.hardening.yml` and the server-managed
  `/opt/cafeduo-main/.env` (verified in Actions runs on 2026-10-21). The script backs up the
  database, builds, and **aborts on pending migrations**; it never runs them. Apply a new
  migration on the server before merging. Every API env var must be listed in
  `docker-compose.prod.yml` (`deploymentContract.test.js`). `docker-compose.dokploy.yml` is
  kept in sync but is not what production runs.
- Husky's pre-commit hook runs lint-staged (eslint --fix + prettier --write on staged files).
- Production: https://cafeduotr.com, health check `/api/health`.

## Validation before finishing

```bash
npm run quality          # lint + typecheck
npm test                 # unit tests
npm run build            # Vite build must succeed
npm run test:e2e:smoke   # when touching user flows
npm run test:e2e:v2      # when touching ranked quiz/aim protocol
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
- **The whole history must install an empty database**: CI's `fresh-db-migrations` job runs
  `npm run migrate:verify-fresh` (up → full down → up, identical schema). Every `down` must
  tolerate objects a later migration adopted with `IF NOT EXISTS` and already dropped; use
  `ifExists`. Production never ran `20240224000002` (the legacy baseline marks it superseded).
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
- Competitive games (Bilgi Yarışı, Nişancı Düellosu, Amiral Battı; `competitive: true` in
  `shared/gameRegistry.js`) run only the server-authoritative protocol. Create, join, actions,
  readers and the deadline job reach their rules only through `backend/gameEngine/engines.js`;
  a new competitive game is one entry there, never another type if-chain in a handler.
  No new game is created or joined while `GAME_ENGINE_V2_ENABLED` is false, and legacy
  live/score/state/winner writes answer `410 LEGACY_PROTOCOL_DISABLED`.
- Every game HTTP/socket payload goes through `backend/gameEngine/gameView.js`. Never return a raw
  `games` row. `games.game_state` is the public engine view; answer keys, future questions and
  action receipts live in `games.game_private_state` and are never selected for a response.
  Joker choices are private per actor: only authenticated HTTP action/GET may project
  `actorView.joker`. Shared `gameState` and sockets must never carry `hiddenOptions`.
  Catch-up uses persisted deadlines, not reader/worker `now` as the next round start.
  Capture trusted action time before pool/lock waits. Never reopen an already-closed round
  or credit a timestamp preceding its start. See `docs/ops/game-authority-review.md` for
  unresolved cross-instance ordering and aim-playability release blockers.
- Competitive actions go through `POST /api/games/:id/actions` (authenticated HTTP, never a
  socket): `{ actionId, roundId, type, optionIndex? }`. DB rows are locked with
  `SELECT ... FOR UPDATE`; memory games use `gameLock`. Retries with the same payload return the
  stored receipt, a changed payload with the same `actionId` is `409 ACTION_ID_CONFLICT`, and
  the client timestamp is ignored. Socket events only announce a revision; clients refetch the
  snapshot.
- `backend/gameEngine/quizEngine.js` is pure and time-driven: callers pass the server clock and
  persist the returned state. quiz question data lives in
  `backend/gameEngine/data/quizQuestions.json`; the client must not import the ranked bank.
  The 396 questions were published in an older client bundle, so they are not secret history;
  the server bank only prevents new matches from exposing answers and future questions.
- `backend/gameEngine/aimEngine.js` is the same shape for Nişancı Düellosu: 5 rounds of 8 s plus
  750 ms feedback, one common server-seeded trajectory (`shared/aimTrajectory.js`, client and
  server share the position function), and score only from the server-side position function.
  Lag compensation (approved 2026-10-22): `fire` may carry `shotAt`, the client's server-clock
  time of the reticle frame on screen; the engine clamps it to `[receipt − AIM_MAX_REWIND_MS
(250), receipt]` and to the round start, and the deadline still uses receipt time. Zones are
  `AIM_ZONES` (3/2/1 points within 2.5/6/12 units of the centre); the trajectory carries a
  seeded two-wave `rhythm` around the mean speed, integrated in closed form, and a trajectory
  without one keeps constant speed. Every client threshold reads the shared zones. The
  competitive gauge speed is the same on touch and desktop; `pointer: coarse` may change
  practice presentation only.
- `backend/gameEngine/battleshipEngine.js` runs Amiral Battı with the rules in
  `shared/battleship.js` (8x8, fleet 4+3+3+2, 45 s placement, 20 s turns, no extra shot on a
  hit, three missed turns forfeit, 128-turn cap: 64 cells per player). Fleets, seeded auto layouts and the first
  turn stay in `game_private_state`; the public state holds only shots, sunk ship shapes and
  the turn — until the match is over: `finish` copies the placed fleets into public
  `reveal`, and `gameView` publishes it only when `phase === 'finished'`. A player's own fleet is projected as `actorView.fleet` by authenticated HTTP
  action/GET only, never on discovery/history. Actions: `place {layout}` or server-seeded
  `place {auto:true}`, and `fire {cell}`; turn ids run `r1`..`r999`. Both strict numeric
  coordinates and the full legal action ledger are retained across retries.
- Settlement for a competitive engine game happens only in `backend/gameEngine/settlement.js`
  and at most once: the `games` row is locked, the public engine result gets
  `settled/settledAt/transferredPoints`, and `applyDbSettlement`/`applyMemorySettlement` runs in
  the same transaction. Never let `/finish`, `/resign`, deletion or a socket event choose a
  winner. `/resign` answers `USE_ENGINE_ACTION` for competitive games; resignation goes through
  `POST /actions` with `type: "resign"`. `/finish` only queries/finalizes the engine result.
- `games.game_state.engine.result.cancelled` with `reason: "abandoned"` marks a match where
  neither player produced an accepted action; it must not touch balances or games_played.
- `backend/jobs/gameEngineJobs.js` advances expired engine clocks and settles finished matches in
  bounded batches. It relies on the row lock and the `settled` flag, so multiple instances and a
  reader/action/finish race are safe. Do not force-close engine rows from the cleanup job. It
  picks every phase except `waiting`/`finished` whose `phaseEndsAt` passed; never list an
  engine's phases by name there.
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
