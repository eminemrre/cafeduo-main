/** @jest-environment node */
const { EMAIL_TEMPLATES, renderEmail } = require('./emailTemplates');

const DATA = {
  verify_email: { username: 'ada', verifyUrl: 'https://cafeduotr.com/dogrula?token=abc123', expiresInHours: 24 },
  welcome: { username: 'ada', appUrl: 'https://cafeduotr.com' },
  password_reset: {
    username: 'ada',
    resetUrl: 'https://cafeduotr.com/reset-password?token=def456',
    expiresInMinutes: 30,
  },
};

describe('renderEmail', () => {
  it('renders a Turkish subject, plain text and HTML for every template', () => {
    expect(EMAIL_TEMPLATES.sort()).toEqual(['password_reset', 'verify_email', 'welcome']);
    for (const template of EMAIL_TEMPLATES) {
      const email = renderEmail(template, DATA[template]);
      expect(email.subject).toMatch(/^CafeDuo · /);
      expect(email.text).toContain('Merhaba ada');
      expect(email.html).toMatch(/^<!doctype html>/);
      expect(email.html).toContain('lang="tr"');
    }
  });

  it('puts the full link in both parts of a link e-mail', () => {
    const verify = renderEmail('verify_email', DATA.verify_email);
    expect(verify.text).toContain('https://cafeduotr.com/dogrula?token=abc123');
    expect(verify.html).toContain('href="https://cafeduotr.com/dogrula?token=abc123"');
    expect(verify.text).toContain('24 saat');
    const reset = renderEmail('password_reset', DATA.password_reset);
    expect(reset.text).toContain('https://cafeduotr.com/reset-password?token=def456');
    expect(reset.text).toContain('30 dakika');
  });

  it('escapes user data in the HTML part', () => {
    const email = renderEmail('welcome', { username: '<b>x</b>"&', appUrl: 'https://cafeduotr.com' });
    expect(email.html).toContain('&lt;b&gt;x&lt;/b&gt;&quot;&amp;');
    expect(email.html).not.toContain('<b>x</b>');
  });

  it('refuses a link that is not http(s)', () => {
    expect(() =>
      // eslint-disable-next-line no-script-url -- the attack input this test refuses
      renderEmail('verify_email', { ...DATA.verify_email, verifyUrl: 'javascript:alert(1)' })
    ).toThrow(/link/i);
  });

  it('refuses an unknown template', () => {
    expect(() => renderEmail('nope', {})).toThrow(/template/i);
  });
});
