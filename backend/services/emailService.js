const nodemailer = require('nodemailer');
const { logger } = require('../utils/logger');

const parseBool = (value) => {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

const resolveTransport = () => {
  const host = String(process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = parseBool(process.env.SMTP_SECURE) || port === 465;
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();

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

  await transporter.sendMail({
    from: fromAddress,
    to: safeTo,
    subject,
    text,
  });

  return { delivered: true, mode: 'smtp' };
};

module.exports = {
  sendPasswordResetEmail,
};

