const ENV_KEYS = [
  'RESEND_API_KEY',
  'RESEND_FROM',
  'EMAIL_CAPTURE',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'SMTP_SEND_TIMEOUT_MS',
  'SMTP_SEND_RETRIES',
];

const buildPayload = () => ({
  to: 'player@example.com',
  username: 'player',
  resetUrl: 'https://cafeduotr.com/reset-password?token=test',
  expiresInMinutes: 30,
});

const restoreEnv = (snapshot) => {
  for (const key of ENV_KEYS) {
    if (Object.prototype.hasOwnProperty.call(snapshot, key)) {
      process.env[key] = snapshot[key];
    } else {
      delete process.env[key];
    }
  }
};

const setBaseSmtpEnv = () => {
  process.env.SMTP_HOST = 'smtp.gmail.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'smtp-user@example.test';
  process.env.SMTP_PASS = 'demo token with spaces';
  process.env.SMTP_FROM = 'smtp-user@example.test';
  process.env.SMTP_SEND_TIMEOUT_MS = '1200';
  process.env.SMTP_SEND_RETRIES = '2';
};

describe('emailService', () => {
  let envSnapshot;

  beforeEach(() => {
    envSnapshot = {};
    for (const key of ENV_KEYS) {
      if (Object.prototype.hasOwnProperty.call(process.env, key)) {
        envSnapshot[key] = process.env[key];
      }
      delete process.env[key];
    }
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    restoreEnv(envSnapshot);
  });

  const loadService = ({ transport } = {}) => {
    const mockTransport = transport || {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-id' }),
    };
    const createTransport = jest.fn(() => mockTransport);
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    jest.doMock('nodemailer', () => ({
      createTransport,
    }));
    jest.doMock('../utils/logger', () => logger);

    const service = require('./emailService');
    const nodemailer = require('nodemailer');
    return { service, nodemailer, logger, mockTransport };
  };

  it('sends nothing and never logs the link or the address when no provider is configured', async () => {
    const { service, logger } = loadService();
    expect(service.isEmailConfigured()).toBe(false);
    const response = await service.sendPasswordResetEmail(buildPayload());

    expect(response).toEqual({ delivered: false, mode: 'none' });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('No email provider configured'),
      expect.objectContaining({ to: 'p***@example.com', template: 'password_reset' })
    );
    const logged = JSON.stringify([logger.info.mock.calls, logger.warn.mock.calls, logger.error.mock.calls]);
    expect(logged).not.toMatch(/token=|https?:\/\/|player@example\.com/);
  });

  it('knows when a provider is configured', () => {
    process.env.RESEND_API_KEY = 're_test';
    expect(loadService().service.isEmailConfigured()).toBe(true);
    delete process.env.RESEND_API_KEY;
    jest.resetModules();
    setBaseSmtpEnv();
    expect(loadService().service.isEmailConfigured()).toBe(true);
  });

  it('sends a rendered template through Resend and logs only a masked address', async () => {
    process.env.RESEND_API_KEY = 're_test';
    const fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({ id: 'msg_1' }) }));
    global.fetch = fetchMock;
    const { service, logger } = loadService();
    const response = await service.sendEmail({
      to: 'ada.lovelace@gmail.com',
      template: 'verify_email',
      data: { username: 'ada', verifyUrl: 'https://cafeduotr.com/dogrula?token=abc', expiresInHours: 24 },
      idempotencyKey: 'verify_email/7/3',
    });
    expect(response).toEqual({ delivered: true, mode: 'resend', messageId: 'msg_1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    // A retried request with the same key is not sent twice by Resend.
    expect(init.headers['Idempotency-Key']).toBe('verify_email/7/3');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      to: 'ada.lovelace@gmail.com',
      from: 'CafeDuo <noreply@cafeduotr.com>',
      subject: 'CafeDuo · E-postanı doğrula',
    });
    expect(body.text).toContain('https://cafeduotr.com/dogrula?token=abc');
    expect(JSON.stringify(logger.info.mock.calls)).toContain('a***@gmail.com');
    expect(JSON.stringify(logger.info.mock.calls)).not.toMatch(/ada\.lovelace|token=/);
  });

  it('captures e-mails instead of sending them only when EMAIL_CAPTURE is on outside production', async () => {
    process.env.EMAIL_CAPTURE = 'true';
    process.env.RESEND_API_KEY = 're_test';
    global.fetch = jest.fn();
    const { service } = loadService();
    const result = await service.sendEmail({
      to: 'Ada@Example.com',
      template: 'welcome',
      data: { username: 'ada', appUrl: 'https://cafeduotr.com' },
    });
    expect(result).toEqual({ delivered: true, mode: 'capture' });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(service.capturedEmails('ada@example.com')).toEqual([
      expect.objectContaining({ template: 'welcome', subject: 'CafeDuo · Aramıza hoş geldin' }),
    ]);
    expect(service.isEmailConfigured()).toBe(true);

    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      jest.resetModules();
      const prod = loadService().service;
      await prod.sendEmail({ to: 'ada@example.com', template: 'welcome', data: { username: 'ada', appUrl: 'https://cafeduotr.com' } }).catch(() => {});
      expect(prod.capturedEmails('ada@example.com')).toEqual([]);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it('keeps each address\'s captured e-mails even when many others arrive', async () => {
    process.env.EMAIL_CAPTURE = 'true';
    const { service } = loadService();
    const data = { username: 'ada', appUrl: 'https://cafeduotr.com' };
    await service.sendEmail({ to: 'first@example.com', template: 'welcome', data });
    for (let i = 0; i < 250; i += 1) {
      await service.sendEmail({ to: `other${i}@example.com`, template: 'welcome', data });
    }
    expect(service.capturedEmails('first@example.com')).toHaveLength(1);
  });

  it('falls back to SMTP when Resend fails', async () => {
    process.env.RESEND_API_KEY = 're_test';
    setBaseSmtpEnv();
    global.fetch = jest.fn(async () => ({ ok: false, status: 500, text: async () => 'boom' }));
    const { service, mockTransport } = loadService();
    const response = await service.sendEmail({
      to: 'player@example.com',
      template: 'welcome',
      data: { username: 'ada', appUrl: 'https://cafeduotr.com' },
    });
    expect(response).toEqual(expect.objectContaining({ delivered: true, mode: 'smtp' }));
    expect(mockTransport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'CafeDuo · Aramıza hoş geldin' })
    );
  });

  it('normalizes Gmail app password spaces before creating transporter', async () => {
    setBaseSmtpEnv();
    const { service, nodemailer, logger } = loadService();
    const response = await service.sendPasswordResetEmail(buildPayload());

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.gmail.com',
        auth: expect.objectContaining({
          user: 'smtp-user@example.test',
          pass: 'demotokenwithspaces',
        }),
      })
    );
    expect(response).toEqual(expect.objectContaining({ delivered: true, mode: 'smtp' }));
    expect(logger.warn).toHaveBeenCalledWith(
      'SMTP_PASS contained whitespace; normalized for Gmail app-password format.'
    );
  });

  it('retries once on transient SMTP errors and succeeds on second attempt', async () => {
    setBaseSmtpEnv();
    process.env.SMTP_HOST = 'smtp.custom.mail';
    process.env.SMTP_PASS = 'plainpassword';

    const firstError = new Error('timeout');
    firstError.code = 'ETIMEDOUT';
    const sendMail = jest
      .fn()
      .mockRejectedValueOnce(firstError)
      .mockResolvedValueOnce({ messageId: 'retry-ok' });

    const { service, logger } = loadService({ transport: { sendMail } });
    const response = await service.sendPasswordResetEmail(buildPayload());

    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(response).toEqual(expect.objectContaining({ delivered: true, attempt: 2 }));
    expect(logger.error).toHaveBeenCalledWith(
      'E-mail delivery failed',
      expect.objectContaining({
        attempt: 1,
        retryable: true,
        code: 'ETIMEDOUT',
      })
    );
  });
});
