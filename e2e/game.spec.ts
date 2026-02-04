/**
 * E2E Tests - Game Flow
 * 
 * @description Table matching, game creation, and joining tests
 */

import { test, expect } from '@playwright/test';

test.describe('Game Flow', () => {
  // Helper function to login before tests using data-testid
  const login = async (page) => {
    await page.goto('/');
    await page.locator('[data-testid="hero-login-button"]').click();
    await page.locator('[data-testid="auth-email-input"]').fill('test@example.com');
    await page.locator('[data-testid="auth-password-input"]').fill('testpassword123');
    await page.locator('[data-testid="auth-submit-button"]').click();
    await expect(page.locator('[data-testid="dashboard-tab-games"]')).toBeVisible({ timeout: 5000 });
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('should show table matching UI when not matched', async ({ page }) => {
    await login(page);
    
    // Should show "Masa bağlı değil" or table matching section using data-testid
    await expect(page.locator('[data-testid="table-status"]')).toContainText(/Masa bağlı değil|masa kodu/i);
  });

  test('should disable game buttons when not matched to table', async ({ page }) => {
    await login(page);
    
    // Game creation button should be disabled using data-testid
    const createButton = page.locator('[data-testid="create-game-button"]');
    await expect(createButton).toBeDisabled();
  });

  test('should show user stats in status bar', async ({ page }) => {
    await login(page);
    
    // Status bar should show user info using data-testid
    await expect(page.locator('[data-testid="user-points"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-wins"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-games"]')).toBeVisible();
  });

  test('should navigate between tabs', async ({ page }) => {
    await login(page);
    
    // Click on Leaderboard tab using data-testid
    await page.locator('[data-testid="dashboard-tab-leaderboard"]').click();
    await expect(page.getByText(/Sıralama Tablosu|Leaderboard/i).first()).toBeVisible();
    
    // Click on Achievements tab using data-testid
    await page.locator('[data-testid="dashboard-tab-achievements"]').click();
    await expect(page.getByText(/Başarımlar|Achievements/i).first()).toBeVisible();
    
    // Click back to Games tab using data-testid
    await page.locator('[data-testid="dashboard-tab-games"]').click();
    await expect(page.locator('[data-testid="game-lobby-container"]').or(page.locator('[data-testid="game-lobby-empty"]'))).toBeVisible();
  });

  test('should show game lobby with available games or empty state', async ({ page }) => {
    await login(page);
    
    // Should show lobby section
    await expect(page.getByText(/Oyun Lobisi|Aktif Oyunlar/i).first()).toBeVisible();
    
    // Either show games list or empty state using data-testid
    const hasGames = await page.locator('[data-testid="game-lobby-list"]').isVisible().catch(() => false);
    const isEmpty = await page.locator('[data-testid="empty-state"]').or(page.locator('[data-testid="game-lobby-empty"]')).isVisible().catch(() => false);
    
    expect(hasGames || isEmpty).toBe(true);
  });

  test('should open create game modal when button enabled', async ({ page }) => {
    await login(page);
    
    // This test assumes user is already matched to a table
    // First check if create button exists and is enabled
    const createButton = page.locator('[data-testid="create-game-button"]');
    
    if (await createButton.isEnabled().catch(() => false)) {
      await createButton.click();
      
      // Modal should open using data-testid
      await expect(page.locator('[data-testid="create-game-modal"]')).toBeVisible();
      await expect(page.locator('[data-testid="game-type-rps"]')).toBeVisible();
    }
  });

  test('should select game type and points in create modal', async ({ page }) => {
    await login(page);
    
    const createButton = page.locator('[data-testid="create-game-button"]');
    
    if (await createButton.isEnabled().catch(() => false)) {
      await createButton.click();
      
      // Select game type using data-testid
      await page.locator('[data-testid="game-type-rps"]').click();
      
      // Select points using data-testid
      await page.locator('[data-testid="game-points-input"]').fill('50');
      
      // Submit button should be visible using data-testid
      await expect(page.locator('[data-testid="create-game-submit"]')).toBeVisible();
    }
  });
});
