/** @jest-environment node */

const createRes = () => {
  const res = {
    req: { requestId: 'req-auth-test' },
    statusCode: 200,
    body: null,
    status: jest.fn((code) => {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn((payload) => {
      res.body = payload;
      return res;
    }),
  };
  return res;
};

describe('auth middleware', () => {
  const originalSecret = process.env.JWT_SECRET;

  const loadAuthModule = () => {
    jest.resetModules();
    process.env.JWT_SECRET = 'unit-test-secret';

    const verify = jest.fn();
    const query = jest.fn();
    const isDbConnected = jest.fn();
    const memoryState = { users: [] };

    jest.doMock('jsonwebtoken', () => ({ verify }));
    jest.doMock('../db', () => ({
      pool: { query },
      isDbConnected,
    }));
    jest.doMock('../store/memoryState', () => memoryState);

    const auth = require('./auth');
    return { auth, verify, query, isDbConnected, memoryState };
  };

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    jest.dontMock('jsonwebtoken');
    jest.dontMock('../db');
    jest.dontMock('../store/memoryState');
  });

  afterAll(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  it('returns 401 when bearer token is missing', async () => {
    const { auth } = loadAuthModule();
    const req = { headers: {}, cookies: {} };
    const res = createRes();
    const next = jest.fn();

    await auth.authenticateToken(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('TOKEN_MISSING');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token format is oversized', async () => {
    const { auth } = loadAuthModule();
    const req = { headers: { authorization: `Bearer ${'a'.repeat(2050)}` } };
    const res = createRes();
    const next = jest.fn();

    await auth.authenticateToken(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('TOKEN_INVALID_FORMAT');
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches fresh db user when token is valid', async () => {
    const { auth, verify, isDbConnected, query } = loadAuthModule();
    verify.mockReturnValue({ id: 42 });
    isDbConnected.mockResolvedValue(true);
    query.mockResolvedValue({
      rows: [{ id: 42, username: 'emin', role: 'user', isAdmin: false }],
    });

    const req = { headers: { authorization: 'Bearer token-123' }, cookies: {} };
    const res = createRes();
    const next = jest.fn();

    await auth.authenticateToken(req, res, next);

    expect(verify).toHaveBeenCalledWith('token-123', 'unit-test-secret');
    expect(query).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual(expect.objectContaining({ id: 42, username: 'emin' }));
    expect(req.tokenSource).toBe('header');
    expect(req.authToken).toBe('token-123');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('accepts token from auth cookie', async () => {
    const { auth, verify, isDbConnected, query } = loadAuthModule();
    verify.mockReturnValue({ id: 21 });
    isDbConnected.mockResolvedValue(true);
    query.mockResolvedValue({
      rows: [{ id: 21, username: 'cookie-user', role: 'user', isAdmin: false }],
    });

    const req = { headers: {}, cookies: { auth_token: 'cookie-token-1' } };
    const res = createRes();
    const next = jest.fn();

    await auth.authenticateToken(req, res, next);

    expect(verify).toHaveBeenCalledWith('cookie-token-1', 'unit-test-secret');
    expect(req.tokenSource).toBe('cookie');
    expect(req.authToken).toBe('cookie-token-1');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('prioritizes cookie token over authorization header', async () => {
    const { auth, verify, isDbConnected, query } = loadAuthModule();
    verify.mockReturnValue({ id: 22 });
    isDbConnected.mockResolvedValue(true);
    query.mockResolvedValue({
      rows: [{ id: 22, username: 'priority-user', role: 'user', isAdmin: false }],
    });

    const req = {
      headers: { authorization: 'Bearer header-token-1' },
      cookies: { auth_token: 'cookie-token-priority' },
    };
    const res = createRes();
    const next = jest.fn();

    await auth.authenticateToken(req, res, next);

    expect(verify).toHaveBeenCalledWith('cookie-token-priority', 'unit-test-secret');
    expect(req.tokenSource).toBe('cookie');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 401 when db user does not exist', async () => {
    const { auth, verify, isDbConnected, query } = loadAuthModule();
    verify.mockReturnValue({ id: 10 });
    isDbConnected.mockResolvedValue(true);
    query.mockResolvedValue({ rows: [] });

    const req = { headers: { authorization: 'Bearer token-unknown' }, cookies: {} };
    const res = createRes();
    const next = jest.fn();

    await auth.authenticateToken(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('USER_NOT_FOUND');
    expect(next).not.toHaveBeenCalled();
  });

  it('falls back to memory state when db is unavailable', async () => {
    const { auth, verify, isDbConnected, memoryState } = loadAuthModule();
    verify.mockReturnValue({ id: 5, username: 'decoded-user', role: 'user' });
    isDbConnected.mockResolvedValue(false);
    memoryState.users.push({
      id: 5,
      username: 'memory-user',
      role: 'user',
      is_admin: 1,
      games_played: 4,
    });

    const req = { headers: { authorization: 'Bearer token-memory' }, cookies: {} };
    const res = createRes();
    const next = jest.fn();

    await auth.authenticateToken(req, res, next);

    expect(req.user).toEqual(expect.objectContaining({
      id: 5,
      username: 'memory-user',
      isAdmin: true,
      gamesPlayed: 4,
    }));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('maps json web token error to TOKEN_INVALID', async () => {
    const { auth, verify } = loadAuthModule();
    const invalidError = new Error('invalid');
    invalidError.name = 'JsonWebTokenError';
    verify.mockImplementation(() => {
      throw invalidError;
    });

    const req = { headers: { authorization: 'Bearer broken' }, cookies: {} };
    const res = createRes();
    const next = jest.fn();

    await auth.authenticateToken(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('TOKEN_INVALID');
    expect(next).not.toHaveBeenCalled();
  });

  it('allows admins and blocks non-admins via requireAdmin', () => {
    const { auth } = loadAuthModule();
    const res = createRes();
    const next = jest.fn();

    auth.requireAdmin({ user: { role: 'admin' } }, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    const deniedRes = createRes();
    const deniedNext = jest.fn();
    auth.requireAdmin({ user: { role: 'user', isAdmin: false } }, deniedRes, deniedNext);
    expect(deniedRes.statusCode).toBe(403);
    expect(deniedRes.body.code).toBe('ADMIN_REQUIRED');
    expect(deniedNext).not.toHaveBeenCalled();
  });

  it('checks ownership except for admin role', () => {
    const { auth } = loadAuthModule();
    const middleware = auth.requireOwnership('id');

    const next = jest.fn();
    middleware(
      { user: { id: 7, role: 'user' }, params: { id: '7' }, body: {} },
      createRes(),
      next
    );
    expect(next).toHaveBeenCalledTimes(1);

    const deniedRes = createRes();
    const deniedNext = jest.fn();
    middleware(
      { user: { id: 7, role: 'user' }, params: { id: '8' }, body: {} },
      deniedRes,
      deniedNext
    );
    expect(deniedRes.statusCode).toBe(403);
    expect(deniedRes.body.code).toBe('ACCESS_DENIED');
    expect(deniedNext).not.toHaveBeenCalled();
  });
});
