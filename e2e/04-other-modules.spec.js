import { test, expect } from '@playwright/test';

test.describe('04 - Other Modules (Inventory & Doctor Portal)', () => {
  const adminPhone = '7777777771'; // Reusing Receptionist or Admin who has access to Inventory
  const doctorPhone = '9876543210';
  const otp = '123456';

  test.describe.configure({ mode: 'parallel' });

  test('Inventory: Reagents should auto-consume when results are entered', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="tel"]', adminPhone);
    await page.click('button:has-text("Send OTP")');
    await page.fill('input[placeholder="Enter OTP"]', otp);
    await page.click('button:has-text("Verify & Login")');

    // Go to Inventory
    await page.click('text=Inventory');
    
    // Check initial stock for 'Hemoglobin Reagent'
    await page.fill('input[placeholder="Search Inventory..."]', 'Hemoglobin Reagent');
    const initialStockText = await page.locator('.stock-quantity').first().innerText();
    const initialStock = parseInt(initialStockText, 10);

    // Book a Hemoglobin test and enter results to trigger consumption
    await page.goto('/dashboard/visits/new');
    await page.fill('input[name="firstName"]', 'InvTest');
    await page.fill('input[name="phone"]', '9999999998');
    await page.fill('input[placeholder="Search Tests..."]', 'Hemoglobin');
    await page.click('text=Add Test');
    await page.click('button:has-text("Confirm & Book")');
    
    const visitElement = await page.locator('.visit-code-display').first();
    const visitCode = await visitElement.innerText();

    // Go to work queue and enter result
    await page.goto('/dashboard/work-queue');
    await page.click(`text=${visitCode}`);
    await page.fill('input[name="Hemoglobin"]', '14'); 
    await page.click('button:has-text("Submit Results")');

    // Go back to Inventory and check stock
    await page.goto('/dashboard/inventory');
    await page.fill('input[placeholder="Search Inventory..."]', 'Hemoglobin Reagent');
    const finalStockText = await page.locator('.stock-quantity').first().innerText();
    const finalStock = parseInt(finalStockText, 10);

    // Assert that stock decreased
    expect(finalStock).toBeLessThan(initialStock);
  });

  test('Doctor Portal: Referring doctors can log in and view commissions', async ({ page }) => {
    // We assume a Doctor was created during the test booking steps
    await page.goto('/doctor/portal'); // Separate portal URL
    
    // Login flow for doctor
    await page.fill('input[type="tel"]', doctorPhone);
    await page.click('button:has-text("Send OTP")');
    await page.fill('input[placeholder="Enter OTP"]', otp);
    await page.click('button:has-text("Verify & Login")');

    await expect(page).toHaveURL(/.*\/doctor\/portal\/dashboard/);

    // Check Commissions tab
    await page.click('text=My Commissions');
    
    // Ensure the total commission amount is visible
    await expect(page.locator('text=Total Outstanding Commission')).toBeVisible();
    
    // Ensure the table of referrals is loaded
    await expect(page.locator('table')).toBeVisible();
    
    // Click View Statement
    await page.click('text=View Latest Statement');
    await expect(page.locator('text=Monthly Statement')).toBeVisible();
  });
});
