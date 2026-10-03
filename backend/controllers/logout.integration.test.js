/** @jest-environment node */
const http = require('node:http');
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const secret = 'local-logout-fixture-secret-'.repeat(3);
const token = jwt.sign({ id: 41 }, secret, { expiresIn: '1h' });
const csrf = 'c'.repeat(64);
const keys = [
  'NODE_ENV',
  'JWT_SECRET',
  'BLACKLIST_FAIL_MODE',
  'RATE_LIMIT_STORE',
  'RATE_LIMIT_PASS_ON_STORE_ERROR',
];
const originalEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const originalBlacklist = global.tokenBlacklist;
const servers = [];

const load = ({ redis, env = 'production' }) => {
  jest.resetModules();
  process.env.NODE_ENV = env;
  process.env.JWT_SECRET = secret;
  process.env.BLACKLIST_FAIL_MODE = 'closed';
  process.env.RATE_LIMIT_STORE = 'redis';
  process.env.RATE_LIMIT_PASS_ON_STORE_ERROR = 'false';
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  jest.doMock('../config/redis', () => redis);
  jest.doMock('../db', () => ({
    pool: { query: async () => ({ rows: [{ id: 41, username: 'fixture', role: 'user' }] }) },
    isDbConnected: async () => true,
  }));
  jest.doMock('../utils/logger', () => logger);
  jest.doMock('../store/memoryState', () => ({ users: [] }));
  jest.doMock('../services/emailService', () => ({ sendPasswordResetEmail: jest.fn() }));
  return {
    logger,
    controller: require('./authController'),
    authenticate: require('../middleware/auth').authenticateToken,
    socketAuth: require('../middleware/socketAuth').socketAuthMiddleware,
    csrfMiddleware: require('../middleware/csrf').csrfMiddleware,
  };
};

const makeRedis = () => {
  const blacklist = new Map();
  return {
    status: 'ready',
    eval: jest.fn().mockResolvedValue([1, 60000]),
    get: jest.fn(async (key) => blacklist.get(key) || null),
    setex: jest.fn(async (key, _ttl, value) => {
      blacklist.set(key, value);
      return 'OK';
    }),
  };
};

const start = async (modules) => {
  const app = express();
  app.post('/api/auth/logout', ...require('../middleware/logoutCleanup').prepareLogout);
  const { buildRateLimiterOptions } = require('../middleware/rateLimit');
  app.use(
    '/api',
    rateLimit(
      buildRateLimiterOptions({
        scope: 'api',
        windowMs: 60000,
        limit: 100,
        message: { error: 'limited' },
      })
    )
  );
  app.use(cookieParser(), modules.csrfMiddleware);
  app.use('/api/auth', require('../routes/authRoutes'));
  app.get('/api/protected', modules.authenticate, (_req, res) => res.json({ ok: true }));
  app.use(require('../middleware/errorContract').createErrorHandler({ logger: modules.logger }));
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  servers.push(server);
  return server;
};

const request = (server, { method = 'POST', path = '/api/auth/logout', includeCsrf = true } = {}) =>
  new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: server.address().port,
        path,
        method,
        headers: {
          cookie: `auth_token=${token}; csrf_token=${csrf}`,
          ...(includeCsrf ? { 'x-csrf-token': csrf } : {}),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            body: JSON.parse(body),
            cookies: res.headers['set-cookie'] || [],
          })
        );
      }
    );
    req.on('error', reject);
    req.end();
  });

const expectCookieCleared = (result) => {
  const authCookies = result.cookies.filter((cookie) => /^auth_token=;/.test(cookie));
  expect(authCookies).toHaveLength(1);
  expect(authCookies[0]).toContain('HttpOnly');
  expect(authCookies[0]).not.toContain('Max-Age=');
  const expiry = authCookies[0].match(/Expires=([^;]+)/);
  expect(expiry).not.toBeNull();
  expect(new Date(expiry[1]).getTime()).toBeLessThan(Date.now());
};

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
      )
  );
  for (const key of keys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  if (originalBlacklist === undefined) delete global.tokenBlacklist;
  else global.tokenBlacklist = originalBlacklist;
  jest.resetModules();
  for (const path of [
    '../config/redis',
    '../db',
    '../utils/logger',
    '../store/memoryState',
    '../services/emailService',
  ]) {
    jest.dontMock(path);
  }
});

describe('confirmed session logout', () => {
  it('acknowledges the shared write and rejects the revoked session over HTTP and Socket.IO', async () => {
    const redis = makeRedis();
    const modules = load({ redis });
    const server = await start(modules);
    const result = await request(server);
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expectCookieCleared(result);
    expect(redis.setex).toHaveBeenCalledWith(`blacklist:token:${token}`, expect.any(Number), '1');
    const ttl = redis.setex.mock.calls[0][1];
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(3600);
    const protectedResult = await request(server, { method: 'GET', path: '/api/protected' });
    expect(protectedResult.status).toBe(401);
    expect(protectedResult.body.code).toBe('TOKEN_REVOKED');
    const next = jest.fn();
    await modules.socketAuth(
      {
        id: 'fixture',
        request: { cookies: { auth_token: token } },
        handshake: { auth: {}, address: '127.0.0.1' },
      },
      next
    );
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Token has been revoked' })
    );
    expect(
      JSON.stringify([
        modules.logger.info.mock.calls,
        modules.logger.warn.mock.calls,
        modules.logger.error.mock.calls,
      ])
    ).not.toContain(token);
  });

  it('returns a generic failure and clears the cookie if the shared write rejects', async () => {
    const redis = makeRedis();
    redis.setex.mockRejectedValue(new Error(`private-store-command:${token}`));
    const modules = load({ redis });
    const result = await request(await start(modules));
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({ success: false, code: 'LOGOUT_REVOCATION_FAILED' });
    expectCookieCleared(result);
    expect(global.tokenBlacklist?.has(token)).not.toBe(true);
    const observations = JSON.stringify({ result, logs: modules.logger.error.mock.calls });
    expect(observations).not.toContain(token);
    expect(observations).not.toContain('private-store-command');
  });

  it('requires an explicit OK acknowledgement from Redis', async () => {
    const redis = makeRedis();
    redis.setex.mockResolvedValue(null);
    const result = await request(await start(load({ redis })));
    expect(result.status).toBe(503);
    expect(result.body.success).toBe(false);
    expectCookieCleared(result);
  });

  it('handles Redis losing readiness between authentication and revocation', async () => {
    const redis = makeRedis();
    redis.get.mockImplementationOnce(async () => {
      redis.status = 'reconnecting';
      return null;
    });
    const result = await request(await start(load({ redis })));
    expect(result.status).toBe(503);
    expect(result.body.code).toBe('LOGOUT_REVOCATION_FAILED');
    expectCookieCleared(result);
    expect(redis.setex).not.toHaveBeenCalled();
    expect(global.tokenBlacklist?.has(token)).not.toBe(true);
  });

  it('clears device cookies when the auth guard cannot read the shared store', async () => {
    const redis = makeRedis();
    redis.get.mockRejectedValue(new Error('store unavailable'));
    const result = await request(await start(load({ redis })));
    expect(result.status).toBe(503);
    expect(result.body.code).toBe('BLACKLIST_CHECK_FAILED');
    expectCookieCleared(result);
    expect(redis.get).toHaveBeenCalled();
    expect(redis.setex).not.toHaveBeenCalled();
  });

  it('clears device cookies while retaining a failing global Redis rate-limit gate', async () => {
    const redis = makeRedis();
    redis.status = 'reconnecting';
    const result = await request(await start(load({ redis })));
    expect(result.status).toBe(503);
    expectCookieCleared(result);
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.setex).not.toHaveBeenCalled();
  });

  it('retains the global 429 response after clearing a valid logout cookie', async () => {
    const redis = makeRedis();
    redis.eval.mockResolvedValue([101, 60000]);
    const result = await request(await start(load({ redis })));
    expect(result.status).toBe(429);
    expectCookieCleared(result);
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.setex).not.toHaveBeenCalled();
  });

  it('does not clear a session for invalid CSRF even if the rate-limit store is unavailable', async () => {
    const redis = makeRedis();
    redis.status = 'reconnecting';
    const result = await request(await start(load({ redis })), { includeCsrf: false });
    expect(result.status).toBe(503);
    expect(result.cookies).toEqual([]);
    expect(redis.setex).not.toHaveBeenCalled();
  });

  it('keeps CSRF enforcement before logout without clearing an unrelated session', async () => {
    const redis = makeRedis();
    const result = await request(await start(load({ redis })), { includeCsrf: false });
    expect(result.status).toBe(403);
    expect(result.body.code).toBe('CSRF_TOKEN_INVALID');
    expect(redis.setex).not.toHaveBeenCalled();
    expect(result.cookies).toEqual([]);
  });

  it('supports development memory-only logout and subsequent rejection', async () => {
    const modules = load({ redis: null, env: 'development' });
    const server = await start(modules);
    const result = await request(server);
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expectCookieCleared(result);
    expect(global.tokenBlacklist.get(token)).toBe(jwt.decode(token).exp);
    expect((await request(server, { method: 'GET', path: '/api/protected' })).status).toBe(401);
  });

  it.each([
    { redis: null, env: 'production' },
    { redis: { status: 'connecting', setex: jest.fn() }, env: 'development' },
  ])(
    'never acknowledges a memory fallback when shared revocation is required ($env)',
    async (settings) => {
      const modules = load(settings);
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        clearCookie: jest.fn(),
      };
      await modules.controller.logout({ headers: {}, cookies: { auth_token: token } }, res);
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
      expect(res.clearCookie).toHaveBeenCalled();
      expect(global.tokenBlacklist?.has(token)).not.toBe(true);
    }
  );
});
