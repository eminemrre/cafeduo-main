# CafeDuo

CafeDuo is a production-ready MVP for cafe-based social gaming and loyalty. Users check in at a cafe table, create or join two-player games, earn points, and redeem cafe rewards. Cafe admins manage their own cafe rewards and location data; general admins manage cafes, users, and assignments.

## Current MVP Status

Status: MVP-ready after the latest hardening pass.

What is complete:

- XPatla-inspired dark/red cyber UI across the core user, admin, cafe admin, game, and form flows.
- Auth, check-in, dashboard, cafe creation, cafe admin assignment, rewards, inventory, leaderboard, and password reset flows.
- Two-player game integrity for lobby creation, joining, finishing, resignation, and server-side score settlement.
- Socket.IO room protection: only game participants or admins can join a game room; only joined sockets can broadcast moves or state updates.
- PostgreSQL migrations for schema evolution, including the cafe/admin schema alignment migration.
- Dokploy-compatible deployment through GitHub `main`.
- OpenAPI document loads cleanly and `/api-docs` is served once.

## Production Flow

The active deployment flow is:

1. Commit to GitHub `main`.
2. Dokploy pulls/builds from GitHub.
3. Backend runs on Node/Express with PostgreSQL and Redis.
4. Frontend is served from the Vite production build.

Do not commit real `.env` files. Configure production secrets in Dokploy or the host environment.

Important production environment values:

- `JWT_SECRET`: 64+ random hex characters.
- `DATABASE_URL`: PostgreSQL connection string.
- `REDIS_URL`: Redis connection string.
- `CORS_ORIGIN`: public frontend origin.
- `BLACKLIST_FAIL_MODE=closed`.
- `RATE_LIMIT_PASS_ON_STORE_ERROR=false`.
- `BOOTSTRAP_ADMIN_EMAILS=emin3619@gmail.com`.
- `BOOTSTRAP_ADMIN_PASSWORD`: set in Dokploy/host env, not in git.

## Tech Stack

| Area | Stack |
| --- | --- |
| Frontend | React 18, TypeScript, Vite |
| UI | Tailwind CSS, Framer Motion, lucide-react |
| Backend | Node.js, Express, CommonJS |
| Realtime | Socket.IO |
| Database | PostgreSQL |
| Cache | Redis |
| Auth/Security | JWT, bcrypt, Helmet, CSRF, rate limiting, token blacklist |
| Testing | Jest, React Testing Library, Playwright |
| Deploy | Docker, Docker Compose, Dokploy |

## Local Development

Use Windows-safe commands in PowerShell:

```powershell
npm.cmd install
copy .env.example .env
npm.cmd run migrate:up
npm.cmd run dev
```

Local endpoints:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- API docs: `http://localhost:3001/api-docs`
- Readiness: `http://localhost:3001/readiness`

## Validation

Run these before shipping behavior changes:

```powershell
npm.cmd run test:ci
npm.cmd run build
npm.cmd run test:e2e
```

For database changes:

```powershell
npm.cmd run migrate:up
npm.cmd run migrate:down
npm.cmd run migrate:up
npm.cmd run migrate:status
```

Latest verified local gates:

- `node --check backend/server.js`
- OpenAPI YAML parse with `yamljs` and `js-yaml`
- Targeted Jest for route/socket registry
- `npm.cmd run test:ci` with 812 passing tests
- `npm.cmd run build`
- `npm.cmd run test:e2e` with 14 passing Playwright tests

## MVP Acceptance Checklist

- User can register/login/logout.
- User must check in before regular dashboard/game actions.
- User can create a game at a normalized table code.
- A second user can join a waiting game exactly once.
- Race conditions keep a single guest and consistent game status.
- Tank battle winner is resolved from server-side scores, not spoofed client finish payloads.
- Resign/finalize blocks further score writes.
- Socket game-room traffic is limited to game participants/admins.
- Cafe can be created by admin.
- Cafe admin can be assigned and can manage cafe-scoped rewards/location.
- Rewards can be purchased and inventory can be viewed.
- Production build and E2E smoke/advanced flows pass.

## Key Files

- Backend entry: `backend/server.js`
- Game routes: `backend/routes/gameRoutes.js`
- Game handlers: `backend/handlers/gameHandlers.js`
- Game services: `backend/services/gameMoveService.js`
- Socket auth: `backend/middleware/socketAuth.js`
- Frontend entry: `App.tsx`, `index.tsx`
- API client: `lib/api.ts`
- Socket client: `lib/socket.ts`
- Main progress note: `PROJECT_PROGRESS.md`
- Deployment guide: `DEPLOYMENT.md`
- Security notes: `SECURITY.md`
- Optimization notes: `OPTIMIZATIONS.md`

## Repo Rules

- Read `PROJECT_PROGRESS.md` before project commands.
- Follow `AGENTS.md` for database, Socket.IO, frontend, security, and validation constraints.
- Use explicit SQL columns; never use `SELECT *`.
- Add limits to user-facing list queries.
- Use migrations for schema changes.
- Prefer Socket.IO updates; polling fallbacks must stay at 15 seconds or slower.

## License

MIT.
