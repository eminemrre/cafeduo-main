/** @jest-environment node */
const { createHash } = require('crypto');
const { createEmailVerificationService, VERIFICATION_TTL_MS } = require('./emailVerificationService');

const T0 = Date.parse('2026-10-27T10:00:00Z');
const tokenFrom = (sendEmail, call = 0) =>
  new URL(sendEmail.mock.calls[call][0].data.verifyUrl).searchParams.get('token');

const memorySetup = () => {
  let now = T0;
  const users = [
    { id: 7, username: 'ada', email: 'ada@gmail.com', emailVerifiedAt: null },
    { id: 8, username: 'bora', email: 'bora@example.com', emailVerifiedAt: null },
  ];
  const sendEmail = jest.fn(async () => ({ delivered: true, mode: 'capture' }));
  const service = createEmailVerificationService({
    pool: { query: jest.fn() },
    isDbConnected: async () => false,
    getMemoryUsers: () => users,
    sendEmail,
    logger: { error: jest.fn(), info: jest.fn() },
    now: () => now,
    appUrl: 'https://cafeduotr.com',
  });
  return { service, users, sendEmail, advance: (ms) => (now += ms) };
};

describe('email verification (memory mode)', () => {
  it('sends a 24-hour verification link to the user', async () => {
    const { service, sendEmail } = memorySetup();
    await service.issueVerification({ id: 7, username: 'ada', email: 'ada@gmail.com' });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ada@gmail.com',
        template: 'verify_email',
        data: expect.objectContaining({ username: 'ada', expiresInHours: 24 }),
        idempotencyKey: expect.stringMatching(/^verify_email\/7\//),
      })
    );
    expect(sendEmail.mock.calls[0][0].data.verifyUrl).toMatch(/^https:\/\/cafeduotr\.com\/dogrula\?token=[a-f0-9]{64}$/);
    expect(VERIFICATION_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('verifies once, sends the welcome once, and answers "already" to a second click', async () => {
    const { service, users, sendEmail } = memorySetup();
    await service.issueVerification(users[0]);
    const token = tokenFrom(sendEmail);
    expect(await service.confirmVerification(token)).toEqual({ status: 'verified', userId: 7 });
    expect(users[0].emailVerifiedAt).toEqual(expect.any(String));
    expect(await service.confirmVerification(token)).toEqual({ status: 'already', userId: 7 });
    const welcomes = sendEmail.mock.calls.filter(([args]) => args.template === 'welcome');
    expect(welcomes).toHaveLength(1);
    expect(welcomes[0][0]).toMatchObject({ to: 'ada@gmail.com', idempotencyKey: 'welcome/7' });
  });

  it('expires a link after 24 hours and rejects unknown or malformed ones', async () => {
    const { service, users, sendEmail, advance } = memorySetup();
    await service.issueVerification(users[0]);
    advance(VERIFICATION_TTL_MS + 1);
    expect(await service.confirmVerification(tokenFrom(sendEmail))).toEqual({ status: 'expired', userId: 7 });
    expect(users[0].emailVerifiedAt).toBeNull();
    expect(await service.confirmVerification('f'.repeat(64))).toEqual({ status: 'invalid' });
    expect(await service.confirmVerification('not a token')).toEqual({ status: 'invalid' });
    expect(await service.confirmVerification(undefined)).toEqual({ status: 'invalid' });
  });

  it('a new link replaces the older ones', async () => {
    const { service, users, sendEmail } = memorySetup();
    await service.issueVerification(users[0]);
    await service.issueVerification(users[0]);
    expect(await service.confirmVerification(tokenFrom(sendEmail, 0))).toEqual({ status: 'expired', userId: 7 });
    expect(await service.confirmVerification(tokenFrom(sendEmail, 1))).toEqual({ status: 'verified', userId: 7 });
  });

  it('a link verifies only its own user', async () => {
    const { service, users, sendEmail } = memorySetup();
    await service.issueVerification(users[1]);
    await service.confirmVerification(tokenFrom(sendEmail));
    expect(users[1].emailVerifiedAt).toEqual(expect.any(String));
    expect(users[0].emailVerifiedAt).toBeNull();
  });

  it('a failed send is logged, not thrown, and reported as not delivered', async () => {
    const { service, users, sendEmail } = memorySetup();
    sendEmail.mockRejectedValueOnce(new Error('resend down'));
    await expect(service.issueVerification(users[0])).resolves.toEqual({ delivered: false });
    sendEmail.mockResolvedValueOnce({ delivered: false, mode: 'none' });
    await expect(service.issueVerification(users[0])).resolves.toEqual({ delivered: false });
    await expect(service.issueVerification(users[0])).resolves.toEqual({ delivered: true });
  });

  it('answers "verified" without waiting for the welcome e-mail', async () => {
    const { service, users, sendEmail } = memorySetup();
    await service.issueVerification(users[0]);
    const token = tokenFrom(sendEmail);
    sendEmail.mockImplementation(() => new Promise(() => {}));
    const answered = await Promise.race([
      service.confirmVerification(token),
      new Promise((resolve) => setTimeout(() => resolve('waited'), 300)),
    ]);
    expect(answered).toEqual({ status: 'verified', userId: 7 });
  });
});

describe('email verification (database)', () => {
  const dbSetup = () => {
    const pool = { query: jest.fn() };
    const sendEmail = jest.fn(async () => ({ delivered: true }));
    const service = createEmailVerificationService({
      pool,
      isDbConnected: async () => true,
      getMemoryUsers: () => [],
      sendEmail,
      logger: { error: jest.fn(), info: jest.fn() },
      now: () => T0,
      appUrl: 'https://cafeduotr.com',
    });
    return { pool, sendEmail, service };
  };

  it('writes the new link and closes the older ones in one statement, storing only the hash', async () => {
    const { pool, sendEmail, service } = dbSetup();
    pool.query.mockResolvedValue({ rows: [{ id: 3 }], rowCount: 1 });
    await service.issueVerification({ id: 7, username: 'ada', email: 'ada@gmail.com' });
    // One atomic statement: a failure leaves the old link valid; the insert comes first.
    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql] = pool.query.mock.calls[0];
    expect(sql.indexOf('INSERT INTO email_verification_tokens')).toBeGreaterThan(-1);
    expect(sql.indexOf('INSERT INTO email_verification_tokens')).toBeLessThan(sql.indexOf('UPDATE email_verification_tokens'));
    expect(sql).toMatch(/id <> \(SELECT id FROM inserted\)/);
    expect(sql).not.toMatch(/SELECT \*/);
    const token = tokenFrom(sendEmail);
    const inserted = pool.query.mock.calls[0][1];
    expect(inserted).toContain(createHash('sha256').update(token).digest('hex'));
    expect(inserted).not.toContain(token);
  });

  it('two clicks at once verify once: the guarded update decides', async () => {
    const { pool, sendEmail, service } = dbSetup();
    const row = {
      id: 1,
      user_id: 7,
      expires_at: new Date(T0 + 1000).toISOString(),
      used_at: null,
      email: 'ada@gmail.com',
      username: 'ada',
      email_verified_at: null,
    };
    pool.query.mockImplementation(async (text) => {
      if (/SELECT/.test(text)) return { rows: [row] };
      if (/UPDATE users/.test(text)) return { rows: [], rowCount: 0 }; // the other click won
      return { rows: [], rowCount: 1 };
    });
    expect(await service.confirmVerification('a'.repeat(64))).toEqual({ status: 'already', userId: 7 });
    expect(sendEmail).not.toHaveBeenCalled();
    const select = pool.query.mock.calls.find(([text]) => /SELECT/.test(text))[0];
    expect(select).toMatch(/LIMIT 1/);
  });
});
