import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { DEFAULT_E2E_APP_BASE_URL, provisionUser } from './helpers/session';

// The permission prompt is left unanswered. Code verification must never touch
// either browser API or wait for a geolocation callback.
const openCheckIn = async (page: Page, request: APIRequestContext, root: string) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const session = await provisionUser(request, root, 'code');
  const hostname = new URL(root).hostname;
  await page.context().addCookies([
    { name: 'auth_token', value: session.token, httpOnly: true, domain: hostname,
      path: '/', sameSite: 'Lax', secure: root.startsWith('https://') },
    { name: 'csrf_token', value: session.csrfToken, httpOnly: false, domain: hostname,
      path: '/', sameSite: 'Lax', secure: root.startsWith('https://') },
  ]);
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', 'true');
    let calls = 0;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: () => { calls += 1; } },
    });
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: () => { calls += 1; return new Promise(() => {}); } },
    });
    Object.defineProperty(window, 'checkinLocationCalls', { get: () => calls });
  });
  await page.goto(`${root}/dashboard`);
  await expect(page.getByRole('heading', { name: 'Kafeye Giriş' })).toBeVisible();
  await page.getByLabel('Kafe Seçimi').selectOption('1');
  await page.getByLabel('Masa Numarası').fill('7');
  const reveal = page.getByTestId('checkin-show-verification');
  await reveal.focus();
  await page.keyboard.press('Enter');
  const code = page.getByLabel('Masa Doğrulama Kodu');
  await expect(code).toBeFocused();
  return code;
};

test.describe('Table code check-in', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const width of [320, 390, 768, 1440]) {
    test(`@smoke code check-in works without location permission at ${width}px`, async ({ page, request, baseURL, browserName }) => {
      await page.setViewportSize({ width, height: 900 });
      const code = await openCheckIn(page, request, baseURL || DEFAULT_E2E_APP_BASE_URL);
      await code.fill(' 1234-MASA07 ');
      await expect(page.getByRole('status')).toHaveText('Masa koduyla doğrulanacak');
      await expect(page.getByTestId('checkin-submit-button')).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const header = page.getByRole('heading', { name: 'Kafeye Giriş' }).locator('..');
      const card = page.getByTestId('cafe-selection-card').locator('..');
      expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
      // Reduced motion should keep Framer Motion's entry transforms disabled.
      for (const surface of [header, card]) {
        expect(await surface.evaluate(el => getComputedStyle(el).transform)).toBe('none');
      }
      await page.screenshot({ path: `../../outputs/checkin-${width}-${browserName}.png`, fullPage: true });
      const sent = page.waitForRequest(req => req.url().endsWith('/cafes/1/check-in') && req.method() === 'POST');
      await code.press('Enter');
      expect((await sent).postDataJSON()).toEqual({ cafeId: '1', tableNumber: 7, tableVerificationCode: '1234-MASA07' });
      await expect(page.getByTestId('dashboard-tab-games')).toBeVisible({ timeout: 10000 });
      expect(await page.evaluate(() => Reflect.get(window, 'checkinLocationCalls'))).toBe(0);
    });
  }

  test('@smoke server rejects an invalid table code and accepts a corrected code', async ({ page, request, baseURL }) => {
    const code = await openCheckIn(page, request, baseURL || DEFAULT_E2E_APP_BASE_URL);
    await code.fill('wrong-code');
    await code.press('Enter');
    await expect(page.getByRole('alert')).toContainText(/geçersiz|geçerli masa doğrulama kodu/i);
    await expect(page.getByTestId('dashboard-tab-games')).toHaveCount(0);
    await expect(code).toHaveValue('wrong-code');
    await expect(code).toBeEnabled();
    await code.fill('1234-MASA07');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await code.press('Enter');
    await expect(page.getByTestId('dashboard-tab-games')).toBeVisible({ timeout: 10000 });
    expect(await page.evaluate(() => Reflect.get(window, 'checkinLocationCalls'))).toBe(0);
  });
});
