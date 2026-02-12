import { test, expect } from '@playwright/test';
import {
  provisionUser,
  checkInUser,
  fetchCurrentUser,
  bootstrapAuthenticatedPage,
} from './helpers/session';

test.describe('Mobile UI Stability', () => {
  test('landing page keeps critical CTA interactive on mobile without horizontal overflow', async ({
    page,
    baseURL,
  }) => {
    const root = baseURL || 'http://localhost:3000';
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(root);

    // Çerez popup'ının CTA testini örtmemesi için state sabitle.
    await page.evaluate(() => localStorage.setItem('cookie_consent', 'true'));
    await page.reload();

    const loginButton = page.locator('[data-testid="hero-login-button"]');
    await expect(loginButton).toBeVisible();
    await loginButton.click();
    await expect(page.locator('[data-testid="auth-email-input"]')).toBeVisible();

    // Akış kartları mobilde kaybolmamalı: 3 adım da görünür olmalı.
    const flowHeading = page.getByRole('heading', { name: 'Sistemi 3 adımda devreye al.' });
    await flowHeading.scrollIntoViewIfNeeded();
    await expect(page.getByText('Hesabını aç').first()).toBeVisible();
    await expect(page.getByText('Masanı doğrula').first()).toBeVisible();
    await expect(page.getByText('Yarış ve kazan').first()).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(hasHorizontalOverflow).toBeFalsy();
  });

  test('dashboard remains operable on mobile after check-in', async ({ page, request, baseURL }) => {
    const root = baseURL || 'http://localhost:3000';
    const session = await provisionUser(request, root, 'mobile_dash');
    await checkInUser(request, root, session.token, { tableNumber: 4 });
    const user = await fetchCurrentUser(request, root, session.token);

    await page.setViewportSize({ width: 390, height: 844 });
    await bootstrapAuthenticatedPage(page, root, session, {
      checkedIn: true,
      userOverride: user,
    });

    await expect(page.locator('[data-testid="dashboard-tab-games"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-points"]')).toBeVisible();
    await expect(page.locator('[data-testid="create-game-button"]')).toBeEnabled();

    // Mobil menü etkileşimi: üst alanın overlay tarafından bloklanmadığını doğrula.
    const menuButton = page.getByRole('button', { name: /Menüyü aç|Menüyü kapat/i }).first();
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(page.getByText('MENÜ')).toBeVisible();
    await page.locator('[data-testid="mobile-menu-close-button"]').click();

    // Tab geçişleri mobilde çalışmalı.
    const leaderboardTab = page.locator('[data-testid="dashboard-tab-leaderboard"]');
    const gamesTab = page.locator('[data-testid="dashboard-tab-games"]');

    await leaderboardTab.click();
    await expect(leaderboardTab).toHaveClass(/rf-tab-active/);

    await gamesTab.click();
    await expect(gamesTab).toHaveClass(/rf-tab-active/);
    await expect(
      page.locator('[data-testid="game-lobby-container"], [data-testid="game-lobby-empty"]').first()
    ).toBeVisible({ timeout: 10000 });

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(hasHorizontalOverflow).toBeFalsy();
  });

  test('captures regression snapshots for 375x812 and 768x1024', async ({ page, baseURL }) => {
    const root = baseURL || 'http://localhost:3000';

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(root);
    await page.evaluate(() => localStorage.setItem('cookie_consent', 'true'));
    await page.reload();
    const mobileShot = await page.screenshot({ fullPage: true });
    expect(mobileShot.byteLength).toBeGreaterThan(10000);
    await test.info().attach('home-375x812', {
      body: mobileShot,
      contentType: 'image/png',
    });

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(root);
    const tabletShot = await page.screenshot({ fullPage: true });
    expect(tabletShot.byteLength).toBeGreaterThan(10000);
    await test.info().attach('home-768x1024', {
      body: tabletShot,
      contentType: 'image/png',
    });
  });
});
