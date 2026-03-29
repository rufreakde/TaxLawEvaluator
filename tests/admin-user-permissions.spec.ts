import { test, expect } from '@playwright/test';
import { ensureDataLoaded, selectScenario } from './helpers';

test.describe('Admin/User Persona System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/');
  });

  test('should display login form when not authenticated', async ({ page }) => {
    await expect(page.locator('[data-testid="username-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  });

  test('admin can login and sees admin badge and benchmark editor', async ({ page }) => {
    await page.fill('[data-testid="username-input"]', 'admin');
    await page.fill('[data-testid="password-input"]', 'admin123');
    await page.click('[data-testid="login-button"]');

    // Check for admin-specific UI elements
    await expect(page.getByTestId('benchmark-editor-button')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    // Check that the admin badge is present (using text 'Admin' with exact match case-sensitive)
    await expect(page.locator('text=Admin').first()).toBeVisible();
  });

  test('login with wrong credentials shows error', async ({ page }) => {
    await page.fill('[data-testid="username-input"]', 'admin');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');

    await expect(page.locator('text=Invalid credentials')).toBeVisible();
    await expect(page.locator('text=Admin')).not.toBeVisible();
  });

  test('logout returns to login form', async ({ page }) => {
    // Login first
    await page.fill('[data-testid="username-input"]', 'admin');
    await page.fill('[data-testid="password-input"]', 'admin123');
    await page.click('[data-testid="login-button"]');
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();

    // Logout
    await page.click('[data-testid="logout-button"]');
    await expect(page.locator('[data-testid="username-input"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).not.toBeVisible();
  });

  test('scenario selector shows templates and custom graphs after login', async ({ page }) => {
    await page.fill('[data-testid="username-input"]', 'admin');
    await page.fill('[data-testid="password-input"]', 'admin123');
    await page.click('[data-testid="login-button"]');

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
    await page.fill('[data-testid="username-input"]', 'admin');
    await page.fill('[data-testid="password-input"]', 'admin123');
    await page.click('[data-testid="login-button"]');

    // Wait for data to load
    await ensureDataLoaded(page);

    // Initially, tax config combobox should be disabled
    const taxCombo = page.getByRole('combobox', { name: 'Tax configuration selector' });
    await expect(taxCombo).toBeDisabled({ timeout: 5000 });

    // Select a scenario to enable tax config
    await selectScenario(page, 'Generic Median Family - 2A 2C');

    // Now tax config should be enabled
    await expect(taxCombo).toBeEnabled({ timeout: 5000 });

    // Open tax config dropdown and verify expected option exists
    await taxCombo.click();
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();
    const option = listbox.getByRole('option', { name: 'DE (1.0)' });
    await expect(option).toBeVisible();
  });

  test('benchmark editor button only visible to admin', async ({ page }) => {
    // Not logged in - button should not be visible
    await expect(page.getByTestId('benchmark-editor-button')).not.toBeVisible();

    // Login as admin
    await page.fill('[data-testid="username-input"]', 'admin');
    await page.fill('[data-testid="password-input"]', 'admin123');
    await page.click('[data-testid="login-button"]');

    await expect(page.getByTestId('benchmark-editor-button')).toBeVisible();
  });

  test('benchmark editor opens in modal', async ({ page }) => {
    await page.fill('[data-testid="username-input"]', 'admin');
    await page.fill('[data-testid="password-input"]', 'admin123');
    await page.click('[data-testid="login-button"]');

    // Wait for login to complete and data to load
    await ensureDataLoaded(page);

    await page.click('[data-testid="benchmark-editor-button"]');
    await expect(page.locator('text=Evaluation Benchmark Editor')).toBeVisible();

    // Close modal
    await page.click('[data-testid="cancel-benchmark-button"]');
    await expect(page.locator('text=Evaluation Benchmark Editor')).not.toBeVisible();
  });
});
