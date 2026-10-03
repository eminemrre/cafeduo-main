import { test, expect } from '@playwright/test';
import { DEFAULT_E2E_APP_BASE_URL } from './helpers/session';

test.describe('Public Landing Pages', () => {
  test('@smoke loads the self-hosted brand fonts with Turkish characters', async ({ page, baseURL }) => {
    await page.goto(baseURL || DEFAULT_E2E_APP_BASE_URL);
    const fonts = await page.evaluate(async () => {
      const fonts = [
        { family: 'Familjen Grotesk', style: 'normal' },
        { family: 'Unbounded Variable', style: 'normal' },
        { family: 'JetBrains Mono Variable', style: 'normal' },
        { family: 'Fraunces Variable', style: 'normal' },
        { family: 'Fraunces Variable', style: 'italic' },
      ];
      return Promise.all(fonts.map(async ({ family, style }) => {
        const faces = await document.fonts.load(`${style} 400 16px "${family}"`, 'CafeDuo ıİşŞğĞçÇöÖüÜ');
        return { family, style, loaded: faces.length > 0 && faces.every((face) => face.status === 'loaded' && face.style === style) };
      }));
    });
    expect(fonts).toEqual([
      { family: 'Familjen Grotesk', style: 'normal', loaded: true },
      { family: 'Unbounded Variable', style: 'normal', loaded: true },
      { family: 'JetBrains Mono Variable', style: 'normal', loaded: true },
      { family: 'Fraunces Variable', style: 'normal', loaded: true },
      { family: 'Fraunces Variable', style: 'italic', loaded: true },
    ]);
  });

  test('@smoke plays a legal move on the public demo board without logging in', async ({ page, baseURL }) => {
    await page.goto(baseURL || DEFAULT_E2E_APP_BASE_URL);
    await page.getByTestId('preview-square-g1').click();
    await expect(page.getByTestId('preview-square-g1')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('preview-square-g1')).toBeFocused();
    await page.getByTestId('preview-square-f3').click();
    await expect(page.getByTestId('preview-square-f3')).toHaveAttribute('aria-label', 'f3, beyaz at');
    await expect(page.getByLabel('Oynanan hamleler')).toContainText('2. Nf3 d6');
    await page.getByRole('button', { name: 'Baştan', exact: true }).click();
    await expect(page.getByTestId('preview-square-g1')).toHaveAttribute('aria-label', 'g1, beyaz at');
    await expect(page.getByRole('button', { name: 'Kayıt ol ve oyuna başla' })).toBeVisible();
  });

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

  test('@smoke shows footer social links and keeps build diagnostics in metadata', async ({ page, baseURL }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    await page.goto(root);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByTestId('footer-version-pill')).toHaveCount(0);
    const version = await page.locator('meta[name="cafeduo:app-version"]').getAttribute('content');
    expect(version).toBeTruthy();

    await expect(page.getByRole('link', { name: 'Instagram' }).first()).toHaveAttribute(
      'href',
      /instagram\.com/
    );
    await expect(page.getByRole('link', { name: 'Twitter' }).first()).toHaveAttribute('href', /x\.com/);
  });
});
