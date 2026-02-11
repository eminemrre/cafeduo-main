jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'signed-jwt-token'),
}));

const mockVerifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

jest.mock('../db', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
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

const mockSendPasswordResetEmail = jest.fn();
jest.mock('../services/emailService', () => ({
  sendPasswordResetEmail: (...args) => mockSendPasswordResetEmail(...args),
}));

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool, isDbConnected } = require('../db');
const { logger } = require('../utils/logger');
process.env.JWT_SECRET = 'test-secret';
process.env.BOOTSTRAP_ADMIN_EMAILS = 'emin3619@gmail.com';
process.env.GOOGLE_CLIENT_ID = 'google-client-id-test';
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
    mockSendPasswordResetEmail.mockResolvedValue({ delivered: true });
    pool.connect.mockResolvedValue({
      query: jest.fn(),
      release: jest.fn(),
    });
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

  it('sends generic forgot-password response for unknown email without revealing existence', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const req = {
      body: { email: 'missing@example.com' },
      headers: {},
      ip: '127.0.0.1',
    };
    const res = buildRes();

    await authController.forgotPassword(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message:
        'Eğer e-posta adresi sistemde kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.',
    });
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('stores reset token and sends password reset email for known account', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 11, email: 'player@example.com', username: 'player' }],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    const req = {
      body: { email: 'player@example.com' },
      headers: { 'user-agent': 'jest-test' },
      ip: '127.0.0.1',
    };
    const res = buildRes();

    await authController.forgotPassword(req, res);

    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      'SELECT id, email, username FROM users WHERE LOWER(email) = $1 LIMIT 1',
      ['player@example.com']
    );
    expect(pool.query.mock.calls[1][0]).toContain('INSERT INTO password_reset_tokens');
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'player@example.com',
        username: 'player',
        resetUrl: expect.stringContaining('/reset-password?token='),
      })
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message:
        'Eğer e-posta adresi sistemde kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.',
    });
  });

  it('resets password using valid token and marks token as used', async () => {
    const transactionQuery = jest.fn();
    pool.connect.mockResolvedValueOnce({
      query: transactionQuery,
      release: jest.fn(),
    });
    pool.query.mockResolvedValueOnce({ rows: [{ id: 8, user_id: 55 }] });
    bcrypt.hash.mockResolvedValue('new-password-hash');

    const req = {
      body: {
        token: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        password: 'StrongPass123',
      },
    };
    const res = buildRes();

    await authController.resetPassword(req, res);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM password_reset_tokens'),
      expect.any(Array)
    );
    expect(transactionQuery).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(transactionQuery).toHaveBeenNthCalledWith(
      2,
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      ['new-password-hash', 55]
    );
    expect(transactionQuery).toHaveBeenNthCalledWith(
      3,
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
      [55]
    );
    expect(transactionQuery).toHaveBeenNthCalledWith(4, 'COMMIT');
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.',
    });
  });
});
