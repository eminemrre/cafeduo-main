const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const { renderEmail } = require('./emailTemplates');

const parseBool = (value) => {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const wait = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const normalizeSmtpPassword = (password, host) => {
  const raw = String(password || '').trim();
  if (!raw.includes(' ')) return raw;
  const normalized = raw.replace(/\s+/g, '');
  if (
    String(host || '')
      .toLowerCase()
      .includes('gmail')
  ) {
    logger.warn('SMTP_PASS contained whitespace; normalized for Gmail app-password format.');
    return normalized;
  }
  return raw;
};

const resolveTransport = () => {
  const host = String(process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = parseBool(process.env.SMTP_SECURE) || port === 465;
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = normalizeSmtpPassword(process.env.SMTP_PASS, host);
  const connectionTimeout = parsePositiveInt(process.env.SMTP_CONNECTION_TIMEOUT_MS, 10_000);
  const greetingTimeout = parsePositiveInt(process.env.SMTP_GREETING_TIMEOUT_MS, 10_000);
  const socketTimeout = parsePositiveInt(process.env.SMTP_SOCKET_TIMEOUT_MS, 15_000);

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    connectionTimeout,
    greetingTimeout,
    socketTimeout,
  });
};

const getTransporter = () => {
  try {
    return resolveTransport();
  } catch (error) {
    logger.error('SMTP transporter init failed', {
      message: error?.message || String(error),
    });
    return null;
  }
};

const isRetryableSmtpError = (error) => {
  const code = String(error?.code || '').toUpperCase();
  return ['ETIMEDOUT', 'ECONNECTION', 'ECONNRESET', 'ESOCKET', 'EAI_AGAIN'].includes(code);
};

const sendWithTimeout = async ({ transporter, from, to, subject, text, html, timeoutMs }) =>
  Promise.race([
    transporter.sendMail({
      from,
      to,
      subject,
      text,
      ...(html ? { html } : {}),
    }),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`SMTP send timeout after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);

/**
 * Send via Resend HTTPS API. Preferred path because it just needs one
 * env var (RESEND_API_KEY) — no SMTP host/port/auth dance. If the API
 * call fails (network, 4xx/5xx), we let the caller try the SMTP path
 * as fallback.
 *
 * Resend free tier: 100 emails/day, 3000/month — plenty for password
 * reset traffic.
 */
const sendViaResend = async ({ from, to, subject, text, html, idempotencyKey }) => {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) return null;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(idempotencyKey ? { 'Idempotency-Key': String(idempotencyKey).slice(0, 256) } : {}),
    },
    body: JSON.stringify({ from, to, subject, text, html }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Resend API ${response.status}: ${body.slice(0, 200)}`);
  }
  const data = await response.json().catch(() => ({}));
  return data?.id || 'resend-ok';
};

const DEFAULT_FROM = 'CafeDuo <noreply@cafeduotr.com>';

const fromAddress = () =>
  String(process.env.RESEND_FROM || '').trim() ||
  String(process.env.SMTP_FROM || '').trim() ||
  String(process.env.SMTP_USER || '').trim() ||
  DEFAULT_FROM;

/** `ada.lovelace@gmail.com` → `a***@gmail.com`: enough to trace, not to identify. */
const maskAddress = (address) => {
  const [local, domain] = String(address || '').split('@');
  if (!local || !domain) return '***';
  return `${local[0]}***@${domain}`;
};

const isEmailConfigured = () =>
  Boolean(String(process.env.RESEND_API_KEY || '').trim()) || Boolean(resolveTransport());

/**
 * The one way to send a CafeDuo e-mail: Resend first, SMTP as a fallback,
 * otherwise nothing (and nothing secret in the logs). Never throws for a
 * missing provider; throws only when a configured provider keeps failing.
 */
const sendEmail = async ({ to, template, data, idempotencyKey } = {}) => {
  const safeTo = String(to || '').trim();
  if (!safeTo) throw new Error('Recipient e-mail is required.');
  const { subject, text, html } = renderEmail(template, data);
  const from = fromAddress();
  const masked = maskAddress(safeTo);

  if (String(process.env.RESEND_API_KEY || '').trim()) {
    try {
      const messageId = await sendViaResend({ from, to: safeTo, subject, text, html, idempotencyKey });
      logger.info('E-mail sent', { to: masked, template, mode: 'resend', messageId });
      return { delivered: true, mode: 'resend', messageId };
    } catch (error) {
      logger.error('Resend delivery failed; trying SMTP if configured', {
        to: masked,
        template,
        message: error?.message || String(error),
      });
    }
  }

  const transporter = getTransporter();
  if (!transporter) {
    logger.warn('No email provider configured (RESEND_API_KEY and SMTP missing); e-mail not sent.', {
      to: masked,
      template,
    });
    return { delivered: false, mode: 'none' };
  }

  const sendTimeoutMs = parsePositiveInt(process.env.SMTP_SEND_TIMEOUT_MS, 15_000);
  const maxAttempts = Math.max(1, Math.min(4, parsePositiveInt(process.env.SMTP_SEND_RETRIES, 2)));
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const info = await sendWithTimeout({ transporter, from, to: safeTo, subject, text, html, timeoutMs: sendTimeoutMs });
      logger.info('E-mail sent', { to: masked, template, attempt, mode: 'smtp', messageId: info?.messageId || null });
      return { delivered: true, mode: 'smtp', attempt };
    } catch (error) {
      lastError = error;
      const retryable = isRetryableSmtpError(error);
      logger.error('E-mail delivery failed', {
        to: masked,
        template,
        attempt,
        retryable,
        code: error?.code || null,
        responseCode: error?.responseCode || null,
        message: error?.message || String(error),
      });
      if (!retryable || attempt >= maxAttempts) break;
      await wait(400 * attempt);
    }
  }
  throw lastError || new Error('SMTP send failed');
};

/** Kept for existing callers; the reset e-mail is the `password_reset` template. */
const sendPasswordResetEmail = ({ to, username, resetUrl, expiresInMinutes }) =>
  sendEmail({ to, template: 'password_reset', data: { username, resetUrl, expiresInMinutes } });

module.exports = {
  isEmailConfigured,
  maskAddress,
  sendEmail,
  sendPasswordResetEmail,
};
