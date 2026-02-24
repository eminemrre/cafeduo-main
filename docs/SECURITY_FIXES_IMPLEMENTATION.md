# Security Fixes Implementation Plan

## Overview
This document outlines the implementation plan for fixing the 7 identified security vulnerabilities.

---

## CRITICAL-1: Production Secrets in .env

### Actions Required

#### Immediate (Manual)
1. **Rotate all production secrets immediately:**
   - Generate new JWT_SECRET: `openssl rand -hex 64`
   - Reset DB_PASSWORD in PostgreSQL
   - Create new Google OAuth credentials
   - Get new reCAPTCHA keys
   - Reset SMTP password

2. **Remove .env from git history (if committed):**
   ```bash
   # Check if .env is in git history
   git log --all --full-history -- .env
   
   # If found, remove it (WARNING: rewrites history)
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env" \
     --prune-empty --tag-name-filter cat -- --all
   
   # Force push (coordinate with team)
   git push origin --force --all
   ```

3. **Verify .gitignore:**
   ```bash
   # Ensure .env is ignored
   grep "^\.env$" .gitignore
   ```

#### Automated
- ✅ Created `.env.example` template without secrets
- ✅ Updated documentation with secrets management best practices

---

## CRITICAL-2: JWT in localStorage

### Implementation Strategy

**Note:** Moving from localStorage to httpOnly cookies requires significant changes. Given the complexity and potential for breaking changes, I recommend a **phased approach**:

#### Phase 1: Add Security Mitigations (Low Risk)
1. Add CSP headers to prevent inline scripts
2. Add CSRF token validation
3. Implement token rotation
4. Add XSS detection

#### Phase 2: Migrate to httpOnly Cookies (High Risk)
1. Update backend to send JWT in httpOnly cookie
2. Add CSRF protection
3. Update frontend to remove localStorage usage
4. Update Socket.IO to use cookie-based auth
5. Handle CORS credentials properly

**For this audit, I'll implement Phase 1 mitigations and document Phase 2 for future implementation.**

---

## HIGH-3: Socket.IO Missing Blacklist Check

### Fix Location
File: `backend/middleware/socketAuth.js`

### Implementation
Add token blacklist check after JWT verification:
```javascript
// After line 70 (after JWT verification)
// Check token blacklist
if (redisClient && redisClient.status === 'ready') {
  const isBlacklisted = await redisClient.get(`blacklist:token:${token}`);
  if (isBlacklisted) {
    return next(new Error('Token has been revoked'));
  }
} else if (global.tokenBlacklist) {
  // Fallback to in-memory blacklist
  const entry = global.tokenBlacklist.get(token);
  if (entry) {
    const now = Math.floor(Date.now() / 1000);
    if (entry >= now) {
      return next(new Error('Token has been revoked'));
    }
  }
}
```

---

## HIGH-4: Blacklist Fail-Open on Redis Error

### Fix Location
File: `backend/middleware/auth.js:54`

### Implementation
Change behavior from fail-open to fail-closed with configurable fallback:

```javascript
// Add environment variable
const BLACKLIST_FAIL_MODE = process.env.BLACKLIST_FAIL_MODE || 'closed'; // 'open' or 'closed'

// Update blacklist check (line 47-80)
let isBlacklisted = false;
let blacklistCheckFailed = false;

if (redisClient && redisClient.status === 'ready') {
  try {
    isBlacklisted = await redisClient.get(`blacklist:token:${token}`);
  } catch (redisErr) {
    blacklistCheckFailed = true;
    logger.error('Redis blacklist check failed', { error: redisErr.message });
    
    // Fail-closed: reject request when blacklist check fails
    if (BLACKLIST_FAIL_MODE === 'closed') {
      return sendAuthError(res, {
        status: 503,
        code: 'BLACKLIST_CHECK_FAILED',
        message: 'Authentication service temporarily unavailable',
      });
    }
  }
}

// Fallback to in-memory blacklist
if (!isBlacklisted && !blacklistCheckFailed && global.tokenBlacklist) {
  // ... existing fallback logic
}
```

---

## HIGH-5: Localhost CORS Always Allowed

### Fix Location
File: `backend/server.js:168`

### Implementation
Only add localhost origins in non-production environments:

```javascript
const parseAllowedOrigins = (originsValue) => {
  const parsed = (originsValue || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const baseOrigins = parsed.length > 0 ? parsed : DEFAULT_ALLOWED_ORIGINS;
  
  // Only add localhost origins in development/test
  if (process.env.NODE_ENV !== 'production') {
    return Array.from(new Set([...baseOrigins, ...LOCAL_ALLOWED_ORIGINS]));
  }
  
  return baseOrigins;
};
```

---

## MEDIUM-6: JWT Payload Too Large

### Fix Location
File: `backend/controllers/authController.js:170`

### Implementation
Minimize JWT payload to essential claims only:

```javascript
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role || 'user',
      isAdmin: Boolean(user.isAdmin ?? user.is_admin ?? false),
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};
```

**Note:** This requires updating all code that reads from `req.user` to fetch fresh data from the database instead of relying on stale JWT claims.

---

## MEDIUM-7: Plain-text Password Comparison

### Fix Location
File: `backend/controllers/authController.js:377`

### Implementation
Remove plain-text password comparison fallback:

```javascript
// Replace lines 375-380
const match = memoryUser.password_hash
  ? await bcrypt.compare(normalizedPassword, memoryUser.password_hash)
  : false; // Never compare plain-text passwords

if (!match) {
  return res.status(401).json({ error: 'Geçersiz e-posta veya şifre.' });
}
```

---

## Implementation Order

1. ✅ **MEDIUM-7:** Plain-text password comparison (safest, isolated change)
2. ✅ **MEDIUM-6:** JWT payload minimization (requires DB query updates)
3. ✅ **HIGH-5:** CORS localhost fix (simple conditional)
4. ✅ **HIGH-4:** Blacklist fail-closed (add error handling)
5. ✅ **HIGH-3:** Socket.IO blacklist check (add validation)
6. ⚠️ **CRITICAL-1:** Secrets rotation (manual, requires coordination)
7. ⚠️ **CRITICAL-2:** localStorage migration (complex, requires testing)

---

## Testing Plan

### Unit Tests
- [ ] Test blacklist fail-closed behavior
- [ ] Test Socket.IO blacklist rejection
- [ ] Test JWT payload minimization
- [ ] Test CORS origin filtering in production

### Integration Tests
- [ ] Test full logout flow (HTTP + Socket.IO)
- [ ] Test Redis failure scenarios
- [ ] Test authentication with minimal JWT

### Manual Tests
- [ ] Verify localhost origins blocked in production
- [ ] Verify logout disconnects Socket.IO
- [ ] Verify Redis failure rejects requests

---

## Rollback Plan

Each fix is isolated and can be rolled back independently:

1. **MEDIUM-7:** Restore plain-text comparison (not recommended)
2. **MEDIUM-6:** Restore full JWT payload (simple revert)
3. **HIGH-5:** Restore localhost CORS (single line change)
4. **HIGH-4:** Restore fail-open behavior (env var toggle)
5. **HIGH-3:** Remove Socket.IO blacklist check (revert middleware)

---

## Post-Implementation

1. Monitor error logs for blacklist failures
2. Monitor Socket.IO disconnection rates
3. Monitor authentication latency (DB queries)
4. Update documentation
5. Train team on new behavior
