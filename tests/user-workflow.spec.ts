import { test, expect } from '@playwright/test';

// Helper to generate unique names to avoid conflicts
function uniqueName(base: string): string {
  return `${base} - ${Date.now()}`;
}

// Helper functions
async function login(page: any, username: string, password: string): Promise<void> {
  await page.goto('http://localhost:5173/');
  await page.fill('input[placeholder="Username"]', username);
  await page.fill('input[placeholder="Password"]', password);
  // Ensure the Login button is enabled before clicking
  await expect(page.getByRole('button', { name: 'Login' })).toBeEnabled({ timeout: 10000 });
  await page.click('button:has-text("Login")');
  // Wait for login to complete — look for logout button or error
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible({ timeout: 10000 }).catch(() => {
    throw new Error('Login failed - logout button not visible');
  });
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
  await expect(option).toBeVisible();
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
  await expect(option).toBeVisible();
  await option.click();
  // Wait for auto-generated source nodes and at least one logic node to appear
  await expect(page.getByText('Primary Gross Salary', { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Simplified Net Calculation', { exact: true })).toBeVisible({ timeout: 10000 });
}

async function createSourceNode(page: any, name: string, value: number): Promise<void> {
  // Click the "Source" button to open the popup
  await page.click('button:has-text("Source")');
  // Fill in the popup fields
  await page.fill('input[placeholder="Name (e.g. \'Gross Income\')"]', name);
  await page.fill('input[placeholder="Static value (optional)"]', String(value));
  // Click the "Add" button in the popup
  await page.click('button:has-text("Add")');
  // Wait for node to appear on canvas
  await expect(page.locator('.node-widget').filter({ hasText: name })).toBeVisible({ timeout: 5000 });
}

async function createTaxRule(page: any, name: string, formula: string): Promise<void> {
  // Click the "Tax Rule" button to open the popup
  await page.click('button:has-text("Tax Rule")');
  // The popup opens with "Existing Rules" tab; we need to switch to "Create New" if we want a new rule
  // However, existing tests create via the "New rule" tab. But the UI currently auto-creates rules as nodes from existing rules.
  // Wait, the UI shows a popup with two tabs: "Existing Rules" and "Create New" (if admin). For creating a new rule, we need to use "Create New" tab.
  // Check if "Create New" tab exists and click it
  const createNewBtn = page.locator('button:has-text("Create New")');
  if (await createNewBtn.isVisible({ timeout: 2000 })) {
    await createNewBtn.click();
  } else {
    // If no Create New tab, maybe already on create? Or admin not allowed? We'll try to find inputs anyway.
  }
  // Fill in rule details
  await expect(page.locator('input[placeholder="e.g. \'Tax Bracket 1\'"]')).toBeVisible({ timeout: 5000 });
  await page.fill('input[placeholder="e.g. \'Tax Bracket 1\'"]', name);
  await page.fill('input[placeholder="e.g. $a * 0.10 (use $ for variable references)"]', formula);
  // Click "Create & Add Rule" button
  await page.click('button:has-text("Create & Add Rule")');
  // Wait for node to appear on canvas
  await expect(page.locator('.node-widget').filter({ hasText: name })).toBeVisible({ timeout: 15000 });
}

async function saveScenario(page: any, name: string): Promise<void> {
  // Fill scenario name
  await page.fill('input[placeholder="Scenario name…"]', name);
  // Click the Save button for scenario using its title attribute
  const saveButton = page.locator('button[title*="scenario"]');
  await saveButton.click();
  await page.waitForTimeout(1000);
}

async function saveTaxLaw(page: any, name: string): Promise<void> {
  // Fill tax law name
  await page.fill('input[placeholder="Law name…"]', name);
  // Click the Save button for tax law using its title attribute
  const saveButton = page.locator('button[title*="tax law"]');
  await saveButton.click();
  await page.waitForTimeout(1000);
}

async function ensureGraphSavedAndLoadable(page: any, graphName: string): Promise<void> {
  // Save the tax law (assuming rule already created)
  await saveTaxLaw(page, graphName);
  // Reload to get fresh dropdown list from server
  await page.reload();
  // Wait for page to load and data to populate
  await page.waitForLoadState('networkidle');
  await ensureDataLoaded(page);
  // Optionally wait for user to be loaded (logout button visible)
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  // Select a scenario to enable the tax config dropdown
  await selectScenario(page, 'Generic Median Family - 2A 2C');
  const taxCombo = page.getByRole('combobox', { name: 'Tax configuration selector' });
  await expect(taxCombo).toBeEnabled();
  // Wait for the custom graph option to appear in the dropdown
  await taxCombo.click();
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  const graphOption = listbox.getByRole('option', { name: graphName });
  await expect(graphOption).toBeVisible({ timeout: 10000 });
  // Now select the saved custom graph
  await graphOption.click();
  // Wait for graph to be loaded and node to appear
  await page.waitForTimeout(5000);
}

test.describe.serial('User Persona Workflow', () => {
  // Set a longer timeout for all tests in this suite
  (test as any).setTimeout(120000);

  test('successful login', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    // Verify admin badge and logout button
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    await expect(page.locator('text=Admin').first()).toBeVisible();
  });

  test('login fails with incorrect password', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.fill('input[placeholder="Username"]', 'admin');
    await page.fill('input[placeholder="Password"]', 'wrongpassword');
    await page.click('button:has-text("Login")');
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).not.toBeVisible();
  });

  test('user can choose tax and scenario sets', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);

    // Select the known scenario
    await selectScenario(page, 'Generic Median Family - 2A 2C');

    // Tax config dropdown should be enabled now
    const taxCombo = page.getByRole('combobox', { name: 'Tax configuration selector' });
    await expect(taxCombo).toBeEnabled();

    // Select the tax config
    await selectTaxConfig(page, 'DE (1.0)');

    // Verify source nodes (from tax inputs) are present
    await expect(page.getByText('Primary Gross Salary', { exact: true })).toBeVisible();
    await expect(page.getByText('Secondary Gross Salary', { exact: true })).toBeVisible();
    await expect(page.getByText('Tax Free Allowance', { exact: true })).toBeVisible();

    // Verify existing logic nodes (from tax rules) are present
    await expect(page.getByText('Simplified Net Calculation', { exact: true })).toBeVisible();
    await expect(page.getByText('Social Security Contribution', { exact: true })).toBeVisible();
    await expect(page.getByText('Taxable Base', { exact: true })).toBeVisible();
  });

  test('user can create a new scenario with custom source nodes', async ({ page }) => {
    const customScenarioName = uniqueName('Custom Scenario');
    const sourceNodeName = 'Bonus Payment';

    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // Create a custom source node
    await createSourceNode(page, sourceNodeName, 3000);

    // Save the scenario graph
    await saveScenario(page, customScenarioName);

    // Reload and verify the custom scenario can be selected
    await page.reload();
    await page.waitForLoadState('networkidle');
    await ensureDataLoaded(page);

    // Select the custom scenario (this will also verify the option exists)
    await selectScenario(page, customScenarioName);

    // Verify the custom source node appears
    await expect(page.locator('.node-widget').filter({ hasText: sourceNodeName })).toBeVisible();
  });

  test('user can create a new tax rule', async ({ page }) => {
    const ruleName = uniqueName('Additional Rule');

    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // Create a new tax rule via the UI
    await createTaxRule(page, ruleName, '$a * 0.05');

    // Verify the logic node appears on the canvas
    await expect(page.locator('.node-widget').filter({ hasText: ruleName })).toBeVisible();
  });

  test('user can create a complex tax with multiple formularules', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // Create a set of three rules that build on each other
    await createTaxRule(page, 'Taxable Income', '($a + $b) - $c');
    await createTaxRule(page, 'Federal Tax', '$taxable_income * 0.20');
    await createTaxRule(page, 'Municipal Surcharge', '$federal_tax * 0.10');

    // Wait for auto-placement and connections
    await page.waitForTimeout(2000);

    // All nodes should be visible
    await expect(page.locator('.node-widget').filter({ hasText: 'Taxable Income' })).toBeVisible();
    await expect(page.locator('.node-widget').filter({ hasText: 'Federal Tax' })).toBeVisible();
    await expect(page.locator('.node-widget').filter({ hasText: 'Municipal Surcharge' })).toBeVisible();
  });

  test('user can save and load a tax law graph', async ({ page }) => {
    const taxLawName = uniqueName('My Custom Tax Law');
    const customRuleName = 'Custom Surcharge';

    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // Create a custom tax rule
    await createTaxRule(page, customRuleName, '$a * 0.03');

    // Save the tax law graph
    await ensureGraphSavedAndLoadable(page, taxLawName);

    // After selecting the saved graph, verify the custom rule node is present
    await expect(page.locator('.node-widget').filter({ hasText: customRuleName })).toBeVisible();
  });
});
