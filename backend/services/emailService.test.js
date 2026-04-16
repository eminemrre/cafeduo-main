const ENV_KEYS = [
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

  it('falls back to log-only mode when SMTP is missing', async () => {
    const { service, logger } = loadService();
    const response = await service.sendPasswordResetEmail(buildPayload());

    expect(response).toEqual({ delivered: false, mode: 'log-only' });
    expect(logger.warn).toHaveBeenCalledWith(
      'SMTP not configured. Password reset link logged instead of e-mail send.',
      expect.objectContaining({ to: 'player@example.com' })
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
      'Password reset e-mail delivery failed',
      expect.objectContaining({
        attempt: 1,
        retryable: true,
        code: 'ETIMEDOUT',
      })
    );
  });
});
