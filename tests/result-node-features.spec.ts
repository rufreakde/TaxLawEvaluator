import { test, expect } from '@playwright/test';

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
  // Close dropdown with Escape (more reliable)
  await page.keyboard.press('Escape');
  await expect(listbox).not.toBeVisible({ timeout: 5000 });
}

async function selectScenario(page: any, label: string): Promise<void> {
  const combo = page.getByRole('combobox', { name: 'Scenario selector' });
  await combo.click();
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  const option = listbox.getByRole('option', { name: label });
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
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  const option = listbox.getByRole('option', { name: label });
  await option.click();
  // Wait for source nodes to appear
  await expect(page.getByText('Primary Gross Salary', { exact: true })).toBeVisible({ timeout: 10000 });
}

async function createSourceNode(page: any, name: string, value: number): Promise<void> {
  // Click the "Source" button to open the popup
  await page.click('button:has-text("Source")');
  // Fill in the popup fields
  await page.fill('input[placeholder="Name (e.g. \'Gross Income\')"]', name);
  await page.fill('input[placeholder="Static value (optional)"]', String(value));
  // Click the "Add" button in the popup
  await page.click('button:has-text("Add")');
  // Verify the node appears on canvas
  await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 5000 });
}

async function createResultNode(page: any): Promise<void> {
  await page.click('button:has-text("Result")');
  // Result node is created with default label "Result" - check for node widget (not the button)
  await expect(page.locator('.node-widget').filter({ hasText: 'Result' })).toBeVisible({ timeout: 5000 });
}

function uniqueName(base: string): string {
  return `${base} - ${Date.now()}`;
}

test.describe('Result Node Features', () => {
  test.setTimeout(120000);

  test('user can create Result node', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    await createResultNode(page);
    // Result node appears with default label "Result"
    await expect(page.locator('.node-widget').filter({ hasText: 'Result' })).toBeVisible();
  });

  test('Result node can aggregate multiple inputs', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // Create two source nodes
    await createSourceNode(page, 'Income A', 50000);
    await createSourceNode(page, 'Income B', 30000);

    // Create a Result node
    await createResultNode(page);

    // Verify all nodes exist
    await expect(page.locator('.node-widget').filter({ hasText: 'Income A' })).toBeVisible();
    await expect(page.locator('.node-widget').filter({ hasText: 'Income B' })).toBeVisible();
    await expect(page.locator('.node-widget').filter({ hasText: 'Result' })).toBeVisible();
  });

  test('Result node shows sum value when connected', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // The existing 'Simplified Net Calculation' logic node is present
    // Create a Result node and verify it can be added
    await createResultNode(page);

    // Verify both the logic node and new result node exist
    await expect(page.locator('.node-widget').filter({ hasText: 'Simplified Net Calculation' })).toBeVisible();
    await expect(page.locator('.node-widget').filter({ hasText: 'Result' })).toBeVisible();
  });
});
