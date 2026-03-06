# Cookie Authentication Troubleshooting Guide

## Production Socket.IO Authentication Failure

### Symptoms
- Console error: "Authentication required: No token provided"
- Socket.IO connection failing in production
- Game creation failing with "Host nickname and game type are required"

### Root Cause Analysis

The authentication cookie (`auth_token`) is not being sent with Socket.IO WebSocket upgrade requests in production. This can happen due to:

1. **Incorrect COOKIE_DOMAIN setting**
2. **Missing credentials configuration**
3. **CORS misconfiguration**

### Architecture Overview

```
Client (Browser)
    ↓ HTTPS
Caddy Reverse Proxy (cafeduotr.com)
    ↓ /api/* → Backend (api:3001)
    ↓ /socket.io/* → Backend (api:3001)
    ↓ /* → Frontend (web:80)
```

Both frontend and backend are served from **the same domain** (cafeduotr.com) via Caddy proxy.

### Cookie Configuration

#### Backend Cookie Settings
File: `backend/controllers/authController.js:189-196`

```javascript
const buildAuthCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',  // true for HTTPS
    sameSite: 'lax',  // CORRECT for same-origin deployment
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined,  // Should be EMPTY
});
```

#### Frontend Configuration
- API client: `credentials: 'include'` (line 213 in `lib/api.ts`)
- Socket.IO client: `withCredentials: true` (line 61 in `lib/socket.ts`)

### Solution Checklist

#### 1. Verify COOKIE_DOMAIN in Production .env

**CRITICAL**: For same-domain deployment, `COOKIE_DOMAIN` must be **empty** (not set).

```bash
# ✅ CORRECT - Leave empty for same-domain
COOKIE_DOMAIN=

# ❌ WRONG - Do not set domain
COOKIE_DOMAIN=.cafeduotr.com  # Only needed for subdomain sharing

# ❌ WRONG - Do not set domain
COOKIE_DOMAIN=cafeduotr.com  # Only needed for subdomain sharing
```

**Why?** When `domain` is not set, cookies are automatically scoped to the exact origin (cafeduotr.com), which is what we want for same-domain deployment.

#### 2. Verify CORS Configuration

Check `backend/server.js` CORS settings:

```javascript
// Line 425-441
app.use(cors({
  origin: (origin, callback) => {
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Origin not allowed'));
    }
  },
  credentials: true,  // ✅ Required for cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
```

Ensure `CORS_ORIGIN` in production .env includes your domain:
```bash
CORS_ORIGIN=https://cafeduotr.com,https://www.cafeduotr.com
```

#### 3. Verify Socket.IO CORS Configuration

Check `backend/server.js` Socket.IO settings:

```javascript
// Line 302-308
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true  // ✅ Required for cookies
  }
});
```

#### 4. Check Cookie Parser Middleware

Verify cookie-parser is loaded **before** routes:

```javascript
// backend/server.js:423
app.use(cookieParser());
```

And Socket.IO cookie parsing middleware:

```javascript
// backend/server.js:311-315
io.use((socket, next) => {
  const cookieHeader = socket.handshake?.headers?.cookie;
  socket.request.cookies = cookieHeader ? cookie.parse(cookieHeader) : {};
  next();
});
```

### Testing in Production

#### 1. Test Cookie is Being Set

After login, open browser DevTools → Application → Cookies → `cafeduotr.com`

Verify `auth_token` cookie exists with:
- ✅ HttpOnly: true
- ✅ Secure: true
- ✅ SameSite: Lax
- ✅ Domain: cafeduotr.com (NOT .cafeduotr.com)
- ✅ Path: /

#### 2. Test Cookie is Being Sent

Open Network tab and filter for WebSocket connections:
- Find the Socket.IO connection request
- Check Request Headers
- Verify `Cookie: auth_token=...` is present

#### 3. Check Backend Logs

SSH into production server and check logs:

```bash
docker logs cafeduo-api-1 --tail=100 -f
```

Look for:
- ✅ "Socket authenticated successfully" - Cookie is working
- ❌ "Socket connection rejected: No token provided" - Cookie not being sent

### Common Mistakes

#### ❌ Setting sameSite: 'none'
**Wrong approach**: Changing `sameSite` to `'none'` for same-domain deployment.

```javascript
// ❌ WRONG for same-domain deployment
sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
```

**Why it's wrong**: 
- `sameSite: 'none'` is only needed for **cross-domain** cookies
- Requires `secure: true` (HTTPS)
- Unnecessary overhead for same-domain deployment
- Reduces security (cookie sent to third-party sites)

**Correct approach**: Use `sameSite: 'lax'` for same-domain deployment.

#### ❌ Setting COOKIE_DOMAIN incorrectly

```bash
# ❌ WRONG - Domain with leading dot shares with subdomains
COOKIE_DOMAIN=.cafeduotr.com

# ❌ WRONG - Sets cookie for specific domain, but frontend is also same domain
COOKIE_DOMAIN=cafeduotr.com
```

Both approaches can cause issues:
1. Browser may not send cookie with WebSocket upgrade (different security context)
2. Cookie scope may not match request origin

**Correct approach**: Leave `COOKIE_DOMAIN` empty (not set in .env).

#### ❌ Missing credentials: true

If either the frontend API client or Socket.IO client is missing `credentials: true` / `withCredentials: true`, cookies won't be sent.

### Deployment Steps

1. **Update production .env**:
   ```bash
   # Ensure these are set correctly
   NODE_ENV=production
   COOKIE_DOMAIN=  # EMPTY - do not set
   CORS_ORIGIN=https://cafeduotr.com,https://www.cafeduotr.com
   ```

2. **Update GitHub Actions secret source of truth**:
   The VPS deploy workflow rewrites production `.env` from `DEPLOY_ENV_B64` on every deploy.
   If you only edit `/opt/cafeduo-main/.env` manually, the next deploy will restore the old value.

   Permanent fix:
   - Update `DEPLOY_ENV_B64` in GitHub repository secrets
   - Make sure the encoded env contains `COOKIE_DOMAIN=`
   - Keep `DEPLOY_SITE_URL`, `SMOKE_LOGIN_EMAIL`, and `SMOKE_LOGIN_PASSWORD` set so authenticated public smoke can run
   - Strict deploy validation now fails early if these secrets are missing or if `CORS_ORIGIN` does not include the public site origin

3. **Rebuild and redeploy**:
   ```bash
   cd /home/emin/cafeduo-main
   git pull origin main
   cd deploy
   docker compose -f docker-compose.prod.yml down
   docker compose -f docker-compose.prod.yml up -d --build
   ```

4. **Test authentication**:
   - Clear browser cookies
   - Login to application
   - Verify Socket.IO connection succeeds
   - Test game creation

5. **Monitor logs**:
   ```bash
   docker logs cafeduo-api-1 -f | grep -i "socket\|auth"
   ```

### Additional Notes

#### Why sameSite: 'lax' Works for Same-Domain

When frontend and backend are served from the same domain:
- **Same-origin requests**: Browser sends cookies automatically
- **Same-site requests**: `sameSite: 'lax'` allows cookies
- **Top-level navigation**: Cookies sent with GET requests
- **WebSocket upgrade**: Treated as same-origin when domain matches

#### When to Use sameSite: 'none'

Only needed when:
- Frontend and backend are on **different domains**
- Example: frontend on `app.example.com`, backend on `api.example.com`
- Requires `secure: true` (HTTPS only)
- More permissive security model

#### Caddy Proxy Benefits

Caddy automatically handles:
- TLS/SSL certificates (Let's Encrypt)
- Request routing to correct service
- Same-origin request forwarding
- Automatic cookie forwarding (when domain matches)

### References

- Cookie Migration Analysis: `docs/COOKIE_MIGRATION_ANALYSIS.md`
- Production .env Template: `.env.production.example`
- Caddyfile Configuration: `deploy/Caddyfile`
- Backend Cookie Settings: `backend/controllers/authController.js`
- Frontend API Client: `lib/api.ts`
- Frontend Socket Client: `lib/socket.ts`
