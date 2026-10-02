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
