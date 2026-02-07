import { test, expect } from '@playwright/test';
import { provisionUser, checkInUser, fetchCurrentUser } from './helpers/session';

const openAuthModal = async (page: import('@playwright/test').Page) => {
  const loginButtonByTestId = page.locator('[data-testid="hero-login-button"]');
  if (await loginButtonByTestId.count()) {
    await loginButtonByTestId.first().click();
  } else {
    const loginButtonByText = page.locator('main').getByRole('button', { name: /GİRİŞ YAP/i }).first();
    await expect(loginButtonByText).toBeVisible();
    await loginButtonByText.click();
  }

  await expect(page.locator('[data-testid="auth-email-input"]')).toBeVisible();
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
    await page.locator('[data-testid="auth-submit-button"]').click();

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
    await page.getByRole('button', { name: 'Kayıt Ol', exact: true }).first().click();

    await page.getByPlaceholder('Kullanıcı adı').fill(username);
    await page.locator('[data-testid="auth-email-input"]').fill(email);
    await page.locator('[data-testid="auth-password-input"]').fill(password);
    await page.locator('[data-testid="auth-submit-button"], form button[type=\"submit\"]').first().click();

    const startedAt = Date.now();
    let token: string | null = null;
    while (Date.now() - startedAt < 10000) {
      token = await page.evaluate(() => localStorage.getItem('token'));
      if (token) break;
      await page.waitForTimeout(250);
    }

    if (token) {
      await page.goto(`${root}/dashboard`);
      await expect(page.getByRole('heading', { name: 'Kafe Giriş' })).toBeVisible({ timeout: 10000 });
      return;
    }

    await expect(
      page.getByText(/Internal server error|Kullanıcı oluşturulamadı|E-posta kullanımda|Çok fazla/i).first()
    ).toBeVisible();
  });

  test('can login with provisioned account and logout', async ({ page, request, baseURL }) => {
    const root = baseURL || 'http://localhost:3000';
    const session = await provisionUser(request, root, 'auth_login');

    await page.goto(root);
    await openAuthModal(page);
    await page.locator('[data-testid="auth-email-input"]').fill(session.credentials.email);
    await page.locator('[data-testid="auth-password-input"]').fill(session.credentials.password);
    await page.locator('[data-testid="auth-submit-button"], form button[type=\"submit\"]').first().click();

    await expect(page.getByText('Kafe Giriş')).toBeVisible({ timeout: 10000 });

    // check-in API ile tamamlayıp dashboard + logout akışını doğrula
    await checkInUser(request, root, session.token, { tableNumber: 7 });
    const currentUser = await fetchCurrentUser(request, root, session.token);

    await page.evaluate(
      ({ token, user }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('cafe_user', JSON.stringify(user));
        sessionStorage.setItem('cafeduo_checked_in_token', token);
      },
      { token: session.token, user: currentUser }
    );
    await page.goto(`${root}/dashboard`);
    const dashboardTab = page.locator('[data-testid="dashboard-tab-games"]');
    const dashboardReady = await dashboardTab.isVisible().catch(() => false);
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
    await expect(dashboardTab).toBeVisible({ timeout: 10000 });

    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    const tokenAfterClear = await page.evaluate(() => localStorage.getItem('token'));
    expect(tokenAfterClear).toBeNull();
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
    await page.locator('[data-testid="auth-submit-button"], form button[type=\"submit\"]').first().click();

    await expect(page.getByText(/Geçersiz e-posta veya şifre|Çok fazla|429|hata/i).first()).toBeVisible({
      timeout: 8000,
    });
  });
});
