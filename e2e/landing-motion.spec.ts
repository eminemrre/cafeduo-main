import { test, expect } from '@playwright/test';
import { provisionUser, checkInUser, fetchCurrentUser, bootstrapAuthenticatedPage, DEFAULT_E2E_APP_BASE_URL } from './helpers/session';

for (const viewport of [{ width: 320, height: 568 }, { width: 568, height: 320 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  test(`@smoke landing stays controllable, readable and playable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => localStorage.setItem('cookie_consent', 'true'));
    await page.goto('/');
    const root = page.locator('.club-landing');
    const header = page.getByRole('banner');
    await expect(root).toHaveAttribute('data-motion', 'on');

    // The live thing: a keyboard move against MASA07 brings a district into focus.
    await page.getByTestId('preview-square-g1').focus(); await page.keyboard.press('Enter');
    await expect(page.getByTestId('preview-square-g1')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Enter');
    await expect(page.getByTestId('preview-square-f3')).toHaveAttribute('aria-label', 'f3, beyaz at');
    await expect(page.getByTestId('preview-square-f3')).toBeFocused();
    await expect(page.getByLabel('Oynanan hamleler')).toContainText('2. Nf3 d6');
    await expect(page.locator('.cdl-stage')).toHaveAttribute('data-revealed', 'true');
    await page.getByRole('button', { name: 'Baştan' }).click();
    await expect(page.locator('.cdl-stage')).toHaveAttribute('data-revealed', 'false');

    // "Masaya katıl" and "Giriş yap" stay in reach in every section.
    for (const section of ['#nasil', '#oyunlar', '#semtler', '#katil']) {
      await page.locator(section).scrollIntoViewIfNeeded();
      await expect(page.locator(section).getByRole('heading', { level: 2 })).toBeAttached();
      await expect(header.getByRole('button', { name: 'Masaya katıl' })).toBeInViewport();
      await expect(header.getByRole('button', { name: 'Giriş yap' })).toBeInViewport();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);

    // Motion can be paused from the footer line; nothing keeps running afterwards.
    const pause = page.getByRole('button', { name: 'Hareketi durdur' });
    await pause.scrollIntoViewIfNeeded();
    await pause.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Hareketi aç' })).toBeFocused();
    await expect(root).toHaveAttribute('data-motion', 'off');
    expect(await root.evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length)).toBe(0);
    await page.getByRole('button', { name: 'Hareketi aç' }).click();
    await expect(root).toHaveAttribute('data-motion', 'on');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.getByRole('button', { name: 'Hareket azaltıldı' })).toBeDisabled();
    await expect(root).toHaveAttribute('data-motion', 'off');
    // With reduced motion the district picture is simply sharp.
    expect(await page.locator('.cdl-stage-photo img').evaluate(img => getComputedStyle(img).filter)).toBe('none');

    await page.locator('#katil').getByRole('button', { name: 'Masaya katıl' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
}

test('@smoke manual motion choice persists across reload and system preference takes priority', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => localStorage.setItem('cookie_consent', 'true'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Hareketi durdur' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Hareketi aç' })).toHaveAttribute('aria-pressed', 'false');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('button', { name: 'Hareket azaltıldı' })).toBeDisabled();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.getByRole('button', { name: 'Hareketi aç' })).toBeEnabled();
});

test('@smoke landing content and join action work without scroll enhancement or storage access', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'IntersectionObserver', { value: undefined });
    Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('Storage unavailable'); } });
    localStorage.setItem('cookie_consent', 'true');
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  for (const statement of ['Önce kafede check-in yap.', 'Sonra açık bir masayla eşleş.', 'Kazandığını kafede harca.']) {
    await expect(page.getByRole('heading', { level: 3, name: statement })).toBeAttached();
  }
  await page.locator('#katil').scrollIntoViewIfNeeded();
  await page.locator('#katil').getByRole('button', { name: 'Masaya katıl' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('@smoke signed-in visitor goes from the landing header to the player panel', async ({ page, request, baseURL }) => {
  const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
  const session = await provisionUser(request, root, 'landing');
  await checkInUser(request, root, session.token, { tableNumber: 7, csrfToken: session.csrfToken });
  const user = await fetchCurrentUser(request, root, session.token);
  await bootstrapAuthenticatedPage(page, root, session, { checkedIn: true, userOverride: user, skipCheckInRecovery: true });
  await page.goto('/');
  await page.getByRole('banner').getByRole('button', { name: 'Panele geç' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('button', { name: 'Profilini aç' })).toBeVisible();
});
