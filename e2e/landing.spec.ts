import { test, expect } from '@playwright/test';
import { DEFAULT_E2E_APP_BASE_URL } from './helpers/session';

test.describe('Public Landing Pages', () => {
  test('@smoke renders the home hero with CTA actions', async ({ page, baseURL }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    await page.goto(root);

    await expect(page.locator('[aria-label="Ana bölüm"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Kayıt ol ve oyuna başla' }).first()).toBeVisible();
    await expect(page.locator('[data-testid="hero-login-button"]').first()).toBeVisible();
  });

  test('@smoke renders the cafe-owner landing at /kafeler', async ({ page, baseURL }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    await page.goto(`${root}/kafeler`);

    await expect(page.locator('[aria-label="Kafe sahipleri için ana bölüm"]').first()).toBeVisible();
    await expect(page.locator('[aria-label="Pilot programı özet kartı"]').first()).toBeVisible();
    await expect(page.locator('[aria-label="Anahtar sayılar"]').first()).toBeVisible();
    await expect(page.locator('[aria-label="Fiyatlandırma"]').first()).toBeVisible();

    // Pilot CTA: WhatsApp deep-link + mailto yedekleri
    const whatsapp = page.locator('a[href*="wa.me"]').first();
    await expect(whatsapp).toBeVisible();
  });

  test('@smoke shows footer social links and version pill', async ({ page, baseURL }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    await page.goto(root);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const versionPill = page.locator('[data-testid="footer-version-pill"]').first();
    await expect(versionPill).toBeVisible();
    const version = await page.locator('meta[name="cafeduo:app-version"]').getAttribute('content');
    expect(version).toBeTruthy();
    const shortVersion = /^[a-f0-9]{8,}$/i.test(version!) ? version!.slice(0, 7) : version!.slice(0, 12);
    await expect(versionPill).toContainText(shortVersion);
    await expect(page.getByRole('link', { name: 'Instagram' }).first()).toHaveAttribute(
      'href',
      /instagram\.com/
    );
    await expect(page.getByRole('link', { name: 'Twitter' }).first()).toHaveAttribute('href', /x\.com/);
  });
});
