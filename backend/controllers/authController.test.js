jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'signed-jwt-token'),
  verify: jest.fn(() => ({ id: 1, exp: Math.floor(Date.now() / 1000) + 300 })),
}));

jest.mock('../db', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
  isDbConnected: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const mockSendPasswordResetEmail = jest.fn();
const mockIsEmailConfigured = jest.fn(() => true);
jest.mock('../services/emailService', () => ({
  sendPasswordResetEmail: (...args) => mockSendPasswordResetEmail(...args),
  isEmailConfigured: () => mockIsEmailConfigured(),
  maskAddress: jest.requireActual('../services/emailService').maskAddress,
}));

const mockIssueVerification = jest.fn();
const mockConfirmVerification = jest.fn();
jest.mock('../services/emailVerificationService', () => ({
  emailVerification: () => ({
    issueVerification: (...args) => mockIssueVerification(...args),
    confirmVerification: (...args) => mockConfirmVerification(...args),
  }),
}));

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool, isDbConnected } = require('../db');
const logger = require('../utils/logger');
process.env.JWT_SECRET = 'test-secret';
process.env.BOOTSTRAP_ADMIN_EMAILS = 'emin3619@gmail.com';
const authController = require('./authController');

const buildRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};

describe('authController security-critical auth flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.query.mockReset();
    process.env.JWT_SECRET = '';
    global.fetch = jest.fn();
    isDbConnected.mockResolvedValue(true);
    mockSendPasswordResetEmail.mockResolvedValue({ delivered: true });
    pool.connect.mockResolvedValue({
      query: jest.fn(),
      release: jest.fn(),
    });
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
    delete global.fetch;
  });

  it.each([undefined, false, 'true', 1])(
    'rejects registration without boolean terms acceptance (%s)',
    async (acceptTerms) => {
      const res = buildRes();
      await authController.register(
        {
          body: {
            username: 'ada',
            email: 'ada@example.com',
            password: 'secret12',
            acceptTerms,
            termsVersion: '2026-10-27',
          },
        },
        res
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TERMS_REQUIRED' }));
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(pool.query).not.toHaveBeenCalled();
    }
  );

  it.each([undefined, '2025-01-01', '2099-01-01'])(
    'does not record stale/unknown terms as the current version (%s)',
    async (termsVersion) => {
      const res = buildRes();
      await authController.register(
        {
          body: {
            username: 'ada',
            email: 'ada@example.com',
            password: 'secret12',
            acceptTerms: true,
            termsVersion,
          },
        },
        res
      );
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'TERMS_VERSION_CHANGED' })
      );
      expect(pool.query).not.toHaveBeenCalled();
    }
  );

  it('accepts terms only for the authenticated user and retains the first current-version receipt', async () => {
    const receipt = { termsVersion: '2026-10-27', termsAcceptedAt: '2026-10-27T12:00:00.000Z' };
    pool.query.mockResolvedValueOnce({ rows: [receipt] });
    const res = buildRes();
    await authController.acceptTerms(
      {
        user: { id: 7 },
        body: {
          userId: 999,
          acceptTerms: true,
          termsVersion: '2026-10-27',
          termsAcceptedAt: '2000-01-01',
        },
      },
      res
    );
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringMatching(/UPDATE users[\s\S]+CASE WHEN terms_version = \$2[\s\S]+ELSE now\(\)/),
      [7, '2026-10-27']
    );
    expect(res.json).toHaveBeenCalledWith(receipt);
  });

  it('does not acknowledge a terms update when acceptance or the displayed version is missing', async () => {
    for (const body of [{}, { acceptTerms: true, termsVersion: '2025-01-01' }]) {
      const res = buildRes();
      await authController.acceptTerms({ user: { id: 7 }, body }, res);
      expect(res.status).toHaveBeenCalledWith(body.acceptTerms ? 409 : 400);
    }
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('stores server-time terms acceptance and idempotent retries in memory mode', async () => {
    const memoryState = require('../store/memoryState');
    const originalUsers = memoryState.users.slice();
    isDbConnected.mockResolvedValue(false);
    bcrypt.hash.mockResolvedValue('hashed-password');
    memoryState.users.length = 0;
    try {
      const res = buildRes();
      await authController.register(
        {
          body: {
            username: 'ada',
            email: 'ada@example.com',
            password: 'secret12',
            acceptTerms: true,
            termsVersion: '2026-10-27',
            termsAcceptedAt: '2000-01-01',
          },
        },
        res
      );
      const user = res.json.mock.calls[0][0];
      expect(user).toEqual(
        expect.objectContaining({ termsVersion: '2026-10-27', termsAcceptedAt: expect.any(String) })
      );
      expect(user.termsAcceptedAt).not.toBe('2000-01-01');
      expect(user.password_hash).toBeUndefined();
      const retry = buildRes();
      await authController.acceptTerms(
        { user: { id: user.id }, body: { acceptTerms: true, termsVersion: '2026-10-27' } },
        retry
      );
      expect(retry.json).toHaveBeenCalledWith({
        termsVersion: user.termsVersion,
        termsAcceptedAt: user.termsAcceptedAt,
      });
    } finally {
      memoryState.users.splice(0, memoryState.users.length, ...originalUsers);
    }
  });

  it('returns a generic error rather than storing a success receipt when terms persistence fails', async () => {
    pool.query.mockRejectedValueOnce(new Error('private database details'));
    const res = buildRes();
    await authController.acceptTerms(
      { user: { id: 7 }, body: { acceptTerms: true, termsVersion: '2026-10-27' } },
      res
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('private database details');
  });

  it('register normalizes email and promotes bootstrap admin account at creation', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // email duplicate check
      .mockResolvedValueOnce({ rows: [] }) // username duplicate check
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
        acceptTerms: true,
        termsVersion: '2026-10-27',
        password: 'StrongPass123',
        department: 'YBS',
      },
    };
    const res = buildRes();

    await authController.register(req, res);

    expect(pool.query).toHaveBeenNthCalledWith(1, 'SELECT id FROM users WHERE LOWER(email) = $1', [
      'emin3619@gmail.com',
    ]);

    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
      ['adminUser']
    );

    const insertCall = pool.query.mock.calls[2];
    expect(insertCall[0]).toContain('INSERT INTO users');
    expect(insertCall[1]).toEqual([
      'adminUser',
      'emin3619@gmail.com',
      'hashed-password',
      'YBS',
      'admin',
      true,
      '2026-10-27',
    ]);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin' }));
  });

  it('register sends a verification e-mail without waiting for it and reports the user unverified', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          { id: 21, username: 'ada', email: 'ada@gmail.com', points: 100, emailVerified: false },
        ],
      });
    mockIssueVerification.mockImplementationOnce(() => new Promise(() => {}));
    const res = buildRes();
    const answered = await Promise.race([
      authController
        .register(
          {
            body: {
              username: 'ada',
              email: 'Ada@gmail.com',
              password: 'secret12',
              acceptTerms: true,
              termsVersion: '2026-10-27',
            },
          },
          res
        )
        .then(() => 'answered'),
      new Promise((resolve) => setTimeout(() => resolve('waited'), 300)),
    ]);
    expect(answered).toBe('answered');
    expect(mockIssueVerification).toHaveBeenCalledWith(
      expect.objectContaining({ id: 21, email: 'ada@gmail.com', username: 'ada' })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ id: 21, emailVerified: false })
    );
    const insert = pool.query.mock.calls[2][0];
    expect(insert).toMatch(/email_verified_at IS NOT NULL AS "emailVerified"/);
  });

  it('verifyEmail answers verified/already with 200 and invalid/expired with 400', async () => {
    for (const [status, code] of [
      ['verified', 200],
      ['already', 200],
      ['expired', 400],
      ['invalid', 400],
    ]) {
      mockConfirmVerification.mockResolvedValueOnce({ status, userId: 7 });
      const res = buildRes();
      await authController.verifyEmail({ body: { token: 'a'.repeat(64) } }, res);
      if (code === 200) expect(res.status).not.toHaveBeenCalled();
      else expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status }));
      expect(JSON.stringify(res.json.mock.calls)).not.toMatch(/userId/);
    }
  });

  it('resendVerification says so when no e-mail can leave instead of claiming it sent one', async () => {
    mockIsEmailConfigured.mockReturnValueOnce(false);
    const res = buildRes();
    await authController.resendVerification(
      { user: { id: 7, username: 'ada', email: 'ada@gmail.com', emailVerified: false } },
      res
    );
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'EMAIL_UNAVAILABLE' }));
    expect(mockIssueVerification).not.toHaveBeenCalled();

    mockIssueVerification.mockResolvedValueOnce({ delivered: false });
    const failed = buildRes();
    await authController.resendVerification(
      { user: { id: 7, username: 'ada', email: 'ada@gmail.com', emailVerified: false } },
      failed
    );
    expect(failed.status).toHaveBeenCalledWith(503);
  });

  it('resendVerification issues a new link for an unverified user and refuses a verified one', async () => {
    mockIssueVerification.mockResolvedValueOnce({ delivered: true });
    const res = buildRes();
    await authController.resendVerification(
      { user: { id: 7, username: 'ada', email: 'ada@gmail.com', emailVerified: false } },
      res
    );
    expect(mockIssueVerification).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
    expect(res.json).toHaveBeenCalledWith({ sent: true });

    mockIssueVerification.mockClear();
    const verified = buildRes();
    await authController.resendVerification(
      { user: { id: 7, username: 'ada', email: 'ada@gmail.com', emailVerified: true } },
      verified
    );
    expect(mockIssueVerification).not.toHaveBeenCalled();
    expect(verified.json).toHaveBeenCalledWith({ status: 'already' });
  });

  it('rejects register when username is already taken (case-insensitive)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // email check passes
      .mockResolvedValueOnce({ rows: [{ id: 5 }] }); // username already exists
    bcrypt.hash.mockResolvedValue('hashed-password');

    const req = {
      body: {
        username: 'Emin',
        email: 'fresh@example.com',
        acceptTerms: true,
        termsVersion: '2026-10-27',
        password: 'StrongPass123',
        department: 'YBS',
      },
    };
    const res = buildRes();

    await authController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Bu kullanıcı adı kullanımda. Farklı bir kullanıcı adı seç.',
    });
    // INSERT must NOT be reached when username is taken
    const insertCalls = pool.query.mock.calls.filter((call) =>
      String(call[0]).includes('INSERT INTO users')
    );
    expect(insertCalls).toHaveLength(0);
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
            termsVersion: '2026-10-27',
            termsAcceptedAt: '2026-10-27T12:00:00.000Z',
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
    expect(res.cookie).toHaveBeenCalledWith(
      'auth_token',
      'signed-jwt-token',
      expect.objectContaining({
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'signed-jwt-token',
        user: expect.objectContaining({
          isAdmin: true,
          role: 'admin',
          termsVersion: '2026-10-27',
          termsAcceptedAt: '2026-10-27T12:00:00.000Z',
        }),
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
      message: 'Eğer e-posta adresi sistemde kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.',
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
      'SELECT id, email, username FROM users WHERE LOWER(TRIM(email)) = ANY($1::text[]) LIMIT 1',
      [['player@example.com']]
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
      message: 'Eğer e-posta adresi sistemde kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.',
    });
  });

  it('answers before the e-mail is sent, so timing does not reveal an account', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 11, email: 'player@example.com', username: 'player' }],
      })
      .mockResolvedValueOnce({ rowCount: 1 });
    mockSendPasswordResetEmail.mockImplementationOnce(() => new Promise(() => {}));
    const res = buildRes();
    const answered = await Promise.race([
      authController
        .forgotPassword(
          { body: { email: 'player@example.com' }, headers: {}, ip: '127.0.0.1' },
          res
        )
        .then(() => 'answered'),
      new Promise((resolve) => setTimeout(() => resolve('waited for e-mail'), 300)),
    ]);
    expect(answered).toBe('answered');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(mockSendPasswordResetEmail).toHaveBeenCalled();
  });

  it('still returns generic response when SMTP send fails for known account', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{ id: 11, email: 'player@example.com', username: 'player' }],
      })
      .mockResolvedValueOnce({ rowCount: 1 });
    mockSendPasswordResetEmail.mockRejectedValueOnce(new Error('SMTP auth failed'));

    const req = {
      body: { email: 'player@example.com' },
      headers: { 'user-agent': 'jest-test' },
      ip: '127.0.0.1',
    };
    const res = buildRes();

    await authController.forgotPassword(req, res);
    // The send runs after the answer; let its rejection handler run.
    for (let tick = 0; tick < 5; tick += 1) await Promise.resolve();

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Eğer e-posta adresi sistemde kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.',
    });
    expect(logger.error).toHaveBeenCalledWith(
      'forgotPassword e-mail send failed',
      expect.objectContaining({ userId: 11, to: 'p***@example.com' })
    );
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('player@example.com');
  });

  it('finds gmail alias accounts for forgot-password by canonical local-part', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: 77, email: 'emin.3619+web@googlemail.com', username: 'emin' }],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    const req = {
      body: { email: 'emin3619@gmail.com' },
      headers: { 'user-agent': 'jest-test' },
      ip: '127.0.0.1',
    };
    const res = buildRes();

    await authController.forgotPassword(req, res);

    expect(pool.query.mock.calls[0][0]).toContain('LOWER(TRIM(email)) = ANY');
    expect(pool.query.mock.calls[1][0]).toContain(
      "split_part(LOWER(TRIM(email)), '@', 2) IN ('gmail.com', 'googlemail.com')"
    );
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'emin.3619+web@googlemail.com',
        username: 'emin',
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
      })
    );
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

  it('logout clears auth cookie and returns success', async () => {
    const req = {
      headers: {},
      cookies: { auth_token: 'signed-jwt-token' },
    };
    const res = buildRes();

    await authController.logout(req, res);

    expect(res.clearCookie).toHaveBeenCalledWith(
      'auth_token',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(jwt.verify).toHaveBeenCalledWith('signed-jwt-token', 'test-secret');
    expect(global.tokenBlacklist.get('signed-jwt-token')).toBeGreaterThan(
      Math.floor(Date.now() / 1000)
    );
    global.tokenBlacklist.delete('signed-jwt-token');
  });
});
