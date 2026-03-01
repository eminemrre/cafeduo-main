# CafeDuo Implementation Details

This document consolidates implementation details for key systems.

## Table of Contents
- [Game State Machine](#game-state-machine)
- [Lobby Cache](#lobby-cache)
- [Socket Authentication](#socket-authentication)
- [Token Blacklist](#token-blacklist)
- [Performance Indexes](#performance-indexes)

---

## Game State Machine

**Last Updated:** 2026-02-14  
**Scope:** CafeDuo PvP game flow

### States

- `waiting`: Game created, waiting for second player.
- `active`: Game started, accepting moves/progression.
- `finishing`: Finalization phase (intermediate state for async finalize).
- `finished`: Game concluded, winner/draw finalized.

### Valid Transitions

| From | To | Reason |
|---|---|---|
| `waiting` | `active` | Player joined game |
| `waiting` | `finished` | Forced closure / admin closure |
| `active` | `active` | Game in progress (move) |
| `active` | `finishing` | Finalization start (optional) |
| `active` | `finished` | Timeout, resignation, checkmate, draw, finalization |
| `finishing` | `finished` | Finalization complete |
| `finished` | `finished` | Idempotent retry |

### Invalid Transitions

API returns consistent `4xx` (mostly `409`):

- `waiting -> finishing`
- `finished -> active`
- Unknown status values (e.g., `paused`)
- Move/score/live/game_state update attempts outside `active`

Error format:
```json
{
  "error": "Invalid game state transition (...)",
  "code": "invalid_status_transition",
  "fromStatus": "waiting",
  "toStatus": "active"
}
```

### Rejoin Contract

- `waiting`: Host stays in lobby. Second player `join` makes game `active`.
- `active`: Host/guest can rejoin idempotently. Third player gets `409`.
- `finishing`: New joins and moves closed, only finalization pending.
- `finished`: Cannot be reactivated via `join`. Game state is read-only.

### Implementation Points

- `POST /api/games/:id/join`: Applies `waiting -> active` transition
- `POST /api/games/:id/move`: Requires active game for chess/live/score/legacy moves
- `POST /api/games/:id/finish`: Accepts `finished` idempotently

---

## Lobby Cache

Redis-based lobby cache layer reduces DB load for waiting games lists.

### Cache Strategy

- **Pattern**: Cache-aside
- **TTL**: 60 seconds (safety net, primary invalidation is write-through)
- **Invalidation**: Write-through (clear cache immediately on game change)
- **Fallback**: Graceful (falls back to DB when Redis unavailable)

### Cache Keys

```
lobby:all           -> All waiting games
lobby:table:{code}  -> Table-specific games (e.g., lobby:table:masa01)
lobby:cafe:{id}     -> Cafe-specific games (e.g., lobby:cafe:5)
```

### Files

- `backend/services/lobbyCacheService.js` - Cache service factory
- `backend/services/gameService.js` - Uses cache service
- `backend/handlers/gameHandlers.js` - Triggers cache invalidation
- `backend/server.js` - Initializes cache service

### Performance Impact

**Before:**
- Every lobby request = DB query
- P95 latency: ~100-200ms

**After:**
- Cache hit: ~1-5ms (Redis)
- Cache miss: ~100-200ms (DB + cache write)
- Expected 90%+ cache hit rate
- P95 latency: ~10-20ms

### Configuration

```javascript
// backend/services/lobbyCacheService.js
const CACHE_TTL_SECONDS = 60; // Safety net TTL
```

### Monitoring

```javascript
const stats = await lobbyCacheService.getCacheStats();
console.log(`Cache keys: ${stats.keyCount}`);
```

---

## Socket Authentication

Socket.IO authentication middleware validates JWT tokens for WebSocket connections.

### Implementation

**File:** `backend/middleware/socketAuth.js`

### Features

- JWT validation via `socket.auth.token`
- Token blacklist checking (fail-closed on Redis errors)
- Fresh user data fetch from database
- Graceful fallback to memory state

### Blacklist Behavior

```javascript
// Fail-closed: Reject connection when Redis check fails
if (redisError) {
  logger.error('Socket.IO: Redis blacklist check failed');
  return next(new Error('Authentication service unavailable'));
}
```

### Environment Variables

```bash
BLACKLIST_FAIL_MODE=closed  # Reject auth when Redis fails (recommended for prod)
```

---

## Token Blacklist

JWT token blacklist for logout and token revocation.

### Implementation

**File:** `backend/middleware/socketAuth.js` (lines 76-111)

### Redis Key Format

```
blacklist:{jti} -> "revoked"
TTL: Token expiration time
```

### Operations

**Add to blacklist (logout):**
```javascript
await redisClient.set(`blacklist:${decodedToken.jti}`, 'revoked');
await redisClient.expireat(`blacklist:${decodedToken.jti}`, decodedToken.exp);
```

**Check blacklist:**
```javascript
const isBlacklisted = await redisClient.get(`blacklist:${decodedToken.jti}`);
if (isBlacklisted) {
  return next(new Error('Token has been revoked'));
}
```

---

## Performance Indexes

Database indexes for optimized query performance.

### Indexes

**File:** `migrations/20240224000002_add_performance_indexes.js`

### Key Indexes

```sql
-- Game lookups
CREATE INDEX idx_games_status_created ON games(status, created_at);
CREATE INDEX idx_games_participants_username ON games(participants, username);

-- User queries
CREATE INDEX idx_users_points ON users(points DESC);
CREATE INDEX idx_users_department ON users(department);

-- Cafe queries
CREATE INDEX idx_cafes_location ON cafes USING GIST(
  (ST_MakePoint(longitude, latitude)::geography)
);
```

### Monitoring

```sql
-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

---

## Additional References

- **Game Assets:** See `docs/GAME_ASSET_SOURCES.md`
- **Multiplayer Spec:** See `docs/SOCIAL_GAMES_MULTIPLAYER_SPEC.md`
- **MCP Setup:** See `docs/skills_mcp_setup.md`
- **Production Credentials:** See `docs/PRODUCTION_CREDENTIALS_SETUP.md`
