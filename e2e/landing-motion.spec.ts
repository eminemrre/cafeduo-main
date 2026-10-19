import { test, expect } from '@playwright/test';
import {
  provisionUser,
  checkInUser,
  fetchCurrentUser,
  bootstrapAuthenticatedPage,
  DEFAULT_E2E_APP_BASE_URL,
} from './helpers/session';

for (const viewport of [
  { width: 320, height: 568 },
  { width: 568, height: 320 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]) {
  test(`@smoke landing stays readable and playable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => localStorage.setItem('cookie_consent', 'true'));
    await page.goto('/');
    const root = page.locator('.cdl-page');
    const header = page.getByRole('banner');
    await expect(root).toHaveAttribute('data-motion', 'on');

    // The live thing works from the keyboard: the knight plays its move and comes back.
    const play = page.getByRole('button', { name: 'Ata dokun, ilk hamleni yap' });
    await play.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Atı geri çek' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Atı geri çek' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Ata dokun, ilk hamleni yap' })).toHaveAttribute('aria-pressed', 'false');

    // "Kaydol" and "Giriş yap" stay in reach in every section, and the sections reveal as they enter.
    for (const section of ['#oyunlar', '#oduller', '#nasil', '#katil']) {
      await page.locator(section).scrollIntoViewIfNeeded();
      await expect(header.getByRole('button', { name: 'Kaydol' })).toBeInViewport();
      await expect(header.getByRole('button', { name: 'Giriş yap' })).toBeInViewport();
    }
    for (const title of ['Bir kahvelik oyun', 'Nasıl işler', 'Menü']) {
      await expect(page.getByRole('heading', { level: 2, name: title })).toBeAttached();
    }
    // On short screens the menu section is taller than the viewport, so centring the section
    // skips its masthead; bring the masthead itself into view, as a reader scrolling past would.
    const masthead = page.locator('#oduller .cdl-menu-masthead');
    await masthead.scrollIntoViewIfNeeded();
    await expect(masthead).toHaveAttribute('data-landing-revealed', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);

    // The closing sentence hands the e-mail to the sign-up modal.
    await page.locator('#katil').scrollIntoViewIfNeeded();
    await page.getByLabel('İlk 100 puanın için').fill('masa07@example.com');
    await page.locator('#katil').getByRole('button', { name: 'Kaydol' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-testid="auth-email-input"]')).toHaveValue('masa07@example.com');
    await page.getByRole('button', { name: 'Kapat', exact: true }).click();

    // With reduced motion the landing stops animating altogether; the content stays.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(root).toHaveAttribute('data-motion', 'off');
    const running = await root.evaluate((el) =>
      el
        .getAnimations({ subtree: true })
        .filter((animation) => (animation as CSSAnimation).animationName?.startsWith('cdl-')).length
    );
    expect(running).toBe(0);
    await expect(page.getByRole('heading', { level: 1, name: 'Rakibin yan masada.' })).toBeVisible();
  });
}

test('@smoke cafe landing follows the system motion setting and hands the café name to WhatsApp', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => localStorage.setItem('cookie_consent', 'true'));
  await page.context().route('https://wa.me/**', (route) => route.abort());
  await page.goto('/kafeler');
  const root = page.locator('.cdl-page');
  await expect(root).toHaveAttribute('data-motion', 'on');
  // No motion toggle anywhere: the system preference decides.
  await expect(page.getByRole('button', { name: /Hareket/ })).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(root).toHaveAttribute('data-motion', 'off');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(root).toHaveAttribute('data-motion', 'on');

  // The closing sentence: the blank is the café's name, and it goes into the WhatsApp message.
  const close = page.getByRole('region', { name: 'Son çağrı' });
  await close.scrollIntoViewIfNeeded();
  await close.getByLabel('Pilot için').fill('Masa Kafe');
  const apply = close.getByRole('link', { name: 'başvurun' });
  await expect(apply).toHaveAttribute('href', /wa\.me/);
  expect(decodeURIComponent(await apply.getAttribute('href'))).toContain(
    'Masa Kafe için CafeDuo pilot programına'
  );
});

test('@smoke landing content and join action work without scroll enhancement, storage or WebGL', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'IntersectionObserver', { value: undefined });
    Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('Storage unavailable'); } });
    HTMLCanvasElement.prototype.getContext = () => null;
    localStorage.setItem('cookie_consent', 'true');
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.cdl-stage')).toHaveAttribute('data-live', 'false');
  await expect(page.locator('.cdl-stage-still img')).toBeVisible();
  await page.getByRole('button', { name: 'Ata dokun, ilk hamleni yap' }).click();
  await expect(page.getByRole('button', { name: 'Atı geri çek' })).toHaveAttribute('aria-pressed', 'true');
  for (const game of ['Retro Satranç', 'Bilgi Yarışı', 'Nişancı Düellosu']) {
    await expect(page.getByRole('heading', { level: 3, name: game })).toBeAttached();
  }
  await page.locator('#katil').scrollIntoViewIfNeeded();
  await page.locator('#katil').getByRole('button', { name: 'Kaydol' }).click();
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
