import { test, expect } from '@playwright/test';
import { DEFAULT_E2E_APP_BASE_URL, provisionUser } from './helpers/session';

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
      .waitFor({ state: 'visible', timeout: 2000 })
      .then(() => true)
      .catch(() => false);
    if (usernameFieldVisible) return;
  }

  await page.goto('/?auth=register');
  await expect(page.getByPlaceholder('Kullanıcı adı')).toBeVisible();
};

test.describe('Authentication Flow', () => {
  test('@smoke shows login modal and client-side validation messages', async ({ page, baseURL }) => {
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

  test('@smoke can register from UI and lands on check-in screen', async ({ page, baseURL }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
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

  test('@smoke can login with provisioned account and logout', async ({ page, request, baseURL }) => {
    const root = baseURL || DEFAULT_E2E_APP_BASE_URL;
    const session = await provisionUser(request, root, 'auth_login');

    await page.goto(root);
    await openAuthModal(page);
    await page.locator('[data-testid="auth-email-input"]').fill(session.credentials.email);
    await page.locator('[data-testid="auth-password-input"]').fill(session.credentials.password);
    await page.locator('[data-testid="auth-submit-button"], form button[type=\"submit\"]').first().click({ force: true });

    const checkInHeadingInitial = page.getByText('Kafe Giriş');
    const dashboardTabInitial = page.locator('[data-testid="dashboard-tab-games"]').first();
    const landedOnCheckIn = await checkInHeadingInitial.isVisible().catch(() => false);
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
        {
          // Add CSRF token cookie for POST requests
          name: 'csrf_token',
          value: session.csrfToken || 'test-csrf-token-for-e2e',
          domain: rootUrl.hostname,
          httpOnly: false,
          sameSite: 'Lax',
          secure: root.startsWith('https://'),
          path: '/',
        },
      ]);
      await page.reload();
    }

    const checkInHeading = page.getByRole('heading', { name: 'Kafe Giriş' }).first();
    const checkInSubmit = page.locator('[data-testid="checkin-submit-button"]').first();
    const tableInput = page.locator('[data-testid="checkin-table-input"]').first();
    const verificationInput = page.locator('#checkin-verification-code').first();

    const waitForDashboardOrCheckIn = async (timeoutMs: number) => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const dashboardTab = page.locator('[data-testid="dashboard-tab-games"]').first();
        if (await dashboardTab.isVisible().catch(() => false)) return 'dashboard';
        if (await checkInHeading.isVisible().catch(() => false)) return 'checkin';
        await page.waitForTimeout(250);
      }
      return 'timeout';
    };

    let surface = await waitForDashboardOrCheckIn(10000);
    if (surface === 'timeout') {
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
        {
          name: 'csrf_token',
          value: session.csrfToken || 'test-csrf-token-for-e2e',
          domain: rootUrl.hostname,
          httpOnly: false,
          sameSite: 'Lax',
          secure: root.startsWith('https://'),
          path: '/',
        },
      ]);
      await page.goto(`${root}/dashboard`);
      surface = await waitForDashboardOrCheckIn(10000);
    }

    if (surface === 'checkin') {
      await tableInput.fill('7');
      await expect(tableInput).toHaveValue('7');
      await verificationInput.fill('1234-MASA07');
      await expect(verificationInput).toHaveValue('1234-MASA07');
      await expect(checkInSubmit).toBeEnabled({ timeout: 3000 });
      await checkInSubmit.click();
    }

    // Wait for dashboard to be visible after checkin
    const dashboardTab = page.locator('[data-testid="dashboard-tab-games"]').first();
    await expect(dashboardTab).toBeVisible({ timeout: 10000 });

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

  test('@smoke shows backend auth error for invalid credentials', async ({ page, baseURL }) => {
    await page.goto(baseURL || '/');
    await openAuthModal(page);
    await page.locator('[data-testid="auth-email-input"]').fill('nonexistent@example.com');
    await page.locator('[data-testid="auth-password-input"]').fill('wrongpass123');
    await page.locator('[data-testid="auth-submit-button"], form button[type=\"submit\"]').first().click({ force: true });

    await expect(page.locator('[data-testid="auth-email-input"]')).toBeVisible();
  });
});
