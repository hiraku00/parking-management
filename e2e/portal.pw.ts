import { test, expect } from '@playwright/test';

test.describe('Contractor Portal', () => {
  test.beforeEach(async ({ page }) => {
    // Login as contractor before each test
    await page.goto('/login');
    await page.fill('#name', '田中次郎');
    await page.fill('#phone', '1234');
    await page.click('button:has-text("アクセス")');
    await expect(page).toHaveURL('/portal');
  });

  test('should display payment buttons', async ({ page }) => {
    // Payment buttons should be present
    const payButton = page.locator('button:has-text("カードで支払う")');
    await expect(payButton).toBeVisible();
  });

  test('should show success message after payment redirect', async ({ page }) => {
    // Simulate a successful payment redirect
    await page.goto('/portal?success=true&months=["2025-12"]');

    // Should show success message
    await expect(page.locator('text=お支払いが完了しました')).toBeVisible();
  });

  test('should show error message when error parameter is present', async ({ page }) => {
    // Simulate an error redirect
    await page.goto('/portal?error=テスト用エラーメッセージ');

    // Should show error alert
    await expect(page.locator('text=エラーが発生しました')).toBeVisible();
    await expect(page.locator('text=テスト用エラーメッセージ')).toBeVisible();
  });
});

test.describe('Owner Admin Panel', () => {
  // Note: Owner admin panel tests require a real Supabase Auth account
  // To enable these tests:
  // 1. Create an owner account in Supabase Auth Dashboard
  // 2. Set TEST_OWNER_EMAIL and TEST_OWNER_PASSWORD environment variables
  // 3. Remove test.skip() from the describe block below

  test.skip('requires Supabase Auth setup', () => {
    // Placeholder to skip all owner tests
  });

  /* Uncomment when owner auth is set up:
  
  test.beforeEach(async ({ page }) => {
    // Login as owner before each test
    await page.goto('/login');
    await page.click('text=オーナー');
    await page.fill('#email', process.env.TEST_OWNER_EMAIL!);
    await page.fill('#password', process.env.TEST_OWNER_PASSWORD!);
    await page.click('button:has-text("ログイン")');
    await expect(page).toHaveURL('/admin');
  });

  test('should display contractor list', async ({ page }) => {
    // Check for contractor list heading
    await expect(page.locator('text=契約者一覧')).toBeVisible();
    
    // Check for at least one contractor row
    const contractorRows = page.locator('table tbody tr');
    await expect(contractorRows).not.toHaveCount(0);
  });

  test('should navigate to settings page', async ({ page }) => {
    // Click on settings link/button
    await page.click('text=設定');
    
    // Should navigate to settings page
    await expect(page).toHaveURL('/admin/settings');
    
    // Verify settings content
    await expect(page.locator('text=オーナー設定')).toBeVisible();
  });

  test('should display pending payments if any exist', async ({ page }) => {
    // Look for pending payments section
    const pendingSection = page.locator('text=承認待ち');
    
    // If visible, check for approve button
    if (await pendingSection.isVisible()) {
      await expect(page.locator('button:has-text("承認")')).toBeVisible();
    }
  });
  */
});
