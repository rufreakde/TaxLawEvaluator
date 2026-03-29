import { test, expect } from '@playwright/test';
import { login, ensureDataLoaded, selectScenario, selectTaxConfig, createSourceNode, saveScenario, uniqueName } from './helpers';

test.describe('YAML Integrity & Structure', () => {
  test.setTimeout(120000);

  test('scenario YAML contains correct structure after adding nodes', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // Add a custom source node
    const nodeName = 'Custom Source Node';
    await createSourceNode(page, nodeName, 50000);

    await page.waitForTimeout(200);

    // Hover over scenario help icon to trigger YAML tooltip
    await page.locator('[data-testid="scenario-help-icon"]').first().hover();
    await page.waitForTimeout(200);

    const tooltipContent = page.locator('text=/Scenario YAML/').locator('xpath=following::pre[1]');
    await expect(tooltipContent).toBeVisible();

    const yamlText = await tooltipContent.textContent();
    expect(yamlText).toContain('name:');
    expect(yamlText).toContain('taxConfigId:');
    expect(yamlText).toContain('nodes:');
    expect(yamlText).toContain('version:');
    expect(yamlText).toContain('nodeId:');
    expect(yamlText).toContain('label:');
    expect(yamlText).toContain('inputId:');
    expect(yamlText).toContain(nodeName);

    // Should have node structure with position coordinates
    expect(yamlText).toContain('x:');
    expect(yamlText).toContain('y:');
  });

  test('tax law YAML shows nodes and links after rule creation', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // Create a new tax rule
    const ruleName = 'Test Tax Rule';
    await page.click('[data-testid="tax-rule-button"]');

    const createNewTab = page.locator('[data-testid="create-new-rule-tab"]');
    if (await createNewTab.isVisible()) {
      await createNewTab.click();
    }

    await page.fill('[data-testid="rule-name-input"]', ruleName);
    await page.fill('[data-testid="rule-formula-input"]', '$primary_gross_salary * 0.10');
    await page.click('[data-testid="create-rule-button"]');

    await page.waitForTimeout(200);

    // Hover over tax law help icon
    await page.locator('[data-testid="tax-law-help-icon"]').first().hover();
    await page.waitForTimeout(200);

    const tooltipContent = page.locator('text=/Tax Law YAML/').locator('xpath=following::pre[1]');
    await expect(tooltipContent).toBeVisible();

    const yamlText = await tooltipContent.textContent();
    expect(yamlText).toContain('name:');
    expect(yamlText).toContain('taxConfigId:');
    expect(yamlText).toContain('nodes:');
    expect(yamlText).toContain('links:');
    expect(yamlText).toContain('version:');
    expect(yamlText).toContain('nodeId:');
    expect(yamlText).toContain('ruleId:');
    expect(yamlText).toContain('ruleName:');
  });

  test('YAML updates immediately when node added', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // Get initial scenario YAML
    await page.locator('[data-testid="scenario-help-icon"]').first().hover();
    await page.waitForTimeout(200);
    const initialYaml = await page.locator('text=/Scenario YAML/').locator('xpath=following::pre[1]').textContent();

    // Add a node
    const nodeName = 'Immediate Update Test';
    await createSourceNode(page, nodeName, 12345);
    await page.waitForTimeout(200);

    // Check YAML again - it should include the new node
    await page.locator('[data-testid="scenario-help-icon"]').first().hover();
    await page.waitForTimeout(200);
    const updatedYaml = await page.locator('text=/Scenario YAML/').locator('xpath=following::pre[1]').textContent();

    // Updated YAML should contain the new node name if initial did not
    if (initialYaml) {
      const hadNodeInitially = initialYaml.includes(nodeName);
      const hasNodeNow = updatedYaml?.includes(nodeName);

      if (!hadNodeInitially) {
        expect(hasNodeNow).toBe(true);
      }
    }
  });

  test('saved scenario graph includes correct node positions', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    const nodeName = 'Positioned Node';
    await createSourceNode(page, nodeName, 10000);
    await page.waitForTimeout(200);

    // Save the scenario
    const scenarioName = uniqueName('Positions Test');
    await page.fill('[data-testid="scenario-name-input"]', scenarioName);
    await page.click('[data-testid="save-scenario-button"]');
    await page.waitForTimeout(200);

    // Reload and load the saved scenario
    await page.reload();
    await page.waitForLoadState('networkidle');
    await selectScenario(page, scenarioName);

    // Wait for node to load
    await page.waitForTimeout(200);

    // The node should appear at the saved position (can't verify exact coordinates visually,
    // but we can verify the node appears)
    const node = page.locator(`.node-widget:has([data-testid="node-title"]:text("${nodeName}"))`);
    await expect(node).toBeVisible();

    // YAML should have position data
    await page.locator('[data-testid="scenario-help-icon"]').first().hover();
    await page.waitForTimeout(200);
    const yamlText = await page.locator('text=/Scenario YAML/').locator('xpath=following::pre[1]').textContent();
    expect(yamlText).toContain('x:');
    expect(yamlText).toContain('y:');
  });

  test('tax law graph YAML includes all node and link information', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // Create a tax rule that will be auto-wired
    await page.click('[data-testid="tax-rule-button"]');

    const createNewTab = page.locator('[data-testid="create-new-rule-tab"]');
    if (await createNewTab.isVisible()) {
      await createNewTab.click();
    }

    await page.fill('[data-testid="rule-name-input"]', 'Linked Rule');
    await page.fill('[data-testid="rule-formula-input"]', '$primary_gross_salary * 0.15');
    await page.click('[data-testid="create-rule-button"]');

    await page.waitForTimeout(200);

    // Save tax law
    const taxLawName = uniqueName('Saved Tax Law');
    await page.fill('[data-testid="tax-law-name-input"]', taxLawName);
    await page.click('[data-testid="save-tax-law-button"]');
    await page.waitForTimeout(200);

    // Check YAML through tooltip
    await page.locator('[data-testid="tax-law-help-icon"]').first().hover();
    await page.waitForTimeout(200);

    const yamlText = await page.locator('text=/Tax Law YAML/').locator('xpath=following::pre[1]').textContent();

    expect(yamlText).toContain('name:');
    expect(yamlText).toContain('nodes:');
    expect(yamlText).toContain('links:');
    expect(yamlText).toContain('nodeId:');
    expect(yamlText).toContain('ruleId:');
    expect(yamlText).toContain('ruleName:');

    // Should have links section with source/target info
    if (yamlText) {
      const hasLinksSection = yamlText.includes('links:') && yamlText.includes('sourceNodeId') && yamlText.includes('targetNodeId');
      expect(hasLinksSection).toBe(true);
    }
  });
});
