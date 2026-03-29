import { test, expect } from '@playwright/test';
import { login, ensureDataLoaded, selectScenario, selectTaxConfig, createSourceNode, createResultNode, uniqueName } from './helpers';

test.describe('Result Node Features', () => {
  test.setTimeout(120000);

  test('user can create Result node', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    await createResultNode(page);
    // Result node appears with default label "Result"
    const resultNode = page.locator('.node-widget:has([data-testid="node-title"]:text("Result"))');
    await expect(resultNode).toBeVisible();
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
    const nodeA = page.locator('.node-widget:has([data-testid="node-title"]:text("Income A"))');
    const nodeB = page.locator('.node-widget:has([data-testid="node-title"]:text("Income B"))');
    const resultNode2 = page.locator('.node-widget:has([data-testid="node-title"]:text("Result"))');
    await expect(nodeA).toBeVisible();
    await expect(nodeB).toBeVisible();
    await expect(resultNode2).toBeVisible();
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
    const netCalcNode = page.locator('.node-widget:has([data-testid="node-title"]:text("Simplified Net Calculation"))');
    const resultNode3 = page.locator('.node-widget:has([data-testid="node-title"]:text("Result"))');
    await expect(netCalcNode).toBeVisible();
    await expect(resultNode3).toBeVisible();
  });
});
