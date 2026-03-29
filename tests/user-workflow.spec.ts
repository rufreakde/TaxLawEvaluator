import { test, expect } from '@playwright/test';
import { login, ensureDataLoaded, selectScenario, selectTaxConfig, createSourceNode, createTaxRule, saveScenarioToFile, saveTaxLawToFile, saveAndLoadTaxLawGraph, uniqueName } from './helpers';

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
    await page.fill('[data-testid="username-input"]', 'admin');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');
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
    await expect(taxCombo).toBeEnabled({ timeout: 5000 });

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
    await saveScenarioToFile(page, customScenarioName);

    // Reload and verify the custom scenario can be selected
    await page.reload();
    await page.waitForLoadState('networkidle');
    await ensureDataLoaded(page);

    // Select the custom scenario (this will also verify the option exists)
    await selectScenario(page, customScenarioName);

    // Verify the custom source node appears
    const sourceNode = page.locator(`.node-widget:has([data-testid="node-title"]:text("${sourceNodeName}"))`);
    await expect(sourceNode).toBeVisible();
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
    const ruleNode = page.locator(`.node-widget:has([data-testid="node-title"]:text("${ruleName}"))`);
    await expect(ruleNode).toBeVisible();
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
    await page.waitForTimeout(200);

    // All nodes should be visible
    const node1 = page.locator('.node-widget:has([data-testid="node-title"]:text("Taxable Income"))');
    const node2 = page.locator('.node-widget:has([data-testid="node-title"]:text("Federal Tax"))');
    const node3 = page.locator('.node-widget:has([data-testid="node-title"]:text("Municipal Surcharge"))');
    await expect(node1).toBeVisible();
    await expect(node2).toBeVisible();
    await expect(node3).toBeVisible();
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

    // Save and reload the tax law graph
    await saveAndLoadTaxLawGraph(page, taxLawName);

    // After selecting the saved graph, verify the custom rule node is present
    const customNode = page.locator(`.node-widget:has([data-testid="node-title"]:text("${customRuleName}"))`);
    await expect(customNode).toBeVisible();
  });
});
