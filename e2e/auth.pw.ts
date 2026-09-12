import { test, expect } from '@playwright/test';

test.describe('Contractor Authentication', () => {
    test('should login successfully with valid credentials', async ({ page }) => {
        // Navigate directly to login page
        await page.goto('/login');

        // Fill in contractor login form (using data from seed file)
        await page.fill('#name', '田中次郎');
        await page.fill('#phone', '1234');

        // Submit form
        await page.click('button:has-text("アクセス")');

        // Should redirect to portal
        await expect(page).toHaveURL('/portal');

        // Verify portal content is displayed - check for payment button
        await expect(page.locator('button:has-text("カードで支払う")')).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
        await page.goto('/login');

        // Fill in invalid credentials
        await page.fill('#name', '存在しない人');
        await page.fill('#phone', '9999');

        // Submit form
        await page.click('button:has-text("アクセス")');

        // Should stay on login page with error message
        await expect(page).toHaveURL(/\/login/);
        await expect(page.locator('text=契約者が見つかりません')).toBeVisible();
    });
});

test.describe('Owner Authentication', () => {
    // Note: Owner authentication tests require a real Supabase Auth account
    // To enable these tests:
    // 1. Create an owner account in Supabase Auth Dashboard
    // 2. Set TEST_OWNER_EMAIL and TEST_OWNER_PASSWORD environment variables
    // 3. Remove test.skip() from the tests below

    test.skip('should login successfully with valid credentials', async ({ page }) => {
        await page.goto('/login');

        // Switch to owner tab
        await page.click('text=オーナー');

        // Fill in owner login form
        await page.fill('#email', process.env.TEST_OWNER_EMAIL || '');
        await page.fill('#password', process.env.TEST_OWNER_PASSWORD || '');

        // Submit form
        await page.click('button:has-text("ログイン")');

        // Should redirect to admin dashboard
        await expect(page).toHaveURL('/admin');

        // Verify admin content is displayed
        await expect(page.locator('text=契約者一覧')).toBeVisible();
    });

    test('should show error for invalid password', async ({ page }) => {
        await page.goto('/login');

        // Switch to owner tab
        await page.click('text=オーナー');

        // Fill in invalid credentials
        await page.fill('#email', 'test@example.com');
        await page.fill('#password', 'wrongpassword');

        // Submit form
        await page.click('button:has-text("ログイン")');

        // Should stay on login page with error message
        await expect(page).toHaveURL(/\/login/);
        await expect(page.locator('text=認証に失敗しました')).toBeVisible();
    });
});
