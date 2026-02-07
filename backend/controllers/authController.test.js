jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'signed-jwt-token'),
}));

jest.mock('../db', () => ({
  pool: {
    query: jest.fn(),
  },
  isDbConnected: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool, isDbConnected } = require('../db');
const { logger } = require('../utils/logger');
process.env.JWT_SECRET = 'test-secret';
process.env.BOOTSTRAP_ADMIN_EMAILS = 'emin3619@gmail.com';
const authController = require('./authController');

const buildRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('authController security-critical auth flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RECAPTCHA_SECRET_KEY = '';
    global.fetch = jest.fn();
    isDbConnected.mockResolvedValue(true);
  });

  afterEach(() => {
    delete process.env.RECAPTCHA_SECRET_KEY;
    delete global.fetch;
  });

  it('register normalizes email and promotes bootstrap admin account at creation', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // duplicate check
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            username: 'adminUser',
            email: 'emin3619@gmail.com',
            points: 100,
            wins: 0,
            gamesPlayed: 0,
            isAdmin: true,
            role: 'admin',
          },
        ],
      });
    bcrypt.hash.mockResolvedValue('hashed-password');

    const req = {
      body: {
        username: 'adminUser',
        email: 'EMIN3619@GMAIL.COM',
        password: 'StrongPass123',
        department: 'YBS',
      },
    };
    const res = buildRes();

    await authController.register(req, res);

    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      'SELECT id FROM users WHERE LOWER(email) = $1',
      ['emin3619@gmail.com']
    );

    const insertCall = pool.query.mock.calls[1];
    expect(insertCall[0]).toContain('INSERT INTO users');
    expect(insertCall[1]).toEqual([
      'adminUser',
      'emin3619@gmail.com',
      'hashed-password',
      'YBS',
      'admin',
      true,
    ]);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin' }));
  });

  it('rejects login when recaptcha verification fails', async () => {
    process.env.RECAPTCHA_SECRET_KEY = 'captcha-secret';
    global.fetch.mockResolvedValue({
      json: async () => ({ success: false }),
    });

    const req = {
      body: {
        email: 'user@example.com',
        password: 'Password1!',
        captchaToken: 'captcha-token',
      },
    };
    const res = buildRes();

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Robot doğrulaması başarısız.' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('fails closed when recaptcha service errors out while secret is configured', async () => {
    process.env.RECAPTCHA_SECRET_KEY = 'captcha-secret';
    global.fetch.mockRejectedValue(new Error('network down'));

    const req = {
      body: {
        email: 'user@example.com',
        password: 'Password1!',
        captchaToken: 'captcha-token',
      },
    };
    const res = buildRes();

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Robot doğrulaması başarısız.' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('rejects register when username format is invalid', async () => {
    const req = {
      body: {
        username: 'ab',
        email: 'valid@example.com',
        password: 'StrongPass123',
      },
    };
    const res = buildRes();

    await authController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Kullanıcı adı 3-20 karakter ve sadece harf/rakam/_ içermelidir.',
    });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('promotes bootstrap admin during login and signs token with elevated role', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 55,
            username: 'owner',
            email: 'emin3619@gmail.com',
            password_hash: 'stored-hash',
            points: 900,
            wins: 24,
            gamesPlayed: 40,
            department: 'YBS',
            isAdmin: false,
            role: 'user',
            cafe_id: 7,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 55,
            username: 'owner',
            email: 'owner@example.com',
            points: 900,
            wins: 24,
            gamesPlayed: 40,
            department: 'YBS',
            isAdmin: true,
            role: 'admin',
            cafe_id: null,
          },
        ],
      });

    bcrypt.compare.mockResolvedValue(true);

    const req = {
      body: {
        email: 'EMIN3619@GMAIL.COM',
        password: 'Password1!',
      },
    };
    const res = buildRes();

    await authController.login(req, res);

    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('SELECT id, username, email'),
      ['emin3619@gmail.com']
    );
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("SET role = 'admin'"),
      [55]
    );
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({ id: 55, role: 'admin' }),
      'test-secret',
      { expiresIn: '7d' }
    );
    expect(logger.info).toHaveBeenCalledWith('Bootstrap admin promoted on login', {
      email: 'emin3619@gmail.com',
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'signed-jwt-token',
        user: expect.objectContaining({ isAdmin: true, role: 'admin' }),
      })
    );
  });

  it('returns 401 for invalid password without leaking details', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 9,
          username: 'player',
          email: 'player@example.com',
          password_hash: 'stored',
          isAdmin: false,
          role: 'user',
        },
      ],
    });
    bcrypt.compare.mockResolvedValue(false);

    const req = {
      body: {
        email: 'player@example.com',
        password: 'wrong-pass',
      },
    };
    const res = buildRes();

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Geçersiz e-posta veya şifre.' });
    expect(jwt.sign).not.toHaveBeenCalled();
  });
});
