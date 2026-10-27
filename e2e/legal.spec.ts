import { test, expect } from '@playwright/test';
import { provisionUser, resolveApiBaseUrl, DEFAULT_E2E_APP_BASE_URL } from './helpers/session';

const documents = [
  { path: '/kosullar', title: 'Kullanım Koşulları' },
  { path: '/iade', title: 'İade ve İptal Politikası' },
  { path: '/gizlilik', title: 'Gizlilik Politikası ve KVKK Aydınlatma Metni' },
  { path: '/cerezler', title: 'Çerez Politikası' },
];

test.describe('Legal pages and explicit agreement', () => {
  test('@smoke an existing user can read and explicitly accept the non-blocking update', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.addInitScript(() => localStorage.setItem('cafeduo_cookie_notice', '2026-10-27'));
    await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 7654321, username: 'legacy', points: 100, wins: 0, gamesPlayed: 0, termsVersion: null } }));
    let agreements = 0;
    await page.route('**/api/auth/accept-terms', route => {
      agreements += 1;
      expect(route.request().postDataJSON()).toEqual({ acceptTerms: true, termsVersion: '2026-10-27' });
      return route.fulfill({ json: { termsVersion: '2026-10-27', termsAcceptedAt: '2026-10-27T12:00:00.000Z' } });
    });
    await page.goto('/dashboard');
    const banner = page.getByRole('region', { name: 'Güncellenen kullanım koşulları' });
    await expect(banner).toBeVisible();
    const heading = await banner.getByRole('heading').boundingBox();
    expect(heading!.y).toBeGreaterThanOrEqual(100);
    await expect(page.getByRole('heading', { name: 'Kafeye Giriş' })).toBeVisible();
    expect(agreements).toBe(0);
    await banner.getByRole('button', { name: 'Okudum, kabul ediyorum' }).click();
    await expect(banner).not.toBeVisible();
    expect(agreements).toBe(1);
  });

  test('@smoke the cookie notice never covers authentication controls on a first tablet visit', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/?auth=login');
    await expect(page.getByRole('region', { name: 'Çerez bildirimi' })).toBeVisible();
    await page.getByRole('button', { name: 'Kapat', exact: true }).click({ timeout: 10000 });
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('button', { name: 'Bildirimi kapat' }).click();
    await expect(page.getByRole('region', { name: 'Çerez bildirimi' })).not.toBeVisible();
  });

  for (const entry of documents) {
    test(`@smoke ${entry.path} is reachable from the footer and readable at 320px`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 700 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.addInitScript(() => localStorage.setItem('cafeduo_cookie_notice', '2026-10-27'));
      await page.goto('/');
      await page.getByRole('contentinfo').locator(`a[href="${entry.path}"]`).click();
      await expect(page.getByRole('heading', { level: 1, name: entry.title, exact: true })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Bu metinde', exact: true })).toBeVisible();
      await page.getByRole('link', { name: 'Ana sayfaya dön', exact: true }).click({ trial: true });
      await expect(page.locator('article address')).toContainText('Emin Emre');
      await expect(page.locator('article address')).toContainText('Gaziler Caddesi No:40');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }

  test('@smoke registration requires agreement without treating KVKK as consent', async ({ page }) => {
    await page.goto('/?auth=register');
    await page.getByPlaceholder('Kullanıcı adı').fill(`legal_${Date.now()}`.slice(0, 20));
    await page.getByTestId('auth-email-input').fill(`legal_${Date.now()}@example.com`);
    await page.getByTestId('auth-password-input').fill('StrongPass123');
    let submissions = 0;
    page.on('request', (request) => { if (request.url().endsWith('/api/auth/register')) submissions += 1; });
    await page.getByTestId('auth-submit-button').click();
    await expect(page.getByRole('dialog')).toContainText('Kayıt için kullanım koşullarını okuyup kabul etmelisin.');
    expect(submissions).toBe(0);
    await expect(page.getByRole('checkbox')).not.toBeChecked();
    await expect(page.getByRole('link', { name: 'KVKK aydınlatma metni' })).toHaveAttribute('target', '_blank');
  });

  test('@smoke rejects forged or stale terms receipts and protects acceptance with CSRF', async ({ request, baseURL }) => {
    const root = resolveApiBaseUrl(baseURL || DEFAULT_E2E_APP_BASE_URL);
    const data = { username: `terms_${Date.now()}`.slice(0, 20), email: `terms_${Date.now()}@example.com`, password: 'StrongPass123' };
    const missing = await request.post(`${root}/api/auth/register`, { data });
    expect(missing.status()).toBe(400);
    expect((await missing.json()).code).toBe('TERMS_REQUIRED');
    const stale = await request.post(`${root}/api/auth/register`, { data: { ...data, acceptTerms: true, termsVersion: '2025-01-01' } });
    expect(stale.status()).toBe(409);
    expect((await stale.json()).code).toBe('TERMS_VERSION_CHANGED');

    const session = await provisionUser(request, baseURL || DEFAULT_E2E_APP_BASE_URL, 'terms_api');
    const body = { acceptTerms: true, termsVersion: '2026-10-27', userId: 999, termsAcceptedAt: '2000-01-01' };
    const rejected = await request.post(`${root}/api/auth/accept-terms`, { data: body });
    expect(rejected.status()).toBe(403);
    const headers = { Authorization: `Bearer ${session.token}`, 'X-CSRF-Token': session.csrfToken };
    const result = await request.post(`${root}/api/auth/accept-terms`, { headers, data: body });
    expect(result.ok()).toBe(true);
    const receipt = await result.json();
    expect(receipt.termsVersion).toBe('2026-10-27');
    expect(Date.parse(receipt.termsAcceptedAt)).toBeGreaterThan(Date.now() - 60000);
    const retry = await request.post(`${root}/api/auth/accept-terms`, { headers, data: body });
    expect(await retry.json()).toEqual(receipt);
  });
});
