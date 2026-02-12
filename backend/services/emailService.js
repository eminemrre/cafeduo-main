const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const parseBool = (value) => {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeSmtpPassword = (password, host) => {
  const raw = String(password || '').trim();
  if (!raw.includes(' ')) return raw;
  const normalized = raw.replace(/\s+/g, '');
  if (String(host || '').toLowerCase().includes('gmail')) {
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

const transporter = resolveTransport();

const sendPasswordResetEmail = async ({ to, username, resetUrl, expiresInMinutes }) => {
  const safeTo = String(to || '').trim();
  if (!safeTo) {
    throw new Error('Recipient e-mail is required.');
  }

  const fromAddress =
    String(process.env.SMTP_FROM || '').trim() ||
    String(process.env.SMTP_USER || '').trim() ||
    'noreply@cafeduo.com';
  const ttl = Math.max(5, Number(expiresInMinutes) || 30);
  const subject = 'CafeDuo - Şifre Sıfırlama';
  const displayName = String(username || 'Oyuncu').trim() || 'Oyuncu';
  const text = [
    `Merhaba ${displayName},`,
    '',
    'Şifre sıfırlama talebiniz alındı.',
    `Bağlantı (${ttl} dakika geçerli):`,
    resetUrl,
    '',
    'Eğer bu talebi siz yapmadıysanız bu e-postayı yok sayabilirsiniz.',
    '',
    'CafeDuo Güvenlik',
  ].join('\n');

  if (!transporter) {
    logger.warn('SMTP not configured. Password reset link logged instead of e-mail send.', {
      to: safeTo,
      resetUrl,
    });
    return { delivered: false, mode: 'log-only' };
  }

  const sendTimeoutMs = parsePositiveInt(process.env.SMTP_SEND_TIMEOUT_MS, 15_000);
  await Promise.race([
    transporter.sendMail({
      from: fromAddress,
      to: safeTo,
      subject,
      text,
    }),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`SMTP send timeout after ${sendTimeoutMs}ms`)), sendTimeoutMs);
    }),
  ]);

  return { delivered: true, mode: 'smtp' };
};

module.exports = {
  sendPasswordResetEmail,
};
