import { test, expect } from '@playwright/test';
import {
  provisionUser,
  checkInUser,
  fetchCurrentUser,
  bootstrapAuthenticatedPage,
  resolveApiBaseUrl,
  waitForApiReady,
} from './helpers/session';

test.describe('Shop & Inventory Flow', () => {
  test('can switch between shop/inventory and purchase an affordable reward', async ({
    page,
    request,
    baseURL,
  }) => {
    const root = baseURL || 'http://localhost:3000';
    const apiRoot = resolveApiBaseUrl(root);
    await waitForApiReady(request, apiRoot);
    const session = await provisionUser(request, root, 'shop_user');

    await checkInUser(request, root, session.token, { tableNumber: 6 });
    let currentUser = await fetchCurrentUser(request, root, session.token);

    // Test için puanı yükseltip satın almayı deterministik hale getiriyoruz.
    const boostedPoints = 1500;
    const updateRes = await request.put(`${apiRoot}/api/users/${currentUser.id}`, {
      headers: {
        Authorization: `Bearer ${session.token}`,
        'Content-Type': 'application/json',
      },
      data: {
        id: currentUser.id,
        points: boostedPoints,
        wins: currentUser.wins || 0,
        gamesPlayed: currentUser.gamesPlayed || 0,
        department: currentUser.department || 'E2E',
      },
    });
    expect(updateRes.ok()).toBeTruthy();
    currentUser = await fetchCurrentUser(request, root, session.token);

    await bootstrapAuthenticatedPage(page, root, session, {
      checkedIn: true,
      userOverride: currentUser,
    });

    await expect(page.locator('[data-testid="shop-tab"]')).toBeVisible();
    await expect(page.locator('[data-testid="inventory-tab"]')).toBeVisible();

    await page.locator('[data-testid="inventory-tab"]').click();
    await expect(page.getByText(/Envanterin Boş|KOD|kupon/i).first()).toBeVisible();

    await page.locator('[data-testid="shop-tab"]').click();
    const pointsBeforeRaw = await page.locator('[data-testid="user-points"]').textContent();
    const pointsBefore = Number((pointsBeforeRaw || '').replace(/\D/g, '')) || 0;
    expect(pointsBefore).toBeGreaterThan(0);

    const affordableBuyButton = page.locator('[data-testid="shop-buy-button"]:not([disabled])').first();
    await expect(affordableBuyButton).toBeVisible();

    let purchaseSucceeded = false;
    let pointsAfter = pointsBefore;
    let lastDialogMessage = '';
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const dialogPromise = page.waitForEvent('dialog', { timeout: 3000 }).catch(() => null);
      await affordableBuyButton.click();

      const dialog = await dialogPromise;
      if (dialog) {
        lastDialogMessage = dialog.message();
        await dialog.accept();
      }

      const pointsAfterRaw = await page.locator('[data-testid="user-points"]').textContent();
      pointsAfter = Number((pointsAfterRaw || '').replace(/\D/g, '')) || 0;
      if (pointsAfter < pointsBefore) {
        purchaseSucceeded = true;
        break;
      }

      // Geçici backend/proxy hatalarında kontrollü retry.
      await page.waitForTimeout(500);
    }

    expect(
      purchaseSucceeded,
      `Reward purchase did not succeed after retries. Last dialog: "${lastDialogMessage || 'none'}"`
    ).toBeTruthy();

    await page.locator('[data-testid="inventory-tab"]').click();
    await expect(page.getByText(/CAFE DUO KUPONU|KOD|KASADA GÖSTERİN/i).first()).toBeVisible({
      timeout: 8000,
    });
  });
});
