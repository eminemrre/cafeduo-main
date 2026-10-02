import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { provisionUser, checkInUser, fetchCurrentUser, bootstrapAuthenticatedPage, DEFAULT_E2E_APP_BASE_URL } from './helpers/session';

async function openDashboard(page: Page, request: APIRequestContext, root: string) {
  const session = await provisionUser(request, root, 'avatar');
  await checkInUser(request, root, session.token, { tableNumber: 7, csrfToken: session.csrfToken });
  const user = await fetchCurrentUser(request, root, session.token);
  await bootstrapAuthenticatedPage(page, root, session, { checkedIn: true, userOverride: user, skipCheckInRecovery: true });
  await expect(page.getByRole('button', { name: 'Profilini aç' })).toBeVisible();
}

for (const viewport of [{ width: 320, height: 568 }, { width: 568, height: 320 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  test(`@smoke local avatars load and persist without DiceBear at ${viewport.width}x${viewport.height}`, async ({ page, request, baseURL }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const remoteRequests: string[] = [];
    await page.route('https://api.dicebear.com/**', route => { remoteRequests.push(route.request().url()); return route.abort(); });
    await openDashboard(page, request, baseURL || DEFAULT_E2E_APP_BASE_URL);
    await page.getByRole('button', { name: 'Profilini aç' }).click();
    const profile = page.getByRole('dialog', { name: /profili$/ });
    const opener = profile.getByRole('button', { name: 'Avatar seç' });
    await opener.click();
    const picker = page.getByRole('dialog', { name: 'Avatar seçimi' });
    await expect(picker.locator('[data-avatar-state="loaded"]')).toHaveCount(16);
    const images = picker.locator('img');
    expect(await images.evaluateAll(nodes => nodes.every(node => (node as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await expect(picker.getByTestId('avatar-option-kupon')).toHaveAttribute('aria-label', 'Avatar: kupon');
    const bounds = await picker.locator('.max-w-md').boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
    await picker.getByTestId('avatar-option-duo').focus();
    await page.keyboard.press('Enter');
    await expect(picker).toHaveCount(0);
    await expect(opener).toBeFocused();
    await expect(profile.locator('[data-avatar-state="loaded"] img')).toHaveAttribute('src', '/avatars/pixel-art-v9/duo.svg');
    await expect(profile.locator('[data-avatar-state="loaded"] span')).toHaveCount(0);
    await page.keyboard.press('Escape');
    const liveDashboardAvatar = page.getByRole('button', { name: 'Profilini aç' }).locator('[data-avatar-state="loaded"] img');
    await expect(liveDashboardAvatar).toHaveAttribute('src', '/avatars/pixel-art-v9/duo.svg');
    await page.getByRole('button', { name: 'Profilini aç' }).click();
    await expect(profile.locator('[data-avatar-state="loaded"] img')).toHaveAttribute('src', '/avatars/pixel-art-v9/duo.svg');
    await profile.getByRole('button', { name: 'Bölümü düzenle' }).click();
    await profile.getByRole('combobox', { name: 'Bölüm' }).selectOption('İşletme');
    await profile.getByRole('button', { name: 'Bölümü kaydet' }).click();
    await expect(profile.getByRole('combobox')).toHaveCount(0);
    await expect(profile.locator('[data-avatar-state="loaded"] img')).toHaveAttribute('src', '/avatars/pixel-art-v9/duo.svg');
    await page.keyboard.press('Escape');
    await expect(liveDashboardAvatar).toHaveAttribute('src', '/avatars/pixel-art-v9/duo.svg');
    await page.reload();
    const dashboardAvatar = page.getByRole('button', { name: 'Profilini aç' }).locator('[data-avatar-state="loaded"] img');
    await expect(dashboardAvatar).toHaveAttribute('src', '/avatars/pixel-art-v9/duo.svg');
    await page.getByRole('button', { name: 'Profilini aç' }).click();
    await page.getByRole('button', { name: 'Avatar seç' }).click();
    await expect(page.getByTestId('avatar-option-duo')).toHaveAttribute('aria-pressed', 'true');
    expect(remoteRequests).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  });
}

test('@smoke a failed avatar asset shows initials and another choice still loads', async ({ page, request, baseURL }) => {
  await page.route('**/avatars/pixel-art-v9/kahve.svg', route => route.abort());
  await openDashboard(page, request, baseURL || DEFAULT_E2E_APP_BASE_URL);
  await page.getByRole('button', { name: 'Profilini aç' }).click();
  await page.getByRole('button', { name: 'Avatar seç' }).click();
  const picker = page.getByRole('dialog', { name: 'Avatar seçimi' });
  await expect(picker.getByTestId('avatar-option-kahve').locator('[data-avatar-state="error"]')).toHaveText('KA');
  await picker.getByTestId('avatar-option-kahve').click();
  const profile = page.getByRole('dialog', { name: /profili$/ });
  await expect(profile.locator('[data-avatar-state="error"]')).not.toBeEmpty();
  await expect(profile.locator('[data-avatar-state="error"] img')).toHaveCount(0);
  await profile.getByRole('button', { name: 'Avatar seç' }).click();
  await picker.getByTestId('avatar-option-masa').click();
  await expect(profile.locator('[data-avatar-state="loaded"] img')).toHaveAttribute('src', '/avatars/pixel-art-v9/masa.svg');
  await expect(profile.locator('[data-avatar-state="error"]')).toHaveCount(0);
});


test('@smoke pending and failed avatar saves preserve the confirmed shared profile and cache', async ({ page, request, baseURL }) => {
  await openDashboard(page, request, baseURL || DEFAULT_E2E_APP_BASE_URL);
  const dashboardOpener = page.getByRole('button', { name: 'Profilini aç' });
  await dashboardOpener.click();
  const profile = page.getByRole('dialog', { name: /profili$/ });
  await profile.getByRole('button', { name: 'Avatar seç' }).click();
  const picker = page.getByRole('dialog', { name: 'Avatar seçimi' });
  await picker.getByTestId('avatar-option-kahve').click();
  await expect(picker).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dashboardOpener.locator('img')).toHaveAttribute('src', '/avatars/pixel-art-v9/kahve.svg');
  await dashboardOpener.click();
  await profile.getByRole('button', { name: 'Avatar seç' }).click();
  let release!: () => void;
  const held = new Promise<void>(done => { release = done; });
  let attempts = 0;
  await page.route('**/api/users/*', async route => {
    if (route.request().method() !== 'PUT') return route.continue();
    attempts++;
    if (attempts === 1) {
      await held;
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary failure' }) });
    }
    return route.continue();
  });
  await picker.getByTestId('avatar-option-duo').click();
  await expect(picker.getByRole('status')).toHaveText('Avatar kaydediliyor…');
  await expect(picker.getByTestId('avatar-option-duo')).toBeDisabled();
  await expect(picker.getByRole('button', { name: 'Kapat', exact: true })).toBeFocused();
  expect(await dashboardOpener.locator('img').getAttribute('src')).toBe('/avatars/pixel-art-v9/kahve.svg');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cafe_user')!).avatar_url)).toBe('https://api.dicebear.com/9.x/pixel-art/svg?seed=kahve');
  release();
  await expect(picker.getByRole('alert')).toContainText('Avatar kaydedilemedi');
  await expect(picker.getByTestId('avatar-option-kahve')).toHaveAttribute('aria-pressed', 'true');
  await picker.getByTestId('avatar-option-duo').click();
  await expect(picker).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dashboardOpener.locator('img')).toHaveAttribute('src', '/avatars/pixel-art-v9/duo.svg');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cafe_user')!).avatar_url)).toBe('https://api.dicebear.com/9.x/pixel-art/svg?seed=duo');
  expect(attempts).toBe(2);
});
