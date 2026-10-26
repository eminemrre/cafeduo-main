import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  DEFAULT_E2E_APP_BASE_URL,
  bootstrapAuthenticatedPage,
  checkInUser,
  fetchCurrentUser,
  provisionUser,
  resolveApiBaseUrl,
  waitForApiReady,
} from './helpers/session';

/**
 * E-mail flows end to end with the capture inbox (EMAIL_CAPTURE=true, set by
 * scripts/e2e/run-with-env.cjs): registration sends a verification link that
 * verifies the account once; "Şifremi unuttum" sends a reset link that sets a
 * new password.
 */

type CapturedEmail = { template: string; subject: string; text: string };

const apiRootFor = (baseURL?: string) => resolveApiBaseUrl(baseURL || DEFAULT_E2E_APP_BASE_URL);

const inbox = async (request: APIRequestContext, apiRoot: string, to: string) => {
  const res = await request.get(`${apiRoot}/api/test/emails?to=${encodeURIComponent(to)}`);
  expect(res.ok(), 'the E2E stack must run with EMAIL_CAPTURE=true').toBeTruthy();
  return ((await res.json()).emails || []) as CapturedEmail[];
};

const linkIn = (email: CapturedEmail, path: string) => {
  const match = email.text.match(new RegExp(`https?://\\S+${path}\\?token=([a-f0-9]+)`));
  expect(match, `${email.template} carries a ${path} link`).toBeTruthy();
  return match![1];
};

test.describe('E-posta', () => {
  test('@smoke registration verifies the address once and sends the welcome', async ({
    page,
    request,
    baseURL,
  }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    const apiRoot = apiRootFor(root);
    await waitForApiReady(request, apiRoot);
    const session = await provisionUser(request, root, 'mail');
    expect(session.user.emailVerified).toBe(false);

    const email = session.credentials.email;
    await expect.poll(async () => (await inbox(request, apiRoot, email)).map((m) => m.template)).toContain('verify_email');
    const verify = (await inbox(request, apiRoot, email)).find((m) => m.template === 'verify_email')!;
    expect(verify.subject).toBe('CafeDuo · E-postanı doğrula');
    const token = linkIn(verify, '/dogrula');

    // Signed in and checked in at a table, the panel asks for verification.
    await checkInUser(request, root, session.token, { tableNumber: 17, csrfToken: session.csrfToken });
    const user = await fetchCurrentUser(request, root, session.token);
    expect(user.emailVerified).toBe(false);
    await bootstrapAuthenticatedPage(page, root, session, {
      checkedIn: true,
      userOverride: user,
      skipCheckInRecovery: true,
    });
    await page.goto(`${root}/dashboard`);
    await expect(page.getByRole('region', { name: 'E-posta doğrulama' })).toBeVisible({ timeout: 15_000 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: test.info().outputPath('phone-verify-band.png') });

    await page.goto(`${root}/dogrula?token=${token}`);
    await expect(page.getByRole('heading', { name: 'E-postan doğrulandı' })).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: test.info().outputPath('phone-verified.png') });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'E-postan zaten doğrulanmış' })).toBeVisible({ timeout: 15_000 });

    const templates = (await inbox(request, apiRoot, email)).map((m) => m.template);
    expect(templates.filter((t) => t === 'welcome')).toHaveLength(1);

    await page.goto(`${root}/dashboard`);
    await expect(page.getByRole('region', { name: 'E-posta doğrulama' })).toHaveCount(0, { timeout: 15_000 });
  });

  test('@smoke a reset link from "Şifremi unuttum" sets a new password', async ({ page, request, baseURL }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    const apiRoot = apiRootFor(root);
    await waitForApiReady(request, apiRoot);
    const session = await provisionUser(request, root, 'reset');
    const { email } = session.credentials;

    const asked = await request.post(`${apiRoot}/api/auth/forgot-password`, { data: { email } });
    expect(asked.ok()).toBeTruthy();
    await expect.poll(async () => (await inbox(request, apiRoot, email)).map((m) => m.template)).toContain('password_reset');
    const reset = (await inbox(request, apiRoot, email)).find((m) => m.template === 'password_reset')!;
    const token = linkIn(reset, '/reset-password');

    const newPassword = `Yeni_${Date.now().toString(36)}!`;
    await page.goto(`${root}/reset-password?token=${token}`);
    await page.getByLabel('Yeni şifre', { exact: true }).fill(newPassword);
    await page.getByLabel('Şifre tekrar', { exact: true }).fill(newPassword);
    await page.getByLabel('Şifre tekrar', { exact: true }).press('Enter');
    await expect(page.getByRole('heading', { name: 'Şifren hazır.' })).toBeVisible({ timeout: 15_000 });

    const login = await request.post(`${apiRoot}/api/auth/login`, { data: { email, password: newPassword } });
    expect(login.ok(), await login.text()).toBeTruthy();
    const old = await request.post(`${apiRoot}/api/auth/login`, {
      data: { email, password: session.credentials.password },
    });
    expect(old.ok()).toBeFalsy();
  });
});
