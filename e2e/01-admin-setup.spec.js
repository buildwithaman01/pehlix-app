import { test, expect } from '@playwright/test';

test.describe('01 - Admin Setup Flow', () => {
  // Using a test-specific phone number and fixed OTP to avoid rate limits
  const superAdminPhone = '9999999999';
  const superAdminOtp = '123456';

  test('SuperAdmin should be able to login, create a lab, and assign staff', async ({ page }) => {
    // 1. SuperAdmin Login
    await page.goto('/auth/login');
    await page.fill('input[type="tel"]', superAdminPhone);
    await page.click('button:has-text("Send OTP")');
    
    // Simulate OTP entry
    await page.fill('input[placeholder="Enter OTP"]', superAdminOtp);
    await page.click('button:has-text("Verify & Login")');

    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/.*\/super-admin\/dashboard/);

    // 2. Create a Lab
    await page.click('text=Add New Lab');
    await page.fill('input[name="labName"]', 'E2E Testing Lab');
    await page.fill('input[name="ownerPhone"]', '8888888888');
    await page.fill('input[name="address.city"]', 'Mumbai');
    await page.click('button[type="submit"]');

    // Assert lab creation success
    await expect(page.locator('text=Lab created successfully')).toBeVisible();

    // 3. Impersonate Lab Owner (or navigate to Lab settings)
    // To keep it simple, we assume SuperAdmin navigates to the lab details and creates staff
    await page.click('text=E2E Testing Lab');
    await page.click('text=Manage Staff');
    
    // Create Receptionist
    await page.click('text=Add Staff');
    await page.fill('input[name="name"]', 'E2E Receptionist');
    await page.fill('input[name="phone"]', '7777777771');
    await page.selectOption('select[name="role"]', 'receptionist');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Staff member added')).toBeVisible();

    // Create Phlebotomist
    await page.click('text=Add Staff');
    await page.fill('input[name="name"]', 'E2E Phlebotomist');
    await page.fill('input[name="phone"]', '7777777772');
    await page.selectOption('select[name="role"]', 'phlebotomist');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Staff member added')).toBeVisible();

    // Create Technician
    await page.click('text=Add Staff');
    await page.fill('input[name="name"]', 'E2E Technician');
    await page.fill('input[name="phone"]', '7777777773');
    await page.selectOption('select[name="role"]', 'technician');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Staff member added')).toBeVisible();

    // Create Pathologist
    await page.click('text=Add Staff');
    await page.fill('input[name="name"]', 'E2E Pathologist');
    await page.fill('input[name="phone"]', '7777777774');
    await page.selectOption('select[name="role"]', 'pathologist');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Staff member added')).toBeVisible();
  });
});
