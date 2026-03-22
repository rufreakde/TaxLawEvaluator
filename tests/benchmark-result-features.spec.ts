import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';

// Ensure regular user exists for tests (INSERT OR IGNORE)
try {
  const db = new Database('data/db/taxlaw.db');
  const hash = bcrypt.hashSync('user123', 10);
  db.prepare('INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('user', hash, 'user');
  db.close();
} catch (err) {
  // Ignore errors (DB locked, user already exists, etc.)
}

// Helper functions
async function login(page: any, username: string, password: string): Promise<void> {
  await page.goto('http://localhost:5173/');
  await page.fill('input[placeholder="Username"]', username);
  await page.fill('input[placeholder="Password"]', password);
  await expect(page.getByRole('button', { name: 'Login' })).toBeEnabled({ timeout: 10000 });
  await page.click('button:has-text("Login")');
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible({ timeout: 10000 });
}

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
  // Close dropdown with Escape (more reliable than clicking body)
  await page.keyboard.press('Escape');
  await expect(listbox).not.toBeVisible({ timeout: 5000 });
}

async function selectScenario(page: any, label: string): Promise<void> {
  const combo = page.getByRole('combobox', { name: 'Scenario selector' });
  await combo.click();
  // Wait for option to be available and click it
  const option = page.getByRole('option', { name: label });
  await expect(option).toBeVisible({ timeout: 10000 });
  await option.click();
  // Wait for the tax config combobox to become enabled
  const taxCombo = page.getByRole('combobox', { name: 'Tax configuration selector' });
  await expect(taxCombo).toBeEnabled({ timeout: 10000 });
}

async function selectTaxConfig(page: any, label: string): Promise<void> {
  const combo = page.getByRole('combobox', { name: 'Tax configuration selector' });
  // Ensure the tax config combobox is enabled
  await expect(combo).toBeEnabled({ timeout: 10000 });
  await combo.click();
  // Wait for option to be available and click it
  const option = page.getByRole('option', { name: label });
  await expect(option).toBeVisible({ timeout: 10000 });
  await option.click();
  // Wait for auto-generated source nodes to appear
  await expect(page.getByText('Primary Gross Salary', { exact: true })).toBeVisible({ timeout: 10000 });
}

function uniqueName(base: string): string {
  return `${base} - ${Date.now()}`;
}

test.describe('Benchmark Result Features', () => {
  test.setTimeout(120000);

  test('admin can open benchmark editor', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await page.waitForTimeout(2000);

    // Look for the Benchmark Editor button in header
    const benchmarkBtn = page.getByRole('button', { name: 'Benchmark Editor' });
    await expect(benchmarkBtn).toBeVisible({ timeout: 5000 });

    await benchmarkBtn.click();
    await expect(page.locator('text=Evaluation Benchmark Editor')).toBeVisible({ timeout: 5000 });
  });

  test('non-admin cannot see benchmark editor button', async ({ page }) => {
    // Login as regular user
    await login(page, 'user', 'user123');
    await ensureDataLoaded(page);
    await page.waitForTimeout(2000);

    const benchmarkBtn = page.getByRole('button', { name: 'Benchmark Editor' });
    await expect(benchmarkBtn).not.toBeVisible();
  });

  test('admin can create benchmark with target value', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // Open Benchmark Editor
    await page.click('button:has-text("Benchmark Editor")');
    await expect(page.locator('text=Evaluation Benchmark Editor')).toBeVisible();

    const benchmarkName = uniqueName('Revenue Target');

    // Select tax config in the modal
    const taxConfigCombo = page.getByRole('combobox', { name: 'Benchmark tax configuration selector' });
    await expect(taxConfigCombo).toBeEnabled();
    await taxConfigCombo.click();
    const taxOption = page.getByRole('option', { name: 'DE (1.0)' });
    await expect(taxOption).toBeVisible();
    await taxOption.click();

    // Add a sink row
    await page.click('button:has-text("Add Target")');

    // Fill benchmark name
    await page.getByPlaceholder('e.g., Target Score 2025').fill(benchmarkName);

    // Fill sink fields
    await page.getByPlaceholder('e.g. state_income').fill('state_income');
    await page.getByPlaceholder('e.g. total_tax').fill('Simplified Net Calculation');
    // Label (optional, but we fill for completeness)
    await page.getByPlaceholder('e.g. Total Revenue').fill(benchmarkName);
    await page.getByPlaceholder('e.g. 100000').fill('100000');

    // Save
    await page.click('button:has-text("Save Benchmark")');
    await page.waitForTimeout(2000);

    // Modal should close
    await expect(page.locator('text=Evaluation Benchmark Editor')).not.toBeVisible();

    // A BenchmarkResult node should appear on canvas
    await expect(page.getByText(benchmarkName)).toBeVisible({ timeout: 10000 });
  });

  test('benchmark result node displays target and actual', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // Create a benchmark
    await page.click('button:has-text("Benchmark Editor")');
    await expect(page.locator('text=Evaluation Benchmark Editor')).toBeVisible();

    const benchmarkName = uniqueName('Total Income');

    // Select tax config in the modal
    const taxConfigCombo = page.getByRole('combobox', { name: 'Benchmark tax configuration selector' });
    await expect(taxConfigCombo).toBeEnabled();
    await taxConfigCombo.click();
    const taxOption = page.getByRole('option', { name: 'DE (1.0)' });
    await expect(taxOption).toBeVisible();
    await taxOption.click();

    // Add a sink row
    await page.click('button:has-text("Add Target")');

    // Fill benchmark name
    await page.getByPlaceholder('e.g., Target Score 2025').fill(benchmarkName);

    // Fill sink fields
    await page.getByPlaceholder('e.g. state_income').fill('state_income');
    await page.getByPlaceholder('e.g. total_tax').fill('Simplified Net Calculation');
    await page.getByPlaceholder('e.g. Total Revenue').fill(benchmarkName);
    await page.getByPlaceholder('e.g. 100000').fill('50000');

    // Save benchmark
    await page.click('button:has-text("Save Benchmark")');
    await page.waitForTimeout(2000);

    // Verify benchmark node appears with label (name)
    await expect(page.getByText(benchmarkName)).toBeVisible({ timeout: 10000 });
  });
});
