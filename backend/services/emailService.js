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
const sendViaResend = async ({ from, to, subject, text, html }) => {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) return null;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
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

/**
 * Build a CafeDuo-branded HTML password-reset email.
 *
 * Email-client constraints kept in mind:
 *   - Table-based layout (no flexbox/grid — Outlook on Windows still
 *     doesn't render those)
 *   - Inline `style` attributes only — no external <style> blocks
 *   - System-safe font stack (no @font-face web fonts; mail clients
 *     either ignore or fall back ugly)
 *   - Single big CTA button, plus a plain `<a>` fallback in case the
 *     button gets stripped by aggressive sanitizers
 *
 * Visual: warm paper background, ink type, a pink accent stripe at the
 * top and an ink-bordered CTA button with offset shadow — all built from
 * plain hex values so mail clients render it as drawn.
 */
const buildPasswordResetHtml = ({ displayName, resetUrl, ttl }) => {
  const safeName = String(displayName || 'Oyuncu')
    .replace(/[<>"']/g, '')
    .slice(0, 60);
  const safeUrl = String(resetUrl || '').replace(/"/g, '&quot;');
  const safeTtl = Math.max(5, Number(ttl) || 30);
  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <title>CafeDuo - Şifre Sıfırlama</title>
  </head>
  <body style="margin:0;padding:0;background:#ece3cc;font-family:'Familjen Grotesk',Helvetica,Arial,sans-serif;color:#141413;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ece3cc;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;background:#fbf7ee;border:2px solid #141413;box-shadow:4px 4px 0 #1e3fb5,8px 8px 0 #ff3e94;">
            <!-- Top stripe -->
            <tr>
              <td style="height:8px;background:#ff3e94;border-bottom:2px solid #141413;line-height:8px;font-size:0;">&nbsp;</td>
            </tr>

            <!-- Header -->
            <tr>
              <td style="padding:28px 32px 8px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background:#ff3e94;border:2px solid #141413;width:36px;height:36px;text-align:center;vertical-align:middle;font-weight:700;font-size:18px;line-height:1;color:#141413;">☕</td>
                    <td style="padding-left:12px;font-family:'Familjen Grotesk',Helvetica,Arial,sans-serif;font-weight:700;font-size:22px;letter-spacing:0.04em;color:#141413;">
                      Cafe<span style="color:#d8246f;">Duo</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Eyebrow + headline -->
            <tr>
              <td style="padding:8px 32px 0 32px;">
                <p style="margin:0 0 6px 0;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;font-weight:700;color:#6a6a66;">
                  Şifre Sıfırlama
                </p>
                <h1 style="margin:0;font-family:'Familjen Grotesk',Helvetica,Arial,sans-serif;font-size:26px;line-height:1.2;letter-spacing:0.02em;text-transform:uppercase;color:#141413;">
                  Yeni şifreni belirle
                </h1>
              </td>
            </tr>

            <!-- Greeting + intro -->
            <tr>
              <td style="padding:20px 32px 0 32px;">
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.55;color:#141413;">
                  Merhaba <strong>${safeName}</strong>,
                </p>
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.55;color:#141413;">
                  CafeDuo hesabın için şifre sıfırlama talebi aldık. Aşağıdaki butona tıklayarak
                  <strong style="color:#d8246f;">${safeTtl} dakika</strong> içinde yeni şifreni belirleyebilirsin.
                </p>
              </td>
            </tr>

            <!-- CTA button -->
            <tr>
              <td align="center" style="padding:18px 32px 8px 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background:#ff3e94;border:2px solid #141413;box-shadow:4px 4px 0 #141413;">
                      <a href="${safeUrl}"
                         style="display:inline-block;padding:14px 32px;font-family:'Familjen Grotesk',Helvetica,Arial,sans-serif;font-weight:700;font-size:14px;letter-spacing:0.14em;text-transform:uppercase;color:#141413;text-decoration:none;">
                        Şifremi Sıfırla &nbsp;→
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Plain link fallback -->
            <tr>
              <td style="padding:18px 32px 0 32px;">
                <p style="margin:0 0 6px 0;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;font-weight:700;color:#6a6a66;">
                  Buton çalışmıyorsa
                </p>
                <p style="margin:0;font-size:13px;line-height:1.5;color:#2a2a28;word-break:break-all;">
                  Tarayıcına şu bağlantıyı kopyala: <br/>
                  <a href="${safeUrl}" style="color:#1e3fb5;text-decoration:underline;">${safeUrl}</a>
                </p>
              </td>
            </tr>

            <!-- Security note -->
            <tr>
              <td style="padding:24px 32px 0 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f1b41e;border:2px solid #141413;">
                  <tr>
                    <td style="padding:14px 18px;font-size:13px;line-height:1.5;color:#141413;">
                      <strong>Bu talebi sen yapmadıysan</strong> bu e-postayı yok sayabilirsin —
                      şifren değişmeyecek. Bağlantı ${safeTtl} dakika sonra otomatik geçersiz olur.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Divider -->
            <tr>
              <td style="padding:28px 32px 0 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="border-top:2px dashed #6a6a66;height:1px;line-height:1px;font-size:0;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:18px 32px 32px 32px;text-align:center;">
                <p style="margin:0 0 4px 0;font-family:'Familjen Grotesk',Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.04em;color:#141413;">
                  CafeDuo
                </p>
                <p style="margin:0 0 12px 0;font-size:12px;line-height:1.5;color:#6a6a66;">
                  Üniversite kafelerinde 2 kişilik oyunlar, puanlar, kafe ödülleri.
                </p>
                <p style="margin:0;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#6a6a66;">
                  cafeduotr.com · destek@cafeduotr.com
                </p>
              </td>
            </tr>
          </table>

          <!-- Below-card disclaimer -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;margin-top:14px;">
            <tr>
              <td style="padding:0 16px;text-align:center;font-size:11px;line-height:1.5;color:#6a6a66;">
                Bu e-posta CafeDuo hesap güvenliği için otomatik olarak gönderildi.
                Yanıtlama gerekmez.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const sendPasswordResetEmail = async ({ to, username, resetUrl, expiresInMinutes }) => {
  const safeTo = String(to || '').trim();
  if (!safeTo) {
    throw new Error('Recipient e-mail is required.');
  }

  const fromAddress =
    String(process.env.RESEND_FROM || '').trim() ||
    String(process.env.SMTP_FROM || '').trim() ||
    String(process.env.SMTP_USER || '').trim() ||
    'CafeDuo <noreply@cafeduotr.com>';
  const ttl = Math.max(5, Number(expiresInMinutes) || 30);
  const subject = 'CafeDuo · Şifreni sıfırla';
  const displayName = String(username || 'Oyuncu').trim() || 'Oyuncu';
  // Plain-text fallback — used by mail clients that strip HTML and as the
  // text/plain MIME part. Keep it humanly readable, not just a URL dump.
  const text = [
    `Merhaba ${displayName},`,
    '',
    'CafeDuo hesabın için bir şifre sıfırlama talebi aldık.',
    `Aşağıdaki bağlantıya tıklayarak ${ttl} dakika içinde yeni şifreni belirleyebilirsin:`,
    '',
    resetUrl,
    '',
    'Bu talebi sen yapmadıysan bu e-postayı yok sayman yeterli — şifren değişmeyecek.',
    `Bağlantı ${ttl} dakika sonra otomatik geçersiz olur.`,
    '',
    '— CafeDuo Güvenlik',
    'cafeduotr.com',
  ].join('\n');
  const html = buildPasswordResetHtml({ displayName, resetUrl, ttl });

  // Try Resend first if RESEND_API_KEY is set — single-env-var setup,
  // no SMTP servers to manage. Falls through to nodemailer SMTP on error
  // or when the key isn't configured.
  if (String(process.env.RESEND_API_KEY || '').trim()) {
    try {
      const messageId = await sendViaResend({
        from: fromAddress,
        to: safeTo,
        subject,
        text,
        html,
      });
      logger.info('Password reset e-mail sent', {
        to: safeTo,
        mode: 'resend',
        messageId,
      });
      return { delivered: true, mode: 'resend', messageId };
    } catch (error) {
      logger.error('Resend delivery failed; falling back to SMTP if configured', {
        to: safeTo,
        message: error?.message || String(error),
      });
      // Fall through to SMTP attempt below
    }
  }

  const transporter = getTransporter();
  if (!transporter) {
    logger.warn(
      'No email provider configured (RESEND_API_KEY + SMTP both missing). Reset link logged instead.',
      {
        to: safeTo,
        resetUrl,
      }
    );
    return { delivered: false, mode: 'log-only' };
  }

  const sendTimeoutMs = parsePositiveInt(process.env.SMTP_SEND_TIMEOUT_MS, 15_000);
  const maxAttempts = Math.max(1, Math.min(4, parsePositiveInt(process.env.SMTP_SEND_RETRIES, 2)));

  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const info = await sendWithTimeout({
        transporter,
        from: fromAddress,
        to: safeTo,
        subject,
        text,
        html,
        timeoutMs: sendTimeoutMs,
      });

      logger.info('Password reset e-mail sent', {
        to: safeTo,
        attempt,
        mode: 'smtp',
        messageId: info?.messageId || null,
      });

      return { delivered: true, mode: 'smtp', attempt };
    } catch (error) {
      lastError = error;
      const retryable = isRetryableSmtpError(error);
      logger.error('Password reset e-mail delivery failed', {
        to: safeTo,
        attempt,
        retryable,
        code: error?.code || null,
        responseCode: error?.responseCode || null,
        message: error?.message || String(error),
      });

      if (!retryable || attempt >= maxAttempts) {
        break;
      }
      await wait(400 * attempt);
    }
  }

  throw lastError || new Error('SMTP send failed');
};

module.exports = {
  sendPasswordResetEmail,
};
