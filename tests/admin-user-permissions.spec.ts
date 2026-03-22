import { test, expect } from '@playwright/test';

// Helper functions
async function ensureDataLoaded(page: any): Promise<void> {
  const scenarioCombo = page.getByRole('combobox', { name: 'Scenario selector' });
  await expect(scenarioCombo).toBeVisible({ timeout: 20000 });
  // Click to open dropdown and verify options are loaded
  await scenarioCombo.click();
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible({ timeout: 10000 });
  const options = listbox.locator('[role="option"]');
  const count = await options.count();
  expect(count).toBeGreaterThan(0);
  // Close dropdown by pressing Escape
  await page.keyboard.press('Escape');
  await expect(listbox).not.toBeVisible({ timeout: 5000 });
}

async function selectScenario(page: any, label: string): Promise<void> {
  const combo = page.getByRole('combobox', { name: 'Scenario selector' });
  await combo.click();
  // Wait for listbox to appear and option to be available
  const option = page.getByRole('option', { name: label });
  await expect(option).toBeVisible({ timeout: 10000 });
  await option.click();
  // Wait for tax config combobox to become enabled
  const taxCombo = page.getByRole('combobox', { name: 'Tax configuration selector' });
  await expect(taxCombo).toBeEnabled({ timeout: 10000 });
}

test.describe('Admin/User Persona System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/');
  });

  test('should display login form when not authenticated', async ({ page }) => {
    await expect(page.locator('input[placeholder="Username"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  });

  test('admin can login and sees admin badge and benchmark editor', async ({ page }) => {
    await page.fill('input[placeholder="Username"]', 'admin');
    await page.fill('input[placeholder="Password"]', 'admin123');
    await page.click('button:has-text("Login")');

    // Check for admin-specific UI elements
    await expect(page.getByRole('button', { name: 'Benchmark Editor' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    // Check that the admin badge is present (using text 'Admin' with exact match case-sensitive)
    await expect(page.locator('text=Admin').first()).toBeVisible();
  });

  test('login with wrong credentials shows error', async ({ page }) => {
    await page.fill('input[placeholder="Username"]', 'admin');
    await page.fill('input[placeholder="Password"]', 'wrongpassword');
    await page.click('button:has-text("Login")');

    await expect(page.locator('text=Invalid credentials')).toBeVisible();
    await expect(page.locator('text=Admin')).not.toBeVisible();
  });

  test('logout returns to login form', async ({ page }) => {
    // Login first
    await page.fill('input[placeholder="Username"]', 'admin');
    await page.fill('input[placeholder="Password"]', 'admin123');
    await page.click('button:has-text("Login")');
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();

    // Logout
    await page.click('button:has-text("Logout")');
    await expect(page.locator('input[placeholder="Username"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).not.toBeVisible();
  });

  test('scenario selector shows templates and custom graphs after login', async ({ page }) => {
    await page.fill('input[placeholder="Username"]', 'admin');
    await page.fill('input[placeholder="Password"]', 'admin123');
    await page.click('button:has-text("Login")');

    // Wait for data to load
    await ensureDataLoaded(page);

    // Verify scenario combobox is visible and has options
    const combo = page.getByRole('combobox', { name: 'Scenario selector' });
    await expect(combo).toBeVisible();
    // Open to see options
    await combo.click();
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();
    const options = listbox.locator('[role="option"]');
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('tax config dropdown becomes enabled after selecting scenario and shows templates', async ({ page }) => {
    await page.fill('input[placeholder="Username"]', 'admin');
    await page.fill('input[placeholder="Password"]', 'admin123');
    await page.click('button:has-text("Login")');

    // Wait for data to load
    await ensureDataLoaded(page);

    // Initially, tax config combobox should be disabled
    const taxCombo = page.getByRole('combobox', { name: 'Tax configuration selector' });
    await expect(taxCombo).toBeDisabled();

    // Select a scenario to enable tax config
    await selectScenario(page, 'Generic Median Family - 2A 2C');

    // Now tax config should be enabled
    await expect(taxCombo).toBeEnabled();

    // Open tax config dropdown and verify expected option exists
    await taxCombo.click();
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();
    const option = listbox.getByRole('option', { name: 'DE (1.0)' });
    await expect(option).toBeVisible();
  });

  test('benchmark editor button only visible to admin', async ({ page }) => {
    // Not logged in - button should not be visible
    await expect(page.getByRole('button', { name: 'Benchmark Editor' })).not.toBeVisible();

    // Login as admin
    await page.fill('input[placeholder="Username"]', 'admin');
    await page.fill('input[placeholder="Password"]', 'admin123');
    await page.click('button:has-text("Login")');

    await expect(page.getByRole('button', { name: 'Benchmark Editor' })).toBeVisible();
  });

  test('benchmark editor opens in modal', async ({ page }) => {
    await page.fill('input[placeholder="Username"]', 'admin');
    await page.fill('input[placeholder="Password"]', 'admin123');
    await page.click('button:has-text("Login")');

    // Wait for login to complete and data to load
    await ensureDataLoaded(page);

    await page.click('button:has-text("Benchmark Editor")');
    await expect(page.locator('text=Evaluation Benchmark Editor')).toBeVisible();

    // Close modal
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('text=Evaluation Benchmark Editor')).not.toBeVisible();
  });
});
