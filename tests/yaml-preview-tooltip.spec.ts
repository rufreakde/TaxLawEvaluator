import { test, expect } from '@playwright/test';

async function login(page: any, username: string, password: string): Promise<void> {
  await page.goto('http://localhost:5173/');
  await page.fill('input[placeholder="Username"]', username);
  await page.fill('input[placeholder="Password"]', password);
  await expect(page.getByRole('button', { name: 'Login' })).toBeEnabled({ timeout: 10000 });
  await page.click('button:has-text("Login")');
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
  // Close dropdown
  await page.click('body', { position: { x: 10, y: 10 } });
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
  const combo = page.getByRole('combobox', { name: 'Select a tax law…' });
  // Ensure the tax config combobox is enabled
  await expect(combo).toBeEnabled({ timeout: 10000 });
  await combo.click();
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  const option = listbox.getByRole('option', { name: label });
  await option.click();
  // Wait for auto-generated source nodes to appear
  await expect(page.getByText('Primary Gross Salary', { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Simplified Net Calculation', { exact: true })).toBeVisible({ timeout: 10000 });
}

test.describe('YAML Preview Tooltips', () => {
  test('should show scenario YAML preview on help icon hover', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // Find the scenario help icon (HelpCircle next to the "Scenario name…" input)
    const scenarioHelpIcon = page.locator('button[title="What data will be saved?"]').first();
    await expect(scenarioHelpIcon).toBeVisible();

    // Hover over the help icon
    await scenarioHelpIcon.hover();

    // Wait for tooltip to appear
    const scenarioTooltip = page.locator('text="Scenario YAML"').first();
    await expect(scenarioTooltip).toBeVisible({ timeout: 5000 });

    // Verify tooltip content includes expected YAML keys
    const tooltipContent = page.locator('text=/Scenario YAML/').locator('xpath=following::pre[1]');
    await expect(tooltipContent).toBeVisible();

    // Check that the YAML contains expected fields
    const yamlText = await tooltipContent.textContent();
    expect(yamlText).toContain('name:');
    expect(yamlText).toContain('taxConfigId:');
    expect(yamlText).toContain('nodes:');
    expect(yamlText).toContain('nodeId:');
    expect(yamlText).toContain('inputId:');
    expect(yamlText).toContain('label:');
    expect(yamlText).toContain('version:');

    // Should NOT show "No scenario graph loaded"
    expect(yamlText).not.toContain('No scenario graph loaded');
  });

  test('should show tax law YAML preview on help icon hover', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // Find the tax law help icon (second HelpCircle)
    const helpIcons = page.locator('button[title="What data will be saved?"]');
    await expect(helpIcons).toHaveCount(2);
    const taxLawHelpIcon = helpIcons.nth(1);
    await expect(taxLawHelpIcon).toBeVisible();

    // Hover over the tax law help icon
    await taxLawHelpIcon.hover();

    // Wait for tooltip to appear
    const taxLawTooltip = page.locator('text="Tax Law YAML"').first();
    await expect(taxLawTooltip).toBeVisible({ timeout: 5000 });

    // Verify tooltip content includes expected YAML keys
    const tooltipContent = page.locator('text=/Tax Law YAML/').locator('xpath=following::pre[1]');
    await expect(tooltipContent).toBeVisible();

    const yamlText = await tooltipContent.textContent();
    expect(yamlText).toContain('name:');
    expect(yamlText).toContain('taxConfigId:');
    expect(yamlText).toContain('nodes:');
    expect(yamlText).toContain('links:');
    expect(yamlText).toContain('nodeId:');
    expect(yamlText).toContain('ruleId:');
    expect(yamlText).toContain('ruleName:');
    expect(yamlText).toContain('version:');

    // Should NOT show "No tax law graph loaded"
    expect(yamlText).not.toContain('No tax law graph loaded');
    expect(yamlText).not.toContain('No graph loaded');
  });

  test('scenario YAML should update when nodes are added', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // Add a custom source node
    await page.click('button:has-text("New Source")');
    await page.waitForTimeout(300);
    await page.fill('input[placeholder="Name"]', 'Test Bonus');
    await page.fill('input[placeholder="Value"]', '5000');
    await page.click('button:has-text("+ Source")');
    await expect(page.getByText('Test Bonus', { exact: true })).toBeVisible({ timeout: 5000 });

    // Hover over scenario help icon
    const scenarioHelpIcon = page.locator('button[title="What data will be saved?"]').first();
    await scenarioHelpIcon.hover();

    const tooltipContent = page.locator('text=/Scenario YAML/').locator('xpath=following::pre[1]');
    await expect(tooltipContent).toBeVisible({ timeout: 5000 });

    const yamlText = await tooltipContent.textContent();
    // Should contain the custom node
    expect(yamlText).toContain('Test Bonus');
    expect(yamlText).toContain('5000');
  });
});
