import { test, expect } from '@playwright/test';
import { login, ensureDataLoaded, selectScenario, selectTaxConfig, createSourceNode } from './helpers';

test.describe('YAML Preview Tooltips', () => {
  test('should show scenario YAML preview on help icon hover', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // Find the scenario help icon using test ID
    const scenarioHelpIcon = page.locator('[data-testid="scenario-help-icon"]').first();
    await expect(scenarioHelpIcon).toBeVisible();

    // Hover over the help icon
    await scenarioHelpIcon.hover();

    // Wait for tooltip to appear
    const scenarioTooltip = page.locator('text="Scenario YAML"').first();
    await expect(scenarioTooltip).toBeVisible();

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

    // Find the tax law help icon using test ID
    const taxLawHelpIcon = page.locator('[data-testid="tax-law-help-icon"]').first();
    await expect(taxLawHelpIcon).toBeVisible();

    // Hover over the tax law help icon
    await taxLawHelpIcon.hover();

    // Wait for tooltip to appear
    const taxLawTooltip = page.locator('text="Tax Law YAML"').first();
    await expect(taxLawTooltip).toBeVisible();

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

    // Add a custom source node using helper (uses test IDs)
    await createSourceNode(page, 'Test Bonus', 5000);

    // Hover over scenario help icon
    const scenarioHelpIcon = page.locator('[data-testid="scenario-help-icon"]').first();
    await scenarioHelpIcon.hover();

    const tooltipContent = page.locator('text=/Scenario YAML/').locator('xpath=following::pre[1]');
    await expect(tooltipContent).toBeVisible();

    const yamlText = await tooltipContent.textContent();
    // Should contain the custom node
    expect(yamlText).toContain('Test Bonus');
    expect(yamlText).toContain('5000');
  });
});
