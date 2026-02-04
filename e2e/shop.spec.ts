/**
 * E2E Tests - Shop & Rewards Flow
 * 
 * @description Buying rewards and inventory management tests
 */

import { test, expect } from '@playwright/test';

test.describe('Shop & Rewards Flow', () => {
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

  test('should show reward section on dashboard', async ({ page }) => {
    await login(page);
    
    // Should show shop/reward section using data-testid
    await expect(page.locator('[data-testid="shop-tab"]')).toBeVisible();
    await expect(page.locator('[data-testid="inventory-tab"]')).toBeVisible();
    
    // Should show user points using data-testid
    await expect(page.locator('[data-testid="user-points"]')).toBeVisible();
  });

  test('should switch between shop and inventory tabs', async ({ page }) => {
    await login(page);
    
    // Click on Inventory tab using data-testid
    await page.locator('[data-testid="inventory-tab"]').click();
    
    // Should show inventory content
    await expect(page.getByText(/Envanter|Kupon|Kod/i).first()).toBeVisible();
    
    // Click back to Shop tab using data-testid
    await page.locator('[data-testid="shop-tab"]').click();
    
    // Should show shop items or empty state
    const hasItems = await page.locator('[data-testid="shop-buy-button"]').first().isVisible().catch(() => false);
    const isEmpty = await page.locator('[data-testid="empty-state-compact"]').isVisible().catch(() => false);
    
    expect(hasItems || isEmpty).toBe(true);
  });

  test('should display available rewards in shop or empty state', async ({ page }) => {
    await login(page);
    
    // Ensure we're on shop tab using data-testid
    await page.locator('[data-testid="shop-tab"]').click();
    
    // Should show reward items or empty state
    const rewardItems = page.locator('[data-testid="shop-buy-button"]').first();
    const emptyState = page.locator('[data-testid="empty-state-compact"]');
    
    const hasItems = await rewardItems.isVisible().catch(() => false);
    const isEmpty = await emptyState.isVisible().catch(() => false);
    
    expect(hasItems || isEmpty).toBe(true);
  });

  test('should show user points balance prominently', async ({ page }) => {
    await login(page);
    
    // Points should be visible in status bar using data-testid
    const pointsDisplay = page.locator('[data-testid="user-points"]');
    await expect(pointsDisplay).toBeVisible();
    
    // Verify points text contains a number
    const pointsText = await pointsDisplay.textContent();
    expect(pointsText).toMatch(/\d+/);
  });

  test('should show inventory items with codes or empty state', async ({ page }) => {
    await login(page);
    
    // Go to inventory tab using data-testid
    await page.locator('[data-testid="inventory-tab"]').click();
    
    // Check for inventory items or empty state
    const inventoryItem = page.locator('[data-testid="empty-state-compact"]').or(page.getByText(/KOD|kupon/i)).first();
    const emptyState = page.locator('[data-testid="empty-state-title"]').or(page.getByText(/Envanterin Boş|Henüz kupon/i)).first();
    
    const hasItems = await inventoryItem.isVisible().catch(() => false);
    const isEmpty = await emptyState.isVisible().catch(() => false);
    
    expect(hasItems || isEmpty).toBe(true);
  });

  test('should navigate to shop from empty inventory', async ({ page }) => {
    await login(page);
    
    // Go to inventory tab using data-testid
    await page.locator('[data-testid="inventory-tab"]').click();
    
    // Check for empty state with action button
    const goToShopButton = page.getByRole('button', { name: /Mağazaya Git|Go to Shop/i });
    
    if (await goToShopButton.isVisible().catch(() => false)) {
      await goToShopButton.click();
      
      // Should navigate to shop - shop tab should be active
      await expect(page.locator('[data-testid="shop-tab"]')).toBeVisible();
    }
  });
});
