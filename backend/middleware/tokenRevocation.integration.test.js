/** @jest-environment node */
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');

const secret = 'local-session-revocation-fixture-'.repeat(3);
const token = jwt.sign({ id: 41, username: 'fixture' }, secret, { expiresIn: '1h' });
const envKeys = ['NODE_ENV', 'JWT_SECRET', 'BLACKLIST_FAIL_MODE'];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const originalBlacklist = global.tokenBlacklist;

const loadMiddleware = ({ redis, env = 'production', failMode = 'closed' }) => {
  jest.resetModules();
  process.env.NODE_ENV = env;
  process.env.JWT_SECRET = secret;
  process.env.BLACKLIST_FAIL_MODE = failMode;
  const query = jest
    .fn()
    .mockResolvedValue({ rows: [{ id: 41, username: 'fixture', role: 'user' }] });
  jest.doMock('../config/redis', () => redis);
  jest.doMock('../db', () => ({ pool: { query }, isDbConnected: async () => true }));
  jest.doMock('../store/memoryState', () => ({ users: [] }));
  jest.doMock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
  return {
    query,
    httpAuth: require('./auth').authenticateToken,
    socketAuth: require('./socketAuth').socketAuthMiddleware,
  };
};

const runHttp = async (middleware) => {
  const app = express();
  app.get('/protected', middleware, (_req, res) => res.json({ ok: true }));
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  try {
    return await new Promise((resolve, reject) => {
      const request = http.get(
        {
          host: '127.0.0.1',
          port: server.address().port,
          path: '/protected',
          headers: { authorization: `Bearer ${token}` },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
        }
      );
      request.on('error', reject);
    });
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
};

const runSocket = async (middleware) => {
  const socket = {
    id: 'local-fixture',
    handshake: { auth: { token }, address: '127.0.0.1' },
    request: { cookies: {} },
  };
  const next = jest.fn();
  await middleware(socket, next);
  expect(next).toHaveBeenCalledTimes(1);
  return { error: next.mock.calls[0][0]?.message, user: socket.user };
};

afterEach(() => {
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  if (originalBlacklist === undefined) delete global.tokenBlacklist;
  else global.tokenBlacklist = originalBlacklist;
  jest.resetModules();
  for (const module of ['../config/redis', '../db', '../store/memoryState', '../utils/logger']) {
    jest.dontMock(module);
  }
});

describe.each(['HTTP', 'Socket.IO'])('%s session revocation lifecycle', (transport) => {
  const run = (modules) =>
    transport === 'HTTP' ? runHttp(modules.httpAuth) : runSocket(modules.socketAuth);
  const expectUnavailable = (result) => {
    if (transport === 'HTTP') {
      expect(result.status).toBe(503);
      expect(result.body.code).toBe('BLACKLIST_CHECK_FAILED');
    } else {
      expect(result.error).toBe('Authentication service temporarily unavailable');
      expect(result.user).toBeUndefined();
    }
    expect(JSON.stringify(result)).not.toContain(token);
  };
  const expectRevoked = (result) => {
    if (transport === 'HTTP') {
      expect(result.status).toBe(401);
      expect(result.body.code).toBe('TOKEN_REVOKED');
    } else {
      expect(result.error).toBe('Token has been revoked');
      expect(result.user).toBeUndefined();
    }
  };
  const expectAccepted = (result) => {
    if (transport === 'HTTP') expect(result).toEqual({ status: 200, body: { ok: true } });
    else {
      expect(result.error).toBeUndefined();
      expect(result.user.id).toBe(41);
    }
  };

  it.each(['wait', 'connecting', 'reconnecting', 'close', 'end'])(
    'rejects while Redis is %s',
    async (status) => {
      const redis = { status, get: jest.fn() };
      const modules = loadMiddleware({ redis });
      global.tokenBlacklist = new Map();
      expectUnavailable(await run(modules));
      expect(redis.get).not.toHaveBeenCalled();
      expect(modules.query).not.toHaveBeenCalled();
    }
  );

  it('rejects a missing shared store in production', async () => {
    const modules = loadMiddleware({ redis: null });
    expectUnavailable(await run(modules));
    expect(modules.query).not.toHaveBeenCalled();
  });

  it('hides store errors and rejects a failed blacklist read', async () => {
    const redis = {
      status: 'ready',
      get: jest.fn().mockRejectedValue(new Error('private-redis-endpoint')),
    };
    const modules = loadMiddleware({ redis });
    const result = await run(modules);
    expectUnavailable(result);
    expect(JSON.stringify(result)).not.toContain('private-redis-endpoint');
    expect(modules.query).not.toHaveBeenCalled();
  });

  it('recovers with the shared blacklist intact after a reconnect', async () => {
    const redis = { status: 'connecting', get: jest.fn().mockResolvedValue('1') };
    const modules = loadMiddleware({ redis });
    expectUnavailable(await run(modules));
    redis.status = 'ready';
    expectRevoked(await run(modules));
    expect(modules.query).not.toHaveBeenCalled();
    redis.get.mockResolvedValue(null);
    expectAccepted(await run(modules));
    expect(modules.query).toHaveBeenCalledTimes(1);
    redis.status = 'reconnecting';
    expectUnavailable(await run(modules));
    expect(modules.query).toHaveBeenCalledTimes(1);
  });

  it('retains memory-only development revocations', async () => {
    const modules = loadMiddleware({ redis: null, env: 'development' });
    global.tokenBlacklist = new Map([[token, Math.floor(Date.now() / 1000) + 100]]);
    expectRevoked(await run(modules));
    expect(modules.query).not.toHaveBeenCalled();
    global.tokenBlacklist.set(token, Math.floor(Date.now() / 1000) - 1);
    expectAccepted(await run(modules));
    expect(global.tokenBlacklist.has(token)).toBe(false);
  });
});

it('explicit HTTP fail-open still checks local revocations when Redis rejects', async () => {
  const redis = { status: 'ready', get: jest.fn().mockRejectedValue(new Error('unavailable')) };
  const modules = loadMiddleware({ redis, failMode: 'open' });
  global.tokenBlacklist = new Map([[token, Math.floor(Date.now() / 1000) + 100]]);
  const revoked = await runHttp(modules.httpAuth);
  expect(revoked.status).toBe(401);
  expect(revoked.body.code).toBe('TOKEN_REVOKED');
  expect(modules.query).not.toHaveBeenCalled();
  global.tokenBlacklist.clear();
  expect((await runHttp(modules.httpAuth)).status).toBe(200);
});

it('Socket.IO remains closed even when HTTP fail-open is explicitly configured', async () => {
  const modules = loadMiddleware({
    redis: { status: 'reconnecting', get: jest.fn() },
    failMode: 'open',
  });
  expect((await runSocket(modules.socketAuth)).error).toBe(
    'Authentication service temporarily unavailable'
  );
  expect(modules.query).not.toHaveBeenCalled();
});
