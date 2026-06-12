import { test, expect } from '@playwright/test';

test.describe('05 - RBAC Isolation & Security', () => {
  const phlebotomistPhone = '7777777772';
  const receptionistPhone = '7777777771';
  const otp = '123456';

  test('Phlebotomist should NOT be able to view Admin Revenue Analytics', async ({ page }) => {
    // Login as Phlebotomist
    await page.goto('/auth/login');
    await page.fill('input[type="tel"]', phlebotomistPhone);
    await page.click('button:has-text("Send OTP")');
    await page.fill('input[placeholder="Enter OTP"]', otp);
    await page.click('button:has-text("Verify & Login")');

    await expect(page).toHaveURL(/.*\/dashboard/);

    // Verify Side Nav does NOT contain Analytics or Settings
    await expect(page.locator('text=Analytics & Revenue')).not.toBeVisible();
    await expect(page.locator('text=Lab Settings')).not.toBeVisible();

    // Directly attempt to navigate to restricted URL
    await page.goto('/dashboard/analytics');

    // Should redirect away or show 403 Access Denied
    // Depending on Next.js setup, we check for a fallback or redirect to /dashboard
    const url = page.url();
    expect(url.includes('/analytics')).toBeFalsy();
    
    // Check access denied text if it doesn't redirect
    if (url.includes('/analytics')) {
      await expect(page.locator('text=Access Denied')).toBeVisible();
    }
  });

  test('Receptionist should NOT be able to approve critical values', async ({ page }) => {
    // Login as Receptionist
    await page.goto('/auth/login');
    await page.fill('input[type="tel"]', receptionistPhone);
    await page.click('button:has-text("Send OTP")');
    await page.fill('input[placeholder="Enter OTP"]', otp);
    await page.click('button:has-text("Verify & Login")');

    await expect(page).toHaveURL(/.*\/dashboard/);

    // Verify Side Nav does NOT contain Approval Queue
    await expect(page.locator('text=Approval Queue')).not.toBeVisible();

    // Directly attempt to navigate to Approval Queue
    await page.goto('/dashboard/approval-queue');

    // Should redirect away or show 403 Access Denied
    const url = page.url();
    expect(url.includes('/approval-queue')).toBeFalsy();
    
    if (url.includes('/approval-queue')) {
      await expect(page.locator('text=Access Denied')).toBeVisible();
    }
  });
});
