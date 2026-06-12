import { test, expect } from '@playwright/test';

test.describe('06 - Home Collection Assignment & Payment Flow', () => {
  const receptionistPhone = '7777777771';
  const phlebotomistPhone = '7777777772';
  const otp = '123456';
  
  let visitCode = '';

  test.describe.configure({ mode: 'serial' });

  test('Step 1: Receptionist books home collection and explicitly assigns a Phlebotomist', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="tel"]', receptionistPhone);
    await page.click('button:has-text("Send OTP")');
    await page.fill('input[placeholder="Enter OTP"]', otp);
    await page.click('button:has-text("Verify & Login")');

    await page.click('text=New Registration');
    await page.fill('input[name="firstName"]', 'Robert');
    await page.fill('input[name="lastName"]', 'Collection');
    await page.fill('input[name="phone"]', '9234567890');
    await page.click('button:has-text("Register Patient")');
    
    // Select Home Collection
    await page.check('input[name="isHomeCollection"]');
    await page.fill('input[name="address"]', '456 Phlebotomy Lane, Delhi');

    // Add Test (Assuming 1000 cost)
    await page.fill('input[placeholder="Search Tests..."]', 'Complete Blood Count');
    await page.click('text=Add Test');

    // Explicit Assignment
    await page.selectOption('select[name="assignedPhlebotomist"]', { label: 'E2E Phlebotomist' });

    // Ensure 0 payment is taken at booking so the Phlebotomist has to collect it
    await page.fill('input[name="amountPaid"]', '0');

    // Finalize Visit
    await page.click('button:has-text("Confirm & Book")');
    await expect(page.locator('text=Visit created successfully')).toBeVisible();

    const visitElement = await page.locator('.visit-code-display').first();
    visitCode = await visitElement.innerText();
    
    await page.click('text=Logout');
  });

  test('Step 2: Assigned Phlebotomist checks dashboard, marks status, collects sample and pending payment', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="tel"]', phlebotomistPhone);
    await page.click('button:has-text("Send OTP")');
    await page.fill('input[placeholder="Enter OTP"]', otp);
    await page.click('button:has-text("Verify & Login")');

    // Dashboard should specifically show their assigned tasks
    await page.click('text=My Assignments');
    await expect(page.locator(`text=${visitCode}`)).toBeVisible();
    await page.click(`text=${visitCode}`);
    
    // Logical flow of moving through states
    await page.click('button:has-text("Start Travel")');
    await expect(page.locator('text=Travel Started')).toBeVisible();

    await page.click('button:has-text("Mark as Reached")');
    await expect(page.locator('text=Reached Location')).toBeVisible();

    // Take pending money
    await page.click('button:has-text("Collect Pending Payment")');
    // Assuming full amount collected in cash
    await page.fill('input[name="paymentAmount"]', '1000');
    await page.selectOption('select[name="paymentMethod"]', 'cash');
    await page.click('button:has-text("Confirm Payment")');
    await expect(page.locator('text=Payment Recorded')).toBeVisible();

    // Collect Sample
    await page.click('button:has-text("Collect Sample")');
    await page.fill('input[name="barcode"]', `FLD-${visitCode}`);
    await page.click('button:has-text("Confirm Collection")');
    
    await expect(page.locator('text=Sample collected successfully')).toBeVisible();
    await page.click('text=Logout');
  });
});
