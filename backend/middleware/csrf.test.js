/**
 * CSRF Middleware Tests
 */
const {
  csrfMiddleware,
  generateCsrfToken,
  setCsrfCookie,
  clearCsrfCookie,
  getCsrfToken,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
} = require('./csrf');

// Helper to create mock req/res/next
function createMocks({ method = 'GET', path = '/api/games', cookies = {}, headers = {} } = {}) {
  const req = {
    method,
    path,
    cookies,
    headers,
    ip: '127.0.0.1',
  };

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };

  const next = jest.fn();
  return { req, res, next };
}

describe('CSRF Middleware', () => {
  describe('csrfMiddleware', () => {
    it('should bypass CSRF check for GET requests', () => {
      const { req, res, next } = createMocks({ method: 'GET' });
      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should bypass CSRF check for HEAD requests', () => {
      const { req, res, next } = createMocks({ method: 'HEAD' });
      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should bypass CSRF check for OPTIONS requests', () => {
      const { req, res, next } = createMocks({ method: 'OPTIONS' });
      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should bypass CSRF check for login endpoint', () => {
      const { req, res, next } = createMocks({ method: 'POST', path: '/api/auth/login' });
      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should bypass CSRF check for register endpoint', () => {
      const { req, res, next } = createMocks({ method: 'POST', path: '/api/auth/register' });
      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should bypass CSRF check for google-login endpoint', () => {
      const { req, res, next } = createMocks({ method: 'POST', path: '/api/auth/google-login' });
      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should bypass CSRF check for forgot-password endpoint', () => {
      const { req, res, next } = createMocks({ method: 'POST', path: '/api/auth/forgot-password' });
      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should bypass CSRF check for reset-password endpoint', () => {
      const { req, res, next } = createMocks({ method: 'POST', path: '/api/auth/reset-password' });
      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should bypass CSRF check for health endpoint', () => {
      const { req, res, next } = createMocks({ method: 'POST', path: '/health' });
      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should reject POST without CSRF token with 403', () => {
      const { req, res, next } = createMocks({ method: 'POST', path: '/api/games/create' });
      csrfMiddleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'CSRF_TOKEN_INVALID',
        })
      );
    });

    it('should reject PUT without CSRF token with 403', () => {
      const { req, res, next } = createMocks({ method: 'PUT', path: '/api/profile' });
      csrfMiddleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should reject DELETE without CSRF token with 403', () => {
      const { req, res, next } = createMocks({ method: 'DELETE', path: '/api/games/123' });
      csrfMiddleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should reject POST with only cookie token (missing header)', () => {
      const token = generateCsrfToken();
      const { req, res, next } = createMocks({
        method: 'POST',
        path: '/api/games/create',
        cookies: { [CSRF_COOKIE_NAME]: token },
      });
      csrfMiddleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should reject POST with only header token (missing cookie)', () => {
      const token = generateCsrfToken();
      const { req, res, next } = createMocks({
        method: 'POST',
        path: '/api/games/create',
        headers: { [CSRF_HEADER_NAME]: token },
      });
      csrfMiddleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should reject POST with mismatched CSRF tokens', () => {
      const cookieToken = generateCsrfToken();
      const headerToken = generateCsrfToken();
      const { req, res, next } = createMocks({
        method: 'POST',
        path: '/api/games/create',
        cookies: { [CSRF_COOKIE_NAME]: cookieToken },
        headers: { [CSRF_HEADER_NAME]: headerToken },
      });
      csrfMiddleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should accept POST with valid matching CSRF tokens', () => {
      const token = generateCsrfToken();
      const { req, res, next } = createMocks({
        method: 'POST',
        path: '/api/games/create',
        cookies: { [CSRF_COOKIE_NAME]: token },
        headers: { [CSRF_HEADER_NAME]: token },
      });
      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should accept PUT with valid matching CSRF tokens', () => {
      const token = generateCsrfToken();
      const { req, res, next } = createMocks({
        method: 'PUT',
        path: '/api/profile',
        cookies: { [CSRF_COOKIE_NAME]: token },
        headers: { [CSRF_HEADER_NAME]: token },
      });
      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should accept DELETE with valid matching CSRF tokens', () => {
      const token = generateCsrfToken();
      const { req, res, next } = createMocks({
        method: 'DELETE',
        path: '/api/games/123',
        cookies: { [CSRF_COOKIE_NAME]: token },
        headers: { [CSRF_HEADER_NAME]: token },
      });
      csrfMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should handle missing cookies object gracefully', () => {
      const { req, res, next } = createMocks({ method: 'POST', path: '/api/games/create' });
      req.cookies = undefined;
      csrfMiddleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should handle missing headers object gracefully', () => {
      const { req, res, next } = createMocks({ method: 'POST', path: '/api/games/create' });
      req.headers = undefined;
      csrfMiddleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('generateCsrfToken', () => {
    it('should generate a 64-character hex string', () => {
      const token = generateCsrfToken();
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate unique tokens', () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('setCsrfCookie', () => {
    it('should set CSRF cookie on response', () => {
      const { res } = createMocks();
      const token = setCsrfCookie(res);
      expect(res.cookie).toHaveBeenCalledWith(
        CSRF_COOKIE_NAME,
        expect.any(String),
        expect.objectContaining({
          httpOnly: false, // Must be readable by JavaScript
          sameSite: 'lax',
          path: '/',
        })
      );
      expect(token).toHaveLength(64);
    });

    it('should not set httpOnly flag (JS must be able to read it)', () => {
      const { res } = createMocks();
      setCsrfCookie(res);
      const cookieOptions = res.cookie.mock.calls[0][2];
      expect(cookieOptions.httpOnly).toBe(false);
    });
  });

  describe('clearCsrfCookie', () => {
    it('should clear CSRF cookie on response', () => {
      const { res } = createMocks();
      clearCsrfCookie(res);
      expect(res.clearCookie).toHaveBeenCalledWith(
        CSRF_COOKIE_NAME,
        expect.objectContaining({
          httpOnly: false,
          sameSite: 'lax',
          path: '/',
        })
      );
    });
  });

  describe('getCsrfToken endpoint handler', () => {
    it('should set cookie and return token in response', () => {
      const { req, res } = createMocks({ method: 'GET', path: '/api/csrf-token' });
      getCsrfToken(req, res);
      expect(res.cookie).toHaveBeenCalledWith(
        CSRF_COOKIE_NAME,
        expect.any(String),
        expect.any(Object)
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          csrfToken: expect.any(String),
        })
      );
    });
  });
});
