import { test, expect } from '@playwright/test';
import {
  DEFAULT_E2E_APP_BASE_URL,
  provisionUser,
  checkInUser,
  fetchCurrentUser,
  bootstrapAuthenticatedPage,
  resolveApiBaseUrl,
  waitForApiReady,
} from './helpers/session';

test.describe('Daily Reward Wheel (Dashboard)', () => {
  test('@smoke shows the daily reward wheel after check-in', async ({ page, request, baseURL }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    const apiRoot = resolveApiBaseUrl(root);
    await waitForApiReady(request, apiRoot);

    const session = await provisionUser(request, root, 'wheel_user');
    await checkInUser(request, root, session.token, { tableNumber: 3, csrfToken: session.csrfToken });
    const currentUser = await fetchCurrentUser(request, root, session.token);

    // Check-in API ile yapildi; /api/auth/me cafe_id dondurur, dashboard
    // dogrudan acilir. Check-In Gateway recovery'sine gerek yok (flake'e duyarli).
    await bootstrapAuthenticatedPage(page, root, session, {
      checkedIn: true,
      userOverride: currentUser,
      skipCheckInRecovery: true,
    });

    // Cold start'ta Vite + backend yavas olabilir; uzun bekleme.
    await expect(page.locator('[data-testid="daily-reward-wheel"]').first()).toBeVisible({
      timeout: 30000,
    });
    await expect(page.locator('[data-testid="wheel-spin-button"]').first()).toBeVisible();
  });

  test('@smoke spin click reaches the backend and surfaces its response', async ({
    page,
    request,
    baseURL,
  }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    const apiRoot = resolveApiBaseUrl(root);
    await waitForApiReady(request, apiRoot);

    const session = await provisionUser(request, root, 'wheel_spin');
    await checkInUser(request, root, session.token, { tableNumber: 4, csrfToken: session.csrfToken });
    const currentUser = await fetchCurrentUser(request, root, session.token);

    await bootstrapAuthenticatedPage(page, root, session, {
      checkedIn: true,
      userOverride: currentUser,
      skipCheckInRecovery: true,
    });

    const spinButton = page.locator('[data-testid="wheel-spin-button"]').first();
    await expect(spinButton).toBeVisible({ timeout: 30000 });
    await expect(spinButton).toBeEnabled({ timeout: 10000 });
    await spinButton.click();

    // E2E backend'i DB'siz (memory mode) calisir; spin endpoint'i 501 dondurur.
    // Tıklamanin gercek POST'a yol acdigini ve backend yanitinin arayüzde
    // görünür hata olarak surface edildigini dogrular.
    await expect(page.getByText('Demo modda çark çevrilemez.').first()).toBeVisible({ timeout: 15000 });
    // Hata sonrasi buton tekrar aktif olmali (kullanici tekrar deneyebilmeli).
    await expect(spinButton).toBeEnabled({ timeout: 10000 });
  });
});
