import { test, expect } from '@playwright/test';
import { DEFAULT_E2E_APP_BASE_URL } from './helpers/session';

test.describe('Public Landing Pages', () => {
  test('@smoke loads the self-hosted brand fonts with Turkish characters', async ({ page, baseURL }) => {
    await page.goto(baseURL || DEFAULT_E2E_APP_BASE_URL);
    const fonts = await page.evaluate(async () => {
      const fonts = [
        { family: 'Baloo 2', style: 'normal', weight: '800' },
        { family: 'Onest', style: 'normal', weight: '400' },
        { family: 'Onest', style: 'normal', weight: '500' },
        { family: 'Onest', style: 'normal', weight: '600' },
        { family: 'Onest', style: 'normal', weight: '700' },
      ];
      return Promise.all(fonts.map(async ({ family, style, weight }) => {
        const faces = await document.fonts.load(
          `${style} ${weight} 16px "${family}"`,
          'CafeDuo ıİşŞğĞçÇöÖüÜ'
        );
        return {
          family,
          style,
          loaded: faces.length > 0 && faces.every((face) => face.status === 'loaded' && face.style === style),
        };
      }));
    });
    expect(fonts).toEqual([
      { family: 'Baloo 2', style: 'normal', loaded: true },
      { family: 'Onest', style: 'normal', loaded: true },
      { family: 'Onest', style: 'normal', loaded: true },
      { family: 'Onest', style: 'normal', loaded: true },
      { family: 'Onest', style: 'normal', loaded: true },
    ]);
  });

  test('@smoke plays the knight move on the toy table without logging in', async ({ page, baseURL }) => {
    await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
    await page.goto(baseURL || DEFAULT_E2E_APP_BASE_URL);
    const play = page.getByRole('button', { name: 'Ata dokun, ilk hamleni yap' });
    await play.click();
    await expect(page.getByRole('button', { name: 'Atı geri çek' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(
      page.getByText('Güzel açılış. Gerçek maçta kazandığın puan o kafenin ödüllerine gider.')
    ).toBeVisible();
    await page.getByRole('button', { name: 'Atı geri çek' }).click();
    await expect(page.getByRole('button', { name: 'Ata dokun, ilk hamleni yap' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    await expect(page.getByRole('banner').getByRole('button', { name: 'Kaydol' })).toBeVisible();
  });

  test('@smoke renders the table-tent hero and opens the login modal', async ({ page, baseURL }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    await page.goto(root);

    await expect(page.getByRole('heading', { level: 1, name: 'Rakibin yan masada.' })).toBeVisible();
    await expect(page.getByRole('banner').getByRole('button', { name: 'Kaydol' })).toBeVisible();
    await expect(page.locator('[data-testid="hero-login-button"]').first()).toBeVisible();
    await page.locator('[data-testid="hero-login-button"]').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('@smoke carries the e-mail typed in the closing sentence into the sign-up modal', async ({
    page,
    baseURL,
  }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    await page.addInitScript(() => localStorage.setItem('cookie_consent', 'accepted'));
    await page.goto(root);

    const close = page.locator('#katil');
    await close.scrollIntoViewIfNeeded();
    await page.getByLabel('İlk 100 puanın için').fill('emin@example.com');
    await close.getByRole('button', { name: 'Kaydol' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-testid="auth-email-input"]')).toHaveValue('emin@example.com');
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

  test('@smoke opens the privacy policy from the cafe FAQ using the keyboard on mobile', async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${baseURL || DEFAULT_E2E_APP_BASE_URL}/kafeler`);
    // The answers are reading text: the question is the run-in, the link sits in its answer.
    const faq = page.getByRole('region', { name: 'Sıkça sorulan sorular' });
    await expect(faq.getByText('Müşteri verileri nasıl korunur?')).toBeVisible();
    const privacy = faq.getByRole('link', { name: 'Gizlilik Politikası' });
    await expect(privacy).toHaveAttribute('href', '/gizlilik');
    await privacy.scrollIntoViewIfNeeded();
    await privacy.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/gizlilik$/);
    await expect(page.getByRole('heading', { level: 1, name: /Gizlilik Politikası ve KVKK Aydınlatma Metni/i })).toBeVisible();
  });

  test('@smoke shows footer social links and keeps build diagnostics in metadata', async ({ page, baseURL }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    await page.goto(root);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByTestId('footer-version-pill')).toHaveCount(0);
    const version = await page.locator('meta[name="cafeduo:app-version"]').getAttribute('content');
    expect(version).toBeTruthy();

    const footer = page.getByRole('contentinfo');
    await expect(footer.getByRole('img', { name: 'CafeDuo' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Instagram' }).first()).toHaveAttribute(
      'href',
      /instagram\.com/
    );
    await expect(page.getByRole('link', { name: 'Twitter' }).first()).toHaveAttribute('href', /x\.com/);
  });
});
