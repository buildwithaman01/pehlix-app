import { test, expect } from '@playwright/test';

test.describe('03 - Multi-Role Handoff Flow', () => {
  const receptionistPhone = '7777777771';
  const phlebotomistPhone = '7777777772';
  const technicianPhone = '7777777773';
  const pathologistPhone = '7777777774';
  const otp = '123456';
  
  // Shared state between sequential steps
  let visitCode = '';

  test.describe.configure({ mode: 'serial' });

  test('Step 1: Receptionist books a home collection visit', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="tel"]', receptionistPhone);
    await page.click('button:has-text("Send OTP")');
    await page.fill('input[placeholder="Enter OTP"]', otp);
    await page.click('button:has-text("Verify & Login")');

    await page.click('text=New Registration');
    await page.fill('input[name="firstName"]', 'Jane');
    await page.fill('input[name="lastName"]', 'Smith');
    await page.fill('input[name="phone"]', '9123456789');
    await page.click('button:has-text("Register Patient")');
    
    // Select Home Collection
    await page.check('input[name="isHomeCollection"]');
    await page.fill('input[name="address"]', '123 Test Street, Mumbai');

    // Add Test
    await page.fill('input[placeholder="Search Tests..."]', 'Lipid Profile');
    await page.click('text=Add Test');

    // Finalize Visit
    await page.click('button:has-text("Confirm & Book")');
    await expect(page.locator('text=Visit created successfully')).toBeVisible();

    // Extract visit code
    const visitElement = await page.locator('.visit-code-display').first();
    visitCode = await visitElement.innerText();
    expect(visitCode).toBeTruthy();
    
    await page.click('text=Logout');
  });

  test('Step 2: Phlebotomist collects sample in the field', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="tel"]', phlebotomistPhone);
    await page.click('button:has-text("Send OTP")');
    await page.fill('input[placeholder="Enter OTP"]', otp);
    await page.click('button:has-text("Verify & Login")');

    await page.click('text=Home Collections');
    // Find the specific visit
    await page.click(`text=${visitCode}`);
    
    await page.click('button:has-text("Mark as Reached")');
    await page.click('button:has-text("Collect Sample")');
    
    // Enter barcode
    await page.fill('input[name="barcode"]', `BAR-${visitCode}`);
    await page.click('button:has-text("Confirm Collection")');
    
    await expect(page.locator('text=Sample collected')).toBeVisible();
    await page.click('text=Logout');
  });

  test('Step 3: Technician enters results and triggers critical flag', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="tel"]', technicianPhone);
    await page.click('button:has-text("Send OTP")');
    await page.fill('input[placeholder="Enter OTP"]', otp);
    await page.click('button:has-text("Verify & Login")');

    await page.click('text=Work Queue');
    await page.click(`text=${visitCode}`);

    // Assume one of the parameters is Triglycerides, we enter a critical value > 500
    await page.fill('input[name="Triglycerides"]', '650'); 
    await page.click('button:has-text("Submit Results")');

    // It should warn about critical value
    await expect(page.locator('text=Critical Value Detected')).toBeVisible();
    await page.click('button:has-text("Proceed & Flag Critical")');
    
    await page.click('text=Logout');
  });

  test('Step 4: Pathologist reviews and approves the critical result', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="tel"]', pathologistPhone);
    await page.click('button:has-text("Send OTP")');
    await page.fill('input[placeholder="Enter OTP"]', otp);
    await page.click('button:has-text("Verify & Login")');

    // Look at Critical Monitor first
    await page.click('text=Critical Monitor');
    await expect(page.locator(`text=${visitCode}`)).toBeVisible();

    // Go to Approval Queue
    await page.click('text=Approval Queue');
    await page.click(`text=${visitCode}`);

    // Add note and approve
    await page.fill('textarea[name="pathologistNote"]', 'Patient advised to visit ER immediately due to severe hypertriglyceridemia.');
    await page.click('button:has-text("Approve & Generate Report")');

    await expect(page.locator('text=Report Approved Successfully')).toBeVisible();
  });
});
