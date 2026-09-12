import { test, expect } from '@playwright/test';

test.describe('Smoke Test', () => {
    test('Login page should load successfully', async ({ page }) => {
        // Navigate to the login page
        const response = await page.goto('/login');

        // Check if the response status is 200 OK
        expect(response?.status()).toBe(200);

        // Verify key elements are visible
        // Check for the "ご利用者様" (Contractor) tab which is the default or one of the tabs
        await expect(page.locator('button[role="tab"]', { hasText: 'ご利用者様' })).toBeVisible();

        // Check for the name input field
        await expect(page.locator('input[name="name"]')).toBeVisible();

        // Check for the login button
        await expect(page.locator('button[type="submit"]')).toBeVisible();
    });
});
