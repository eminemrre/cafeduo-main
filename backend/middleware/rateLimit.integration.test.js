/** @jest-environment node */
const http = require('node:http');
const express = require('express');
const rateLimit = require('express-rate-limit');

jest.mock('../config/redis', () => ({ status: 'connecting', eval: jest.fn() }));
jest.mock('../utils/logger', () => ({ warn: jest.fn(), error: jest.fn() }));
const redis = require('../config/redis');
const logger = require('../utils/logger');
const { buildRateLimiterOptions } = require('./rateLimit');
const { createErrorHandler } = require('./errorContract');

const request = (server) =>
  new Promise((resolve, reject) => {
    const req = http.get(
      { host: '127.0.0.1', port: server.address().port, path: '/protected' },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const body = res.headers['content-type']?.includes('application/json')
              ? JSON.parse(data)
              : data;
            resolve({ status: res.statusCode, headers: res.headers, body });
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    req.on('error', reject);
  });
const close = (server) =>
  new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));

const startApp = async ({ scope = 'auth:login', limit = 2 } = {}) => {
  const app = express();
  const action = jest.fn();
  app.use((req, _res, next) => {
    req.requestId = 'rate-limit-http-test';
    next();
  });
  app.use(rateLimit(buildRateLimiterOptions({ scope, windowMs: 60_000, limit })));
  app.get('/protected', (_req, res) => {
    action();
    res.json({ ok: true });
  });
  app.use(createErrorHandler({ logger }));
  const server = await new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
  return { server, action };
};

describe('production rate-limit HTTP lifecycle', () => {
  const keys = [
    'NODE_ENV',
    'RATE_LIMIT_STORE',
    'RATE_LIMIT_PASS_ON_STORE_ERROR',
    'RATE_LIMIT_REDIS_PREFIX',
  ];
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  beforeEach(() => {
    jest.resetAllMocks();
    redis.status = 'connecting';
    process.env.NODE_ENV = 'production';
    process.env.RATE_LIMIT_STORE = 'redis';
    delete process.env.RATE_LIMIT_PASS_ON_STORE_ERROR;
    process.env.RATE_LIMIT_REDIS_PREFIX = 'local-http-test';
    const counts = new Map();
    redis.eval.mockImplementation(async (_script, _number, key, window) => {
      const value = (counts.get(key) || 0) + 1;
      counts.set(key, value);
      return [value, window];
    });
  });
  afterEach(() => {
    for (const key of keys)
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
  });

  it('blocks startup/outage requests, safely handles store errors and recovers without resetting counters', async () => {
    const { server, action } = await startApp({ limit: 1 });
    try {
      const unavailable = await request(server);
      expect(unavailable.status).toBe(503);
      expect(unavailable.body).toMatchObject({
        code: 'INTERNAL_ERROR',
        details: null,
        requestId: 'rate-limit-http-test',
      });
      expect(action).not.toHaveBeenCalled();
      expect(redis.eval).not.toHaveBeenCalled();
      redis.status = 'ready';
      expect((await request(server)).status).toBe(200);
      redis.status = 'reconnecting';
      expect((await request(server)).status).toBe(503);
      expect(action).toHaveBeenCalledTimes(1);
      redis.status = 'ready';
      redis.eval.mockRejectedValueOnce(new Error('private redis connection metadata'));
      const failure = await request(server);
      expect(failure.status).toBe(500);
      expect(JSON.stringify(failure.body)).not.toMatch(/private|redis|connection metadata/i);
      expect(action).toHaveBeenCalledTimes(1);
      const limited = await request(server);
      expect(limited.status).toBe(429);
      expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
      expect(action).toHaveBeenCalledTimes(1);
    } finally {
      await close(server);
    }
  });

  it('shares limits across separately constructed apps and a restarted app, while scopes remain separate', async () => {
    const first = await startApp({ limit: 2 });
    const second = await startApp({ limit: 2 });
    const otherScope = await startApp({ scope: 'auth:register', limit: 2 });
    let restarted;
    try {
      redis.status = 'ready';
      expect((await request(first.server)).status).toBe(200);
      expect((await request(second.server)).status).toBe(200);
      expect((await request(first.server)).status).toBe(429);
      expect((await request(otherScope.server)).status).toBe(200);
      redis.status = 'connecting';
      restarted = await startApp({ limit: 2 });
      redis.status = 'ready';
      expect((await request(restarted.server)).status).toBe(429);
      expect(restarted.action).not.toHaveBeenCalled();
      expect(first.action).toHaveBeenCalledTimes(1);
      expect(second.action).toHaveBeenCalledTimes(1);
    } finally {
      await Promise.all(
        [first.server, second.server, otherScope.server, restarted?.server]
          .filter(Boolean)
          .map(close)
      );
    }
  });
});
