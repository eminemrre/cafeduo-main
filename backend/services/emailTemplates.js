/**
 * CafeDuo transactional e-mails: one frame, one function per template.
 *
 * `renderEmail(template, data)` is pure and returns `{ subject, text, html }`.
 * The HTML follows mail-client limits: table layout, inline styles only, a
 * system font stack, one call-to-action button with a plain link under it.
 * Colours are the DESIGN.md set (paper, ink, ice, lokum).
 *
 * Every value from `data` is escaped in the HTML part; links must be http(s).
 */

const INK = '#17140F';
const INK_SOFT = '#4A4540';
const PAPER = '#FFFFFF';
const ICE = '#EEF6F8';
const LOKUM = '#FF5C8A';
const LOKUM_TEXT = '#C4265F';
const FONT = "Helvetica,Arial,sans-serif";

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const safeLink = (value) => {
  const url = String(value || '').trim();
  if (!/^https?:\/\/[^\s"'<>]+$/i.test(url)) throw new Error('Unsafe or missing e-mail link');
  return url;
};

const nameOf = (data) => String(data?.username || '').trim().slice(0, 60) || 'Oyuncu';

/** The shared card: heading, paragraphs, an optional button and a note. */
const frame = ({ title, heading, paragraphs, action, note }) => {
  const body = paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.55;color:${INK};">${paragraph}</p>`
    )
    .join('\n');
  const button = action
    ? `<tr><td align="center" style="padding:10px 32px 4px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="background:${LOKUM};border-radius:12px;">
              <a href="${escapeHtml(action.url)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-weight:700;font-size:16px;color:${INK};text-decoration:none;">${escapeHtml(action.label)}</a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:16px 32px 0 32px;">
          <p style="margin:0 0 4px 0;font-size:12px;color:${INK_SOFT};">Buton çalışmazsa bu bağlantıyı tarayıcına yapıştır:</p>
          <p style="margin:0;font-size:13px;line-height:1.5;word-break:break-all;"><a href="${escapeHtml(action.url)}" style="color:${LOKUM_TEXT};">${escapeHtml(action.url)}</a></p>
        </td></tr>`
    : '';
  const noteRow = note
    ? `<tr><td style="padding:20px 32px 0 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${ICE};border-radius:12px;"><tr>
            <td style="padding:14px 18px;font-size:13px;line-height:1.5;color:${INK};">${note}</td>
          </tr></table>
        </td></tr>`
    : '';
  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${ICE};font-family:${FONT};color:${INK};">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${ICE};padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;background:${PAPER};border-radius:18px;">
          <tr><td style="padding:28px 32px 6px 32px;font-family:${FONT};font-weight:800;font-size:22px;color:${INK};">Cafe<span style="color:${LOKUM_TEXT};">Duo</span></td></tr>
          <tr><td style="padding:10px 32px 6px 32px;"><h1 style="margin:0;font-family:${FONT};font-size:24px;line-height:1.25;color:${INK};">${escapeHtml(heading)}</h1></td></tr>
          <tr><td style="padding:14px 32px 0 32px;">${body}</td></tr>
          ${button}
          ${noteRow}
          <tr><td style="padding:26px 32px 28px 32px;font-size:12px;line-height:1.5;color:${INK_SOFT};">
            CafeDuo · kafede iki kişilik oyunlar, kafenin kendi ödülleri.<br />cafeduotr.com
          </td></tr>
        </table>
        <p style="max-width:560px;margin:12px auto 0 auto;font-size:11px;line-height:1.5;color:${INK_SOFT};">Bu e-posta hesabınla ilgili bir işlem için otomatik gönderildi. Yanıtlaman gerekmez.</p>
      </td></tr>
    </table>
  </body>
</html>`;
};

const TEMPLATES = {
  verify_email: (data) => {
    const name = nameOf(data);
    const url = safeLink(data?.verifyUrl);
    const hours = Math.max(1, Number(data?.expiresInHours) || 24);
    return {
      subject: 'CafeDuo · E-postanı doğrula',
      text: [
        `Merhaba ${name},`,
        '',
        "CafeDuo'ya hoş geldin. Hesabını tamamlamak için e-posta adresini doğrula:",
        '',
        url,
        '',
        `Bağlantı ${hours} saat geçerli. Bu hesabı sen açmadıysan bu e-postayı yok sayabilirsin.`,
        '',
        '— CafeDuo',
      ].join('\n'),
      html: frame({
        title: 'CafeDuo - E-posta doğrulama',
        heading: 'E-postanı doğrula',
        paragraphs: [
          `Merhaba <strong>${escapeHtml(name)}</strong>,`,
          "CafeDuo'ya hoş geldin. Hesabını tamamlamak için e-posta adresini doğrula.",
        ],
        action: { label: 'E-postamı doğrula', url },
        note: `Bağlantı ${hours} saat geçerli. Bu hesabı sen açmadıysan bu e-postayı yok sayabilirsin.`,
      }),
    };
  },

  welcome: (data) => {
    const name = nameOf(data);
    const url = safeLink(data?.appUrl);
    return {
      subject: "CafeDuo · Aramıza hoş geldin",
      text: [
        `Merhaba ${name},`,
        '',
        'E-postan doğrulandı. Bir kafeye girince masana katıl, yan masadan biriyle kısa bir oyun aç;',
        'kazandığın puanları o kafenin ödüllerinde kullanırsın.',
        '',
        url,
        '',
        '— CafeDuo',
      ].join('\n'),
      html: frame({
        title: 'CafeDuo - Hoş geldin',
        heading: 'Aramıza hoş geldin',
        paragraphs: [
          `Merhaba <strong>${escapeHtml(name)}</strong>,`,
          'E-postan doğrulandı. Bir kafeye girince masana katıl, yan masadan biriyle kısa bir oyun aç; kazandığın puanları o kafenin ödüllerinde kullanırsın.',
        ],
        action: { label: "CafeDuo'yu aç", url },
      }),
    };
  },

  password_reset: (data) => {
    const name = nameOf(data);
    const url = safeLink(data?.resetUrl);
    const minutes = Math.max(5, Number(data?.expiresInMinutes) || 30);
    return {
      subject: 'CafeDuo · Şifreni sıfırla',
      text: [
        `Merhaba ${name},`,
        '',
        'CafeDuo hesabın için bir şifre sıfırlama talebi aldık.',
        `Aşağıdaki bağlantıyla ${minutes} dakika içinde yeni şifreni belirleyebilirsin:`,
        '',
        url,
        '',
        'Bu talebi sen yapmadıysan bu e-postayı yok sayman yeterli; şifren değişmez.',
        '',
        '— CafeDuo',
      ].join('\n'),
      html: frame({
        title: 'CafeDuo - Şifre sıfırlama',
        heading: 'Yeni şifreni belirle',
        paragraphs: [
          `Merhaba <strong>${escapeHtml(name)}</strong>,`,
          `CafeDuo hesabın için bir şifre sıfırlama talebi aldık. Aşağıdaki butonla <strong>${minutes} dakika</strong> içinde yeni şifreni belirleyebilirsin.`,
        ],
        action: { label: 'Şifremi sıfırla', url },
        note: 'Bu talebi sen yapmadıysan bu e-postayı yok sayman yeterli; şifren değişmez.',
      }),
    };
  },
};

const EMAIL_TEMPLATES = Object.keys(TEMPLATES);

const renderEmail = (template, data) => {
  const build = TEMPLATES[template];
  if (!build) throw new Error(`Unknown e-mail template: ${template}`);
  return build(data || {});
};

module.exports = { EMAIL_TEMPLATES, renderEmail, escapeHtml };
