# Token Blacklist Implementation

## Overview

Server-side session invalidation using Redis token blacklist. When a user logs out, their JWT token is added to a Redis blacklist with a TTL equal to the token's remaining lifetime. All subsequent authenticated requests check this blacklist before accepting the token.

## Architecture

```
┌─────────┐         ┌──────────────┐         ┌─────────┐
│ Client  │────────▶│ Auth Middleware│────────▶│ Redis   │
└─────────┘         └──────────────┘         └─────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Protected  │
                    │    Route     │
                    └──────────────┘
```

## Implementation Details

### 1. Auth Middleware (`backend/middleware/auth.js`)

The [`authenticateToken`](backend/middleware/auth.js:25) middleware now checks the token blacklist before verifying the JWT:

```javascript
// Check token blacklist (Redis-based session invalidation)
let isBlacklisted = false;

// First check Redis blacklist
if (redisClient && redisClient.status === 'ready') {
    try {
        isBlacklisted = await redisClient.get(`blacklist:token:${token}`);
    } catch (redisErr) {
        console.warn('Redis blacklist check failed:', redisErr.message);
    }
}

// Fallback to in-memory blacklist if Redis not available
if (!isBlacklisted && global.tokenBlacklist) {
    const entry = global.tokenBlacklist.get(token);
    if (entry) {
        const now = Math.floor(Date.now() / 1000);
        if (entry < now) {
            global.tokenBlacklist.delete(token);
        } else {
            isBlacklisted = true;
        }
    }
}

if (isBlacklisted) {
    return sendAuthError(res, {
        status: 401,
        code: 'TOKEN_REVOKED',
        message: 'Session has been revoked. Please log in again.',
    });
}
```

### 2. Logout Endpoint (`backend/controllers/authController.js`)

The [`logout`](backend/controllers/authController.js:686) endpoint adds the token to the blacklist:

```javascript
async logout(req, res) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.slice(7); // Remove 'Bearer ' prefix

    if (token) {
        const decoded = jwt.decode(token);
        if (decoded?.exp) {
            const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
            
            if (expiresIn > 0) {
                if (redisClient?.status === 'ready') {
                    await redisClient.setex(`blacklist:token:${token}`, expiresIn, '1');
                } else {
                    // Fallback: in-memory blacklist
                    if (!global.tokenBlacklist) {
                        global.tokenBlacklist = new Map();
                    }
                    global.tokenBlacklist.set(token, decoded.exp);
                }
            }
        }
    }

    return res.json({ success: true, message: 'Logged out successfully.' });
}
```

### 3. Frontend Integration (`lib/api.ts`)

The [`logout`](lib/api.ts:307) function now calls the server endpoint before clearing local storage:

```typescript
logout: async (): Promise<void> => {
    const token = localStorage.getItem('token');
    if (token) {
        try {
            await fetchAPI('/auth/logout', { method: 'POST' });
        } catch {
            // Server-side invalidation is best-effort
        }
    }
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('cafe_user');
}
```

## Redis Key Structure

- **Key Pattern**: `blacklist:token:{token}`
- **Value**: `"1"` (any truthy value)
- **TTL**: Token's remaining lifetime in seconds

## Fallback Behavior

When Redis is unavailable:
1. Logout uses in-memory `global.tokenBlacklist` Map
2. Auth middleware checks the in-memory Map
3. Expired entries are automatically cleaned up

**Note**: In-memory blacklist is per-process and doesn't scale across multiple server instances. Use Redis in production.

## Security Considerations

1. **Fail-Open**: If Redis check fails, the request proceeds. This prevents denial-of-service but may allow revoked tokens during Redis outages.

2. **Token Expiry**: Blacklisted tokens automatically expire from Redis when the JWT would have expired anyway.

3. **Memory Cleanup**: In-memory blacklist entries are cleaned up on access when expired.

## Testing

### Manual Test

```bash
# 1. Login and get token
TOKEN=$(curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  | jq -r '.token')

# 2. Use token successfully
curl http://localhost:3001/auth/me \
  -H "Authorization: Bearer $TOKEN"

# 3. Logout
curl -X POST http://localhost:3001/auth/logout \
  -H "Authorization: Bearer $TOKEN"

# 4. Token should now be rejected
curl http://localhost:3001/auth/me \
  -H "Authorization: Bearer $TOKEN"
# Response: 401 TOKEN_REVOKED
```

### Verify Redis

```bash
redis-cli
> KEYS blacklist:token:*
> TTL blacklist:token:<your-token>
```

## Environment Variables

No additional environment variables required. Uses existing `REDIS_URL`.

## Related Files

- [`backend/middleware/auth.js`](backend/middleware/auth.js) - Token blacklist check
- [`backend/controllers/authController.js`](backend/controllers/authController.js) - Logout endpoint
- [`backend/routes/authRoutes.js`](backend/routes/authRoutes.js) - Route registration
- [`lib/api.ts`](lib/api.ts) - Frontend logout call
- [`backend/config/redis.js`](backend/config/redis.js) - Redis client configuration
