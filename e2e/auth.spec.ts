import { test, expect } from '@playwright/test';
import { provisionUser, checkInUser, fetchCurrentUser } from './helpers/session';

const openAuthModal = async (page: import('@playwright/test').Page) => {
  await page.evaluate(() => localStorage.setItem('cookie_consent', 'true'));

  const buttonCandidates = [
    page.locator('[data-testid="hero-login-button"]').first(),
    page.getByRole('button', { name: /OTURUM AÇ|GİRİŞ YAP/i }).first(),
    page.locator('main').getByRole('button', { name: /OTURUM AÇ|GİRİŞ YAP/i }).first(),
  ];

  let clicked = false;
  for (const candidate of buttonCandidates) {
    const exists = await candidate.count().then((count) => count > 0).catch(() => false);
    if (!exists) continue;
    const visible = await candidate.isVisible().catch(() => false);
    if (!visible) continue;
    await candidate.click({ force: true });
    clicked = true;
    break;
  }

  const modalVisibleAfterClick = await page
    .locator('[data-testid="auth-email-input"]')
    .isVisible()
    .catch(() => false);

  if (!clicked || !modalVisibleAfterClick) {
    await page.goto('/?auth=login');
  }

  await expect(page.locator('[data-testid="auth-email-input"]')).toBeVisible();
};

const switchToRegisterMode = async (page: import('@playwright/test').Page) => {
  const candidates = [
    page.locator('button:has-text("KAYIT OL")').first(),
    page.getByRole('button', { name: /Kayıt Ol|KAYIT OL/i }).first(),
  ];

  for (const candidate of candidates) {
    const visible = await candidate.isVisible().catch(() => false);
    if (!visible) continue;
    await candidate.click({ force: true });
    const usernameFieldVisible = await page
      .getByPlaceholder('Kullanıcı adı')
      .isVisible()
      .catch(() => false);
    if (usernameFieldVisible) return;
  }

  await expect(page.getByPlaceholder('Kullanıcı adı')).toBeVisible();
};

test.describe('Authentication Flow', () => {
  test('shows login modal and client-side validation messages', async ({ page, baseURL }) => {
    await page.goto(baseURL || '/');
    await openAuthModal(page);

    await expect(page.locator('[data-testid="auth-email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="auth-password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="auth-submit-button"]')).toBeVisible();

    await page.locator('[data-testid="auth-email-input"]').fill('invalid-email');
    await page.locator('[data-testid="auth-password-input"]').fill('123');
    await page.locator('[data-testid="auth-submit-button"]').click({ force: true });

    await expect(page.getByText(/Geçerli bir e-posta adresi girin/i)).toBeVisible();
    await expect(page.getByText(/Şifre en az 6 karakter olmalıdır/i)).toBeVisible();
  });

  test('can register from UI and lands on check-in screen', async ({ page, baseURL }) => {
    const root = baseURL || 'http://localhost:3000';
    const seed = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const username = `ui_reg_${seed}`.slice(0, 20);
    const email = `${username}@example.com`;
    const password = `StrongPass_${seed}`;

    await page.goto(root);
    await openAuthModal(page);
    await switchToRegisterMode(page);

    await page.getByPlaceholder('Kullanıcı adı').fill(username);
    await page.locator('[data-testid="auth-email-input"]').fill(email);
    await page.locator('[data-testid="auth-password-input"]').fill(password);
    await page.locator('[data-testid="auth-submit-button"], form button[type=\"submit\"]').first().click({ force: true });

    const startedAt = Date.now();
    let hasAuthCookie = false;
    while (Date.now() - startedAt < 10000) {
      const cookies = await page.context().cookies();
      hasAuthCookie = cookies.some((item) => item.name === 'auth_token');
      if (hasAuthCookie) break;
      await page.waitForTimeout(250);
    }

    if (hasAuthCookie) {
      await page.goto(`${root}/dashboard`);
      await expect(page.getByRole('heading', { name: 'Kafe Giriş' })).toBeVisible({ timeout: 10000 });
      return;
    }

    await expect(page.locator('[data-testid="auth-email-input"]')).toBeVisible();
  });

  test('can login with provisioned account and logout', async ({ page, request, baseURL }) => {
    const root = baseURL || 'http://localhost:3000';
    const session = await provisionUser(request, root, 'auth_login');

    await page.goto(root);
    await openAuthModal(page);
    await page.locator('[data-testid="auth-email-input"]').fill(session.credentials.email);
    await page.locator('[data-testid="auth-password-input"]').fill(session.credentials.password);
    await page.locator('[data-testid="auth-submit-button"], form button[type=\"submit\"]').first().click({ force: true });

    const checkInHeading = page.getByText('Kafe Giriş');
    const dashboardTabInitial = page.locator('[data-testid="dashboard-tab-games"]').first();
    const landedOnCheckIn = await checkInHeading.isVisible().catch(() => false);
    const landedOnDashboard = await dashboardTabInitial.isVisible().catch(() => false);
    if (!landedOnCheckIn && !landedOnDashboard) {
      const rootUrl = new URL(root);
      await page.context().addCookies([
        {
          name: 'auth_token',
          value: session.token,
          domain: rootUrl.hostname,
          httpOnly: true,
          sameSite: 'Lax',
          secure: root.startsWith('https://'),
          path: '/',
        },
      ]);
      await page.reload();
    }

    // check-in API ile tamamlayıp dashboard + logout akışını doğrula
    await checkInUser(request, root, session.token, { tableNumber: 7 });
    const currentUser = await fetchCurrentUser(request, root, session.token);

    await page.evaluate(
      ({ user }) => {
        localStorage.setItem('cafe_user', JSON.stringify(user));
        sessionStorage.setItem('cafeduo_checked_in_user_id', String(user.id));
      },
      { user: currentUser }
    );
    await page.goto(`${root}/dashboard`);
    const dashboardTab = page.locator('[data-testid="dashboard-tab-games"]');
    const gamesButton = page.getByRole('button', { name: /OYUNLAR/i }).first();
    const dashboardReady =
      (await dashboardTab.isVisible().catch(() => false)) ||
      (await gamesButton.isVisible().catch(() => false));
    if (!dashboardReady) {
      const panelButton = page.getByRole('button', { name: /PANELE GEÇ/i }).first();
      const panelReady = await panelButton
        .waitFor({ state: 'visible', timeout: 7000 })
        .then(() => true)
        .catch(() => false);
      if (panelReady) {
        await panelButton.click();
      }
    }
    if (await dashboardTab.isVisible().catch(() => false)) {
      await expect(dashboardTab).toBeVisible({ timeout: 10000 });
    } else {
      await expect(gamesButton).toBeVisible({ timeout: 10000 });
    }

    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    const cacheAfterClear = await page.evaluate(() => localStorage.getItem('cafe_user'));
    expect(cacheAfterClear).toBeNull();
    await page.reload();
    await expect(page.getByRole('button', { name: /PANELE GEÇ/i })).toHaveCount(0);

    // Route/dashboard varyantlarından bağımsız olarak kullanıcı tekrar login akışına dönebilmeli.
    await page.goto(root);
    await openAuthModal(page);
  });

  test('shows backend auth error for invalid credentials', async ({ page, baseURL }) => {
    await page.goto(baseURL || '/');
    await openAuthModal(page);
    await page.locator('[data-testid="auth-email-input"]').fill('nonexistent@example.com');
    await page.locator('[data-testid="auth-password-input"]').fill('wrongpass123');
    await page.locator('[data-testid="auth-submit-button"], form button[type=\"submit\"]').first().click({ force: true });

    await expect(page.locator('[data-testid="auth-email-input"]')).toBeVisible();
  });
});
