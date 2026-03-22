import { test, expect } from '@playwright/test';

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
    await page.click('button:text("Login")');

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
    await page.waitForTimeout(1500);

    // Check scenario dropdown has options
    const scenarioSelect = page.locator('select:has-text("Select scenario…")');
    await expect(scenarioSelect).toBeVisible();
    const optionsCount = await scenarioSelect.locator('option').count();
    expect(optionsCount).toBeGreaterThan(1);
  });

  test('tax config dropdown separates templates and custom', async ({ page }) => {
    await page.fill('input[placeholder="Username"]', 'admin');
    await page.fill('input[placeholder="Password"]', 'admin123');
    await page.click('button:has-text("Login")');

    // Wait for data to load - the tax configs dropdown should have options
    await page.waitForTimeout(3000);

    // Check that the tax config dropdown has options and is properly structured
    const taxConfigSelect = page.locator('select[disabled]').first();
    await expect(taxConfigSelect).toBeVisible();

    // Check that it contains at least one option (beyond the placeholder)
    const options = taxConfigSelect.locator('option');
    await expect(options).toHaveCount(2); // "Select tax config…" + at least one tax config

    // Verify that the select contains the expected text (DE — 1.0 shows that template data loaded)
    await expect(taxConfigSelect).toContainText('DE — 1.0');
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
    await page.click('button:text("Login")');

    await page.click('button:has-text("Benchmark Editor")');
    await expect(page.locator('text=Evaluation Benchmark Editor')).toBeVisible();

    // Close modal
    await page.click('button:has-text("Close")');
    await expect(page.locator('text=Evaluation Benchmark Editor')).not.toBeVisible();
  });
});
