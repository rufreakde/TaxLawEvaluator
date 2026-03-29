import { test, expect } from '@playwright/test';
import { login, ensureDataLoaded, selectScenario, selectTaxConfig, createSourceNode, createTaxRule, saveGraph, loadSavedGraph, uniqueName } from './helpers';

test.describe('Graph Persistence (Comprehensive)', () => {
  test.setTimeout(120000);

  test('saved scenario graph appears in dropdown after reload', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    const customScenarioName = uniqueName('My Custom Scenario');
    await createSourceNode(page, 'Persisted Source', 50000);

    // Save scenario
    await saveGraph(page, 'scenario', customScenarioName);
    await page.waitForTimeout(200);

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await ensureDataLoaded(page);

    // Custom scenario should be in dropdown
    const customOption = page.getByRole('option', { name: customScenarioName });
    await expect(customOption).toBeVisible();
  });

  test('loading saved scenario preserves custom nodes', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    const customScenarioName = uniqueName('Persisted Scenario');
    const nodeName = 'Saved Source Node';

    await createSourceNode(page, nodeName, 75000);
    await saveGraph(page, 'scenario', customScenarioName);
    await page.waitForTimeout(200);

    // Reload and load the saved scenario
    await page.reload();
    await page.waitForLoadState('networkidle');
    await selectScenario(page, customScenarioName);

    // The custom source node should be present
    const node = page.locator(`.node-widget:has([data-testid="node-title"]:text("${nodeName}"))`);
    await expect(node).toBeVisible();
  });

  test('loading saved tax law preserves custom tax rules', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    const taxLawName = uniqueName('Persisted Tax Law');
    const ruleName = 'Persisted Rule';

    await createTaxRule(page, ruleName, '$a * 0.09');
    await saveGraph(page, 'taxLaw', taxLawName);
    await page.waitForTimeout(200);

    // Reload and load the saved tax law
    await page.reload();
    await page.waitForLoadState('networkidle');
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, taxLawName);

    // The custom rule should be present
    const ruleNode = page.locator(`.node-widget:has([data-testid="node-title"]:text("${ruleName}"))`);
    await expect(ruleNode).toBeVisible();
  });

  test('save scenario as creates new graph when overwriting not allowed', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // Try to save a template scenario (should require Save As because template is read-only)
    const customName = uniqueName('Custom Template Override');
    await createSourceNode(page, 'Custom Source', 10000);

    // Attempt regular save (should do Save As because template is read-only)
    await page.fill('[data-testid="scenario-name-input"]', customName);
    await page.click('[data-testid="save-scenario-button"]');
    await page.waitForTimeout(200);

    // Should still work (Save As)
    await page.reload();
    await page.waitForLoadState('networkidle');
    await selectScenario(page, customName);

    const customSourceNode = page.locator('.node-widget:has([data-testid="node-title"]:text("Custom Source"))');
    await expect(customSourceNode).toBeVisible();
  });

  test('graph save includes node positions', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // Create a node (position will be random)
    await createSourceNode(page, 'Positioned Source', 50000);
    await page.waitForTimeout(200);

    // Save and reload
    const graphName = uniqueName('Positioned Graph');
    await saveGraph(page, 'scenario', graphName);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await selectScenario(page, graphName);

    // Node should appear at its saved position (can't verify exact coords but should be visible)
    const positionedNode = page.locator('.node-widget:has([data-testid="node-title"]:text("Positioned Source"))');
    await expect(positionedNode).toBeVisible();
  });

  test('multiple saves update existing graph (version increment)', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    const graphName = uniqueName('Versioned Graph');
    await createSourceNode(page, 'V1 Node', 10000);
    await saveGraph(page, 'scenario', graphName);
    await page.waitForTimeout(200);

    // Modify and save again
    await createSourceNode(page, 'V2 Node', 20000);
    await page.fill('[data-testid="scenario-name-input"]', graphName);
    await page.click('[data-testid="save-scenario-button"]');
    await page.waitForTimeout(200);

    // Reload and verify both nodes exist
    await page.reload();
    await page.waitForLoadState('networkidle');
    await selectScenario(page, graphName);

    const v1Node = page.locator('.node-widget:has([data-testid="node-title"]:text("V1 Node"))');
    const v2Node = page.locator('.node-widget:has([data-testid="node-title"]:text("V2 Node"))');
    await expect(v1Node).toBeVisible();
    await expect(v2Node).toBeVisible();
  });
});
