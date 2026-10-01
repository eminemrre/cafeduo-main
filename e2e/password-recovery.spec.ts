import { expect, test } from '@playwright/test';

const recoveryUrl = `/reset-password?token=${'a'.repeat(64)}`;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cookie_consent', 'true'));
});

for (const viewport of [
  { width: 320, height: 720 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]) {
  test(`@smoke password recovery is readable and operable at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto(recoveryUrl);
    const heading = page.getByRole('heading', { name: 'Yeni şifreni belirle.' });
    await expect(heading).toBeVisible();
    await expect(page.getByLabel('Yeni şifre', { exact: true })).toBeVisible();
    const geometry = await page.evaluate(() => {
      const card = document.querySelector('.duo-recovery-card')!;
      const nav = document.querySelector('nav')!;
      const heading = card.querySelector('h1')!;
      const input = card.querySelector('input')!;
      return {
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        cardTop: card.getBoundingClientRect().top,
        navBottom: nav.getBoundingClientRect().bottom,
        headingColor: getComputedStyle(heading).color,
        inputSize: parseFloat(getComputedStyle(input).fontSize),
        inputHeight: input.getBoundingClientRect().height,
      };
    });
    expect(geometry.overflow).toBe(false);
    expect(geometry.cardTop).toBeGreaterThan(geometry.navBottom);
    expect(geometry.headingColor).toBe('rgb(20, 20, 19)');
    expect(geometry.inputSize).toBeGreaterThanOrEqual(16);
    expect(geometry.inputHeight).toBeGreaterThanOrEqual(48);
    await page.getByLabel('Yeni şifre', { exact: true }).fill('new-pass-123');
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Şifre tekrar')).toBeFocused();
    await page.getByLabel('Şifre tekrar').fill('different');
    await page.getByRole('button', { name: 'Şifreyi güncelle' }).click();
    await expect(page.getByLabel('Şifre tekrar')).toBeFocused();
    await expect(page.getByLabel('Şifre tekrar')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Şifreler eşleşmiyor.')).toBeVisible();
    await page.getByLabel('Şifre tekrar').fill('new-pass-123');
    await page.getByRole('button', { name: 'Şifreleri göster' }).click();
    await expect(page.getByLabel('Yeni şifre', { exact: true })).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Şifreleri gizle' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
}

test('@smoke incomplete recovery link provides a working route back to login', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/reset-password');
  await expect(page.getByRole('heading', { name: 'Bağlantıyı kontrol edelim.' })).toBeVisible();
  await expect(page.getByLabel('Yeni şifre', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Giriş ekranına git' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Şifremi unuttum' }).click();
  await expect(page.getByRole('button', { name: /sıfırlama bağlantısı gönder/i })).toBeVisible();
});

test('@smoke password reset success is announced and opens login directly', async ({ page }) => {
  let requestCount = 0;
  let finishRequest!: () => void;
  const pending = new Promise<void>((resolve) => {
    finishRequest = resolve;
  });
  await page.route('**/api/auth/reset-password', async (route) => {
    requestCount += 1;
    expect(route.request().postDataJSON()).toEqual({
      token: 'a'.repeat(64),
      password: 'new-pass-123',
    });
    await pending;
    await route.fulfill({ json: { success: true, message: 'Şifren güncellendi.' } });
  });
  await page.goto(recoveryUrl);
  await page.getByLabel('Yeni şifre', { exact: true }).fill('new-pass-123');
  await page.getByLabel('Şifre tekrar').fill('new-pass-123');
  await page.getByRole('button', { name: 'Şifreyi güncelle' }).click();
  await expect(page.getByRole('button', { name: 'Şifre kaydediliyor…' })).toBeDisabled();
  await expect(page.getByLabel('Yeni şifre', { exact: true })).toBeDisabled();
  await expect(page.locator('form')).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('status')).toContainText('Lütfen bekle.');
  finishRequest();
  await expect(page.getByRole('heading', { name: 'Şifren hazır.' })).toBeFocused();
  await expect(page.getByRole('status')).toHaveText('Şifren güncellendi.');
  await expect(page.locator('.duo-recovery form')).toHaveCount(0);
  expect(requestCount).toBe(1);
  await page.getByRole('link', { name: 'Giriş yap', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('[data-testid="auth-email-input"]')).toBeVisible();
});

test('@smoke expired recovery link surfaces the backend error and offers a new link', async ({
  page,
}) => {
  await page.goto(recoveryUrl);
  await page.getByLabel('Yeni şifre', { exact: true }).fill('new-pass-123');
  await page.getByLabel('Şifre tekrar').fill('new-pass-123');
  await page.getByRole('button', { name: 'Şifreyi güncelle' }).click();
  await expect(page.getByRole('alert')).toContainText(/geçersiz|süresi dolmuş/i);
  await expect(page.getByRole('button', { name: 'Şifreyi güncelle' })).toBeEnabled();
  await expect(page.getByLabel('Yeni şifre', { exact: true })).toHaveValue('new-pass-123');
  await page.getByRole('link', { name: /giriş ekranındaki/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('@smoke recovery controls respect reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(recoveryUrl);
  const button = page.getByRole('button', { name: 'Şifreyi güncelle' });
  await button.hover();
  const motion = await button.evaluate((el) => ({
    transform: getComputedStyle(el).transform,
    duration: Math.max(...getComputedStyle(el).transitionDuration.split(',').map(parseFloat)),
  }));
  expect(motion.transform).toBe('none');
  expect(motion.duration).toBeLessThanOrEqual(0.001);
});
