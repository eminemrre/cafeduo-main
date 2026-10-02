import { test, expect, type Page, type APIRequestContext, type Locator } from '@playwright/test';
import { provisionUser, checkInUser, fetchCurrentUser, bootstrapAuthenticatedPage, DEFAULT_E2E_APP_BASE_URL } from './helpers/session';

async function openDashboard(page: Page, request: APIRequestContext, root: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const session = await provisionUser(request, root, 'dialog');
  await checkInUser(request, root, session.token, { tableNumber: 7, csrfToken: session.csrfToken });
  const user = await fetchCurrentUser(request, root, session.token);
  await bootstrapAuthenticatedPage(page, root, session, { checkedIn: true, userOverride: user, skipCheckInRecovery: true });
  await expect(page.getByTestId('dashboard-tab-games')).toBeVisible();
}

async function checkFocusLoop(page: Page, dialog: Locator) {
  const controls = dialog.locator('button:enabled, input:enabled, select:enabled, textarea:enabled, a[href], [tabindex="0"]');
  const first = controls.first();
  const last = controls.last();
  await first.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(last).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(first).toBeFocused();
}

async function checkBounds(panel: Locator, width: number, height: number) {
  const bounds = await panel.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height + 1);
}

for (const viewport of [{ width: 320, height: 568 }, { width: 568, height: 320 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  test(`@smoke player dialogs keep focus and fit ${viewport.width}x${viewport.height}`, async ({ page, request, baseURL, browserName }) => {
    await page.setViewportSize(viewport);
    await openDashboard(page, request, baseURL || DEFAULT_E2E_APP_BASE_URL);
    const gameOpener = page.getByRole('button', { name: /Oyun Kur/i }).first();
    await gameOpener.click();
    const game = page.getByRole('dialog', { name: 'Yeni oyun kur' });
    await expect(game.getByRole('button', { name: 'Oyun kurma penceresini kapat' })).toBeFocused();
    await expect(game.getByRole('slider', { name: 'Katılım puanı' })).toBeVisible();
    await expect(game.getByTestId('game-type-aim')).toHaveAttribute('aria-pressed', 'true');
    await checkFocusLoop(page, game);
    await checkBounds(page.getByTestId('create-game-modal'), viewport.width, viewport.height);
    await page.keyboard.press('Escape');
    await expect(game).toHaveCount(0);
    await expect(gameOpener).toBeFocused();

    const profileOpener = page.getByRole('button', { name: 'Profilini aç' });
    await profileOpener.click();
    const profile = page.getByRole('dialog', { name: /profili$/ });
    const avatarOpener = profile.getByRole('button', { name: 'Avatar seç' });
    await expect(avatarOpener).toBeFocused();
    await checkBounds(profile.locator('.max-w-md'), viewport.width, viewport.height);
    await profile.getByRole('button', { name: 'Bölümü düzenle' }).focus();
    await page.keyboard.press('Enter');
    const department = profile.getByRole('combobox', { name: 'Bölüm' });
    await expect(department).toBeFocused();
    await department.selectOption('İşletme');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await checkFocusLoop(page, profile);

    await avatarOpener.click();
    const avatar = page.getByRole('dialog', { name: 'Avatar seçimi' });
    await expect(avatar.getByRole('button', { name: 'Kapat', exact: true })).toBeFocused();
    await checkFocusLoop(page, avatar);
    await checkBounds(avatar.locator('.max-w-md'), viewport.width, viewport.height);
    const lastAvatar = avatar.locator('[data-testid^="avatar-option-"]').last();
    await lastAvatar.scrollIntoViewIfNeeded();
    await expect(lastAvatar).toBeInViewport();
    await page.screenshot({ path: `../../outputs/dialog-avatar-${viewport.width}x${viewport.height}-${browserName}.png`, fullPage: true });
    // Native modal isolation blocks programmatic focus into the underlying profile.
    await profile.evaluate(el => el.querySelector<HTMLButtonElement>('[aria-label="Profili kapat"]')!.focus());
    expect(await avatar.evaluate(el => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(avatar).toHaveCount(0);
    await expect(profile).toBeVisible();
    await expect(avatarOpener).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    await page.keyboard.press('Escape');
    await expect(profile).toHaveCount(0);
    await expect(profileOpener).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  });
}

test('@smoke a failed game creation stays open with an inline error and can retry', async ({ page, request, baseURL }) => {
  await openDashboard(page, request, baseURL || DEFAULT_E2E_APP_BASE_URL);
  let attempts = 0;
  await page.route('**/api/games', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    attempts += 1;
    if (attempts === 1) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Oyun servisi meşgul. Tekrar dene.' }) });
    await route.continue();
  });
  await page.getByRole('button', { name: /Oyun Kur/i }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Yeni oyun kur' });
  await dialog.getByTestId('create-game-submit').click();
  await expect(dialog.getByRole('alert')).toHaveText('Oyun servisi meşgul. Tekrar dene.');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('create-game-submit')).toBeEnabled();
  await dialog.getByTestId('create-game-submit').click();
  await expect(dialog).toHaveCount(0);
  expect(attempts).toBe(2);
});

test('@smoke avatar save errors remain visible and restore focus after a successful retry', async ({ page, request, baseURL }) => {
  await openDashboard(page, request, baseURL || DEFAULT_E2E_APP_BASE_URL);
  let attempts = 0;
  await page.route('**/api/users/*', async route => {
    if (route.request().method() !== 'PUT') return route.continue();
    attempts += 1;
    if (attempts === 1) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary failure' }) });
    await route.continue();
  });
  await page.getByRole('button', { name: 'Profilini aç' }).click();
  const profile = page.getByRole('dialog', { name: /profili$/ });
  const opener = profile.getByRole('button', { name: 'Avatar seç' });
  await opener.click();
  const avatar = page.getByRole('dialog', { name: 'Avatar seçimi' });
  const option = avatar.locator('[data-testid^="avatar-option-"]').first();
  await option.click();
  await expect(avatar.getByRole('alert')).toContainText('Avatar kaydedilemedi');
  await expect(option).toBeEnabled();
  await option.click();
  await expect(avatar).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(profile).toBeVisible();
  expect(attempts).toBe(2);
});


test('@smoke department failures keep the edit and successful retry restores keyboard focus', async ({ page, request, baseURL }) => {
  await openDashboard(page, request, baseURL || DEFAULT_E2E_APP_BASE_URL);
  let attempts = 0;
  await page.route('**/api/users/*', async route => {
    if (route.request().method() !== 'PUT') return route.continue();
    attempts += 1;
    if (attempts === 1) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary failure' }) });
    await route.continue();
  });
  await page.getByRole('button', { name: 'Profilini aç' }).click();
  const profile = page.getByRole('dialog', { name: /profili$/ });
  await profile.getByRole('button', { name: 'Bölümü düzenle' }).click();
  const department = profile.getByRole('combobox', { name: 'Bölüm' });
  await department.selectOption('İşletme');
  await profile.getByRole('button', { name: 'Bölümü kaydet' }).click();
  await expect(profile.getByRole('alert')).toContainText('Bölüm güncellenemedi');
  await expect(department).toHaveValue('İşletme');
  await expect(department).toBeEnabled();
  await profile.getByRole('button', { name: 'Bölümü kaydet' }).click();
  await expect(department).toHaveCount(0);
  const trigger = profile.getByRole('button', { name: 'Bölümü düzenle' });
  await expect(trigger).toContainText('İşletme');
  await expect(trigger).toBeFocused();
  expect(attempts).toBe(2);
});
