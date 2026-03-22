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
  // Wait for the scenario and tax config dropdowns to be populated
  await page.waitForTimeout(1000);
  const scenarioSelect = page.locator('select:has-text("Select scenario…")');
  await expect(scenarioSelect).toBeVisible();
  // Ensure at least one template scenario is available besides placeholder
  const options = scenarioSelect.locator('option');
  const count = await options.count();
  expect(count).toBeGreaterThan(1);
}

async function selectScenario(page: any, label: string): Promise<void> {
  const select = page.locator('select:has-text("Select scenario…")');
  await select.selectOption({ label });
  // Wait for the tax config dropdown to become enabled (after activeScenarioId is set)
  const taxSelect = page.locator('select:has-text("Select tax config…")');
  await expect(taxSelect).toBeEnabled({ timeout: 10000 });
}

async function selectTaxConfig(page: any, label: string): Promise<void> {
  const select = page.locator('select:has-text("Select tax config…")');
  // Ensure the dropdown is enabled
  await expect(select).toBeEnabled({ timeout: 10000 });
  await select.selectOption({ label });
  // Wait for auto-generated source nodes and at least one logic node (Simplified Net Calculation) to appear
  await expect(page.getByText('Primary Gross Salary', { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Simplified Net Calculation', { exact: true })).toBeVisible({ timeout: 10000 });
}

async function createSourceNode(page: any, name: string, value: number): Promise<void> {
  await page.click('button:has-text("New Source")');
  await page.waitForTimeout(300);
  await page.fill('input[placeholder="Name"]', name);
  await page.fill('input[placeholder="Value"]', String(value));
  await page.click('button:has-text("+ Source")');
  // Wait for node to appear on canvas
  await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 5000 });
}

async function createTaxRule(page: any, name: string, formula: string, defaultSource: string = ''): Promise<void> {
  const newTaxBtn = page.locator('button:has-text("New Tax")');
  await newTaxBtn.click({ timeout: 15000 });
  // Wait for the popup to appear with the "New rule" tab
  await expect(page.locator('button:has-text("New rule")')).toBeVisible({ timeout: 5000 });
  await page.click('button:has-text("New rule")');
  // Ensure the form fields are visible
  await expect(page.locator('input[placeholder="Name"]')).toBeVisible({ timeout: 5000 });
  await page.fill('input[placeholder="Name"]', name);
  await page.fill('input[placeholder="Formula (e.g. $a * 0.10)"]', formula);
  if (defaultSource) {
    await page.fill('input[placeholder="Default Source"]', defaultSource);
  }
  // Wait for the API call that saves the rule
  const ruleSavePromise = page.waitForResponse(
    /\/api\/v1\/tax-configs\/\d+\/rules$/,
    { status: 201 }
  );
  await page.click('button:has-text("Save")');
  const response = await ruleSavePromise;
  // Ensure response is ok (should be 201)
  if (!response.ok()) {
    throw new Error(`Failed to create tax rule: ${response.status()} ${response.statusText()}`);
  }
  // Wait for node to appear (use first since there might be hidden duplicates in DOM)
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible({ timeout: 15000 });
  // Ensure the New Tax button is enabled again for further operations
  await expect(page.locator('button:has-text("New Tax")')).toBeEnabled({ timeout: 10000 });
}

async function saveScenario(page: any, name: string): Promise<void> {
  await page.fill('input[placeholder="Scenario name…"]', name);
  await page.click('button:has-text("Save Scenario")');
  // Wait a bit for the API call to complete
  await page.waitForTimeout(1000);
}

async function saveTaxLaw(page: any, name: string): Promise<void> {
  await page.fill('input[placeholder="Law name…"]', name);
  await page.click('button:has-text("Save Tax Law")');
  await page.waitForTimeout(1000);
}

async function ensureGraphSavedAndLoadable(page: any, graphName: string): Promise<void> {
  // Save (assuming rule already created)
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
  const taxSelect = page.locator('select:has-text("Select tax config…")');
  await expect(taxSelect).toBeEnabled();
  // Wait for the custom graph option to appear in the dropdown
  const graphOption = taxSelect.locator('option').filter({ hasText: graphName });
  await expect(graphOption).toHaveCount(1, { timeout: 10000 });
  // Now select the saved custom graph
  await taxSelect.selectOption({ label: graphName });
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
    const taxSelect = page.locator('select:has-text("Select tax config…")');
    await expect(taxSelect).toBeEnabled();

    // Select the tax config
    await selectTaxConfig(page, 'DE — 1.0');

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
    await selectTaxConfig(page, 'DE — 1.0');

    // Create a custom source node
    await createSourceNode(page, sourceNodeName, 3000);

    // Save the scenario graph
    await saveScenario(page, customScenarioName);

    // Reload to verify the custom scenario appears in the dropdown
    await page.reload();
    await page.waitForLoadState('networkidle');
    await ensureDataLoaded(page);

    const scenarioSelect = page.locator('select:has-text("Select scenario…")');
    // The custom scenario should be listed as an option
    const option = scenarioSelect.locator('option').filter({ hasText: customScenarioName });
    await expect(option).toHaveCount(1);

    // Additionally, selecting it should show the custom source node again
    await selectScenario(page, customScenarioName);
    await expect(page.getByText(sourceNodeName)).toBeVisible();
  });

  test('user can create a new tax rule', async ({ page }) => {
    const ruleName = uniqueName('Additional Rule');

    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE — 1.0');

    // Create a new tax rule via the UI
    await createTaxRule(page, ruleName, '$a * 0.05');

    // Verify the logic node appears on the canvas
    await expect(page.getByText(ruleName)).toBeVisible();
  });

  test('user can create a complex tax with multiple formularules', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE — 1.0');

    // Create a set of three rules that build on each other
    await createTaxRule(page, 'Taxable Income', '($a + $b) - $c');
    await createTaxRule(page, 'Federal Tax', '$taxable_income * 0.20');
    await createTaxRule(page, 'Municipal Surcharge', '$federal_tax * 0.10');

    // Wait for auto-placement and connections
    await page.waitForTimeout(2000);

    // All nodes should be visible
    await expect(page.getByText('Taxable Income')).toBeVisible();
    await expect(page.getByText('Federal Tax')).toBeVisible();
    await expect(page.getByText('Municipal Surcharge')).toBeVisible();
  });

  test('user can save and load a tax law graph', async ({ page }) => {
    const taxLawName = uniqueName('My Custom Tax Law');
    const customRuleName = 'Custom Surcharge';

    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE — 1.0');

    // Create a custom tax rule
    await createTaxRule(page, customRuleName, '$a * 0.03');

    // Save the tax law graph
    await ensureGraphSavedAndLoadable(page, taxLawName);

    // After selecting the saved graph, verify the custom rule node is present
    await expect(page.getByText(customRuleName)).toBeVisible();
  });
});
