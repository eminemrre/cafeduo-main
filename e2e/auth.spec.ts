/**
 * E2E Tests - Authentication Flow
 * 
 * @description Login, logout, and auth protection tests
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('should show login modal when accessing dashboard without auth', async ({ page }) => {
    await page.goto('/');
    
    // Should show the landing page with login button
    await expect(page.getByText('CafeDuo')).toBeVisible();
    await expect(page.locator('[data-testid="hero-login-button"]')).toBeVisible();
  });

  test('should open login modal when clicking login button', async ({ page }) => {
    await page.goto('/');
    
    // Click login button using data-testid
    await page.locator('[data-testid="hero-login-button"]').click();
    
    // Login modal should appear with data-testid selectors
    await expect(page.locator('[data-testid="auth-email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="auth-password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="auth-submit-button"]')).toBeVisible();
  });

  test('should show validation errors for invalid email', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-testid="hero-login-button"]').click();
    
    // Enter invalid email using data-testid
    await page.locator('[data-testid="auth-email-input"]').fill('invalid-email');
    await page.locator('[data-testid="auth-password-input"]').fill('password123');
    
    // Try to submit
    await page.locator('[data-testid="auth-submit-button"]').click();
    
    // Should show validation error
    await expect(page.getByText(/Geçerli bir e-posta adresi girin/i)).toBeVisible();
  });

  test('should show validation errors for short password', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-testid="hero-login-button"]').click();
    
    // Enter valid email but short password
    await page.locator('[data-testid="auth-email-input"]').fill('test@example.com');
    await page.locator('[data-testid="auth-password-input"]').fill('123');
    
    // Try to submit
    await page.locator('[data-testid="auth-submit-button"]').click();
    
    // Should show validation error
    await expect(page.getByText(/Şifre en az 6 karakter olmalı/i)).toBeVisible();
  });

  test('should toggle between login and register modes', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-testid="hero-login-button"]').click();
    
    // Initially in login mode - submit button shows "Giriş Yap"
    await expect(page.locator('[data-testid="auth-submit-button"]')).toContainText(/Giriş Yap/i);
    
    // Switch to register by clicking "Kayıt olun" text
    await page.getByText('Hesabınız yok mu?').click();
    await page.getByText('Kayıt olun').click();
    
    // Should show register form with username field
    await expect(page.getByPlaceholder('Kullanıcı Adı')).toBeVisible();
    await expect(page.locator('[data-testid="auth-submit-button"]')).toContainText(/Kayıt Ol/i);
    
    // Switch back to login
    await page.getByText('Giriş yap').click();
    
    // Should show login form again
    await expect(page.locator('[data-testid="auth-email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="auth-submit-button"]')).toContainText(/Giriş Yap/i);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-testid="hero-login-button"]').click();
    
    // Enter non-existent credentials using data-testid
    await page.locator('[data-testid="auth-email-input"]').fill('nonexistent@example.com');
    await page.locator('[data-testid="auth-password-input"]').fill('wrongpassword123');
    
    // Submit
    await page.locator('[data-testid="auth-submit-button"]').click();
    
    // Wait for error toast/alert
    await expect(page.getByText(/Giriş başarısız/i).or(page.getByText(/Hatalı/i))).toBeVisible({ timeout: 5000 });
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-testid="hero-login-button"]').click();
    
    // Note: This requires a test user to exist in the database
    // Replace with actual test credentials
    await page.locator('[data-testid="auth-email-input"]').fill('test@example.com');
    await page.locator('[data-testid="auth-password-input"]').fill('testpassword123');
    
    // Submit
    await page.locator('[data-testid="auth-submit-button"]').click();
    
    // Should redirect to dashboard or show dashboard elements
    await expect(page.locator('[data-testid="dashboard-tab-games"]')).toBeVisible({ timeout: 5000 });
    
    // Verify token is stored
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
  });

  test('should persist login after page refresh', async ({ page }) => {
    // First login using data-testid selectors
    await page.goto('/');
    await page.locator('[data-testid="hero-login-button"]').click();
    
    await page.locator('[data-testid="auth-email-input"]').fill('test@example.com');
    await page.locator('[data-testid="auth-password-input"]').fill('testpassword123');
    await page.locator('[data-testid="auth-submit-button"]').click();
    
    // Wait for dashboard
    await expect(page.locator('[data-testid="dashboard-tab-games"]')).toBeVisible({ timeout: 5000 });
    
    // Refresh page
    await page.reload();
    
    // Should still be logged in
    await expect(page.locator('[data-testid="dashboard-tab-games"]')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first using data-testid selectors
    await page.goto('/');
    await page.locator('[data-testid="hero-login-button"]').click();
    
    await page.locator('[data-testid="auth-email-input"]').fill('test@example.com');
    await page.locator('[data-testid="auth-password-input"]').fill('testpassword123');
    await page.locator('[data-testid="auth-submit-button"]').click();
    
    await expect(page.locator('[data-testid="dashboard-tab-games"]')).toBeVisible({ timeout: 5000 });
    
    // Click logout using data-testid
    await page.locator('[data-testid="logout-button"]').click();
    
    // Should be back to landing page
    await expect(page.getByText('CafeDuo')).toBeVisible();
    await expect(page.locator('[data-testid="hero-login-button"]')).toBeVisible();
    
    // Verify token is removed
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();
  });
});
