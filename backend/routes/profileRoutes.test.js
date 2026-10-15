/** @jest-environment node */
const express = require('express');

describe('profile route authorization', () => {
  let createProfileRoutes, requireOwnership;
  const originalSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = 'profile-route-unit-fixture';
    jest.doMock('../db', () => ({ pool: { query: jest.fn() }, isDbConnected: jest.fn() }));
    jest.doMock('../config/redis', () => ({ status: 'ready', get: jest.fn() }));
    ({ createProfileRoutes } = require('./profileRoutes'));
    ({ requireOwnership } = require('../middleware/auth'));
  });
  afterAll(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    jest.dontMock('../db');
    jest.dontMock('../config/redis');
  });

  const dispatch = async (user, method = 'PUT', target = 1) => {
    const handlers = {
      getLeaderboard: jest.fn((req, res) => res.json([])),
      getAchievements: jest.fn((req, res) => res.json([])),
      updateUserStats: jest.fn((req, res) => res.json({ success: true })),
      updateUserProfile: jest.fn((req, res) => res.json({ success: true })),
    };
    const app = express();
    app.use(
      '/api',
      createProfileRoutes({
        cache: () => (req, res, next) => next(),
        authenticateToken: (req, res, next) => {
          if (!user) return res.status(401).json({ code: 'AUTH_REQUIRED' });
          req.user = user;
          next();
        },
        requireOwnership,
        profileHandlers: handlers,
      })
    );
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    try {
      const suffix = method === 'PATCH' ? '/profile' : '';
      const response = await fetch(
        `http://127.0.0.1:${server.address().port}/api/users/${target}${suffix}`,
        { method }
      );
      return { status: response.status, body: await response.json(), handlers };
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  };

  test('statistics route requires authentication', async () => {
    const result = await dispatch(null);
    expect(result.status).toBe(401);
    expect(result.handlers.updateUserStats).not.toHaveBeenCalled();
  });
  test.each(['user', 'cafe_admin'])(
    'ownership does not grant statistics writes to %s',
    async (role) => {
      const result = await dispatch({ id: 1, role, isAdmin: false });
      expect(result.status).toBe(403);
      expect(result.body.code).toBe('ADMIN_REQUIRED');
      expect(result.handlers.updateUserStats).not.toHaveBeenCalled();
    }
  );
  test('administrator can use the legacy statistics maintenance route', async () => {
    const result = await dispatch({ id: 2, role: 'admin', isAdmin: true });
    expect(result.status).toBe(200);
    expect(result.handlers.updateUserStats).toHaveBeenCalledTimes(1);
  });
  test('player profile edits remain available for the owned account', async () => {
    const result = await dispatch({ id: 1, role: 'user', isAdmin: false }, 'PATCH');
    expect(result.status).toBe(200);
    expect(result.handlers.updateUserProfile).toHaveBeenCalledTimes(1);
  });
  test('player profile edits still deny another account', async () => {
    const result = await dispatch({ id: 2, role: 'user', isAdmin: false }, 'PATCH');
    expect(result.status).toBe(403);
    expect(result.handlers.updateUserProfile).not.toHaveBeenCalled();
  });
});
