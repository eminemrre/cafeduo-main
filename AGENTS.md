# AGENTS.md

## Must-follow constraints

### Database
- **Never use `SELECT *`** - Always specify explicit columns. See `OPTIMIZATIONS.md` Finding 1.
- **Always add `LIMIT` clauses** to user-facing queries (leaderboard, inventory, history). Default to 100 for lists, 50 for leaderboards.
- **Use `node-pg-migrate` for ALL schema changes** - Never hand-edit `backend/server.js` initDb schema.
- **Test migrations both ways**: `npm run migrate:up && npm run migrate:down && npm run migrate:up` before committing.

### Backend queries
- **Avoid N+1 patterns** - Use CTEs or JOINs instead of loops with queries. See `OPTIMIZATIONS.md` Finding 3.
- **Never use `redis.keys(pattern)`** - Use `redis.scan()` with cursor. See `OPTIMIZATIONS.md` Finding 5.
- **Cache invalidation must use SCAN** - `clearCache()` functions must iterate, not KEYS.

### Frontend
- **No 4-second polling** - Use Socket.IO `lobby_updated` event for real-time updates. Polling fallback max 15s.
- **Never call `localStorage` in render path** - Batch reads in useEffect, defer JSON parsing with `await Promise.resolve()`.
- **Use `lazyWithRetry()` for all route components** - Never direct imports for Games, Dashboard, AdminDashboard, CafeDashboard, Store, ResetPasswordPage.

### Security
- *****REMOVED*** must be 64+ chars** - Generate with `openssl rand -hex 64`. Server will refuse to start otherwise.
- **Never log password_hash or tokens** - Use redacted fields in logs.
- **BLACKLIST_FAIL_MODE=closed** in production - Reject auth when Redis blacklist check fails.

## Validation before finishing

```bash
# Backend
npm run test                    # Unit tests
npm run migrate:status          # Check migrations

# Frontend  
npm run test:ci                 # Jest with coverage
npm run build                   # Vite build must succeed

# E2E (if touching user flows)
npm run test:e2e                # Playwright

# Full check
npm run test:all                # Unit + E2E
```

## Repo-specific conventions

### File structure
- **Backend is CommonJS** (`.js`), **Frontend is TypeScript** (`.ts/.tsx`)
- **Backend entry**: `backend/server.js`
- **Frontend entry**: `index.tsx`, `App.tsx`
- **Components**: Co-located with `.test.tsx` files
- **Hooks**: `hooks/` with `.test.ts` files
- **Types**: Root-level `types.ts` (not `src/types.ts`)

### Module resolution
- **Frontend**: `@/*` alias maps to root (not `src/`)
- **Backend**: Relative paths only, no path aliases

### Database
- **Connection pool**: Default 10, configure via `DB_POOL_MAX` env var (recommend 20 for production)
- **Migrations**: Use `npm run migrate:create <name>` - files go to `migrations/`
- **Indexes**: See `migrations/20240224000002_add_performance_indexes.js` for patterns

### Socket.IO
- **Auth**: Socket uses JWT via `socket.auth.token` - see `backend/middleware/socketAuth.js`
- **Events**: `join_game`, `game_move`, `update_game_state`, `lobby_updated`
- **Broadcast**: Call `emitLobbyUpdate(tableCode)` after game mutations

### Environment variables
- **Frontend vars**: Must be prefixed `VITE_` to be available in browser
- **Backend vars**: Standard `process.env.VAR_NAME`
- **Never commit** `.env` files - use `.env.example` and `.env.production.example` as templates

## Important locations

| Purpose | Location |
|---------|----------|
| DB migrations | `migrations/` |
| Backend middleware | `backend/middleware/` |
| Game handlers | `backend/handlers/gameHandlers.js` |
| Socket auth | `backend/middleware/socketAuth.js` |
| Lobby cache | `backend/services/lobbyCacheService.js` |
| API client | `lib/api.ts` |
| Socket client | `lib/socket.ts` |
| Type definitions | `types.ts` (root) |
| Test setup | `test-setup.ts` |

## Change safety rules

### Breaking changes require migration
- Adding non-nullable columns to existing tables
- Removing or renaming columns
- Changing column types that lose data
- Use multi-step migrations: add nullable → backfill → make non-nullable → deploy code

### Cache coordination
- **Invalidating lobby cache**: Call `lobbyCacheService.onGameCreated/onGameJoined/onGameDeleted/onGameFinished`
- **Clearing pattern cache**: Use `clearCache('pattern:*')` - it now uses SCAN internally

### Game state mutations
- All game state changes must go through `gameHandlers.js` - never direct DB writes
- Chess moves use `gameMoveService.js` with transaction locking
- Emit Socket.IO events after successful DB commit

## Known gotchas

### Memory fallback mode
- When DB is unavailable, app falls back to `backend/store/memoryState.js`
- Test both paths: set invalid `***REMOVED***` to verify memory mode works
- Never assume DB is connected - always check `await isDbConnected()`

### Email canonicalization
- Gmail addresses are canonicalized (`user+tag@gmail.com` → `user@gmail.com`)
- See `backend/controllers/authController.js:66-101` for logic
- Affects login, registration, password reset lookups

### Table code normalization
- Table codes must be format `MASA##` (e.g., `MASA05`)
- Both `5` and `MASA05` normalize to `MASA05`
- Normalization logic duplicated in frontend (`hooks/useGames.ts:59-68`) and backend (`backend/server.js:149-158`)

### Bootstrap admins
- Emails in `BOOTSTRAP_ADMIN_EMAILS` env var auto-promote to admin role on login/register
- Also promoted on server startup via `promoteBootstrapAdmins()` in `backend/server.js`

### Rate limiting
- Auth endpoints have stricter limits than general API
- Redis-backed rate limiting requires `***REMOVED***` - falls back to in-memory if unavailable
- `RATE_LIMIT_PASS_ON_STORE_ERROR=false` means reject requests when Redis fails (recommended for prod)

### PWA disabled
- Vite 7 incompatibility - `vite-plugin-pwa` commented out in `vite.config.ts`
- Do not add PWA-related code until plugin is updated
