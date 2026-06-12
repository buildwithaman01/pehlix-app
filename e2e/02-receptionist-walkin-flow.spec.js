import { test, expect } from '@playwright/test';

test.describe('02 - Receptionist Walk-in Flow', () => {
  const receptionistPhone = '7777777771'; // Matching what we created in 01
  const otp = '123456';

  test('Receptionist can book a test, handle partial payment, and generate invoice', async ({ page }) => {
    // 1. Receptionist Login
    await page.goto('/auth/login');
    await page.fill('input[type="tel"]', receptionistPhone);
    await page.click('button:has-text("Send OTP")');
    await page.fill('input[placeholder="Enter OTP"]', otp);
    await page.click('button:has-text("Verify & Login")');

    await expect(page).toHaveURL(/.*\/dashboard/);

    // 2. Patient Registration
    await page.click('text=New Registration');
    await page.fill('input[name="firstName"]', 'John');
    await page.fill('input[name="lastName"]', 'Doe');
    await page.fill('input[name="phone"]', '9876543210');
    await page.fill('input[name="age"]', '30');
    await page.selectOption('select[name="gender"]', 'male');
    await page.click('button:has-text("Register Patient")');
    
    // Expect successful patient registration
    await expect(page.locator('text=Patient registered successfully')).toBeVisible();

    // 3. Select Tests
    await page.fill('input[placeholder="Search Tests..."]', 'Hemoglobin');
    await page.click('text=Add Test');
    
    // Select Referring Doctor
    await page.selectOption('select[name="referredBy"]', { label: 'Self' }); // Or pick from list

    // 4. Billing & Partial Payment
    // Assuming the test costs 500
    await page.fill('input[name="amountPaid"]', '200'); // Partial payment
    await page.selectOption('select[name="paymentMode"]', 'cash');
    
    // Apply Waiver
    await page.fill('input[name="waiverAmount"]', '50');
    await page.fill('input[name="waiverReason"]', 'Discount for regular patient');

    // Finalize Visit
    await page.click('button:has-text("Confirm & Book")');

    // Assert successful booking and invoice generation
    await expect(page.locator('text=Visit created successfully')).toBeVisible();
    
    // View Invoice
    await page.click('text=View Invoice');
    await expect(page.locator('text=Invoice')).toBeVisible();
    await expect(page.locator('text=Balance Due')).toContainText('250'); // 500 - 200 - 50 = 250
  });
});
