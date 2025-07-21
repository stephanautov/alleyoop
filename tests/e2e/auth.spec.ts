// @ts-nocheck
import { test, expect } from '@playwright/test';

test('unauthenticated redirect to sign-in', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*sign-in/);
}); 