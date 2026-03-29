import { test, expect } from '@playwright/test';
import { login, ensureDataLoaded, selectScenario, selectTaxConfig, createSourceNode, createTaxRule } from './helpers';

test.describe('Performance & Large Graphs', () => {
  test.setTimeout(180000); // Longer timeout for performance tests

  test('graph handles 20+ nodes without lag', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // Create multiple source nodes
    for (let i = 1; i <= 10; i++) {
      await createSourceNode(page, `Source Node ${i}`, i * 10000);
    }

    await page.waitForTimeout(200);

    // Create multiple tax rules
    for (let i = 1; i <= 10; i++) {
      await page.click('[data-testid="tax-rule-button"]');
      await page.waitForTimeout(200);

      const createNewTab = page.locator('[data-testid="create-new-rule-tab"]');
      if (await createNewTab.isVisible({ timeout: 1000 })) {
        await createNewTab.click();
      }

      await page.fill('[data-testid="rule-name-input"]', `Tax Rule ${i}`);
      // Reference first source node in all formulas for simplicity
      await page.fill('[data-testid="rule-formula-input"]', '$source_node_1 * 0.05');
      await page.click('[data-testid="create-rule-button"]');

      // Small pause to avoid overwhelming
      await page.waitForTimeout(200);
    }

    // Wait for all nodes to settle
    await page.waitForTimeout(200);

    // Verify all nodes exist
    for (let i = 1; i <= 10; i++) {
      const sourceNode = page.locator(`.node-widget:has([data-testid="node-title"]:text("Source Node ${i}"))`);
      await expect(sourceNode).toBeVisible();
      const ruleNode = page.locator(`.node-widget:has([data-testid="node-title"]:text("Tax Rule ${i}"))`);
      await expect(ruleNode).toBeVisible();
    }

    // Canvas should still be responsive
    const graphCanvas = page.locator('[data-testid="graph-canvas"]');
    await expect(graphCanvas).toBeVisible();
  });

  test('node operations remain responsive with many nodes', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // Build a graph with 15 nodes quickly
    for (let i = 1; i <= 7; i++) {
      await createSourceNode(page, `Source ${i}`, i * 5000);
      await page.waitForTimeout(200);
    }

    for (let i = 1; i <= 8; i++) {
      await page.click('[data-testid="tax-rule-button"]');
      await page.waitForTimeout(200);

      const createNewTab = page.locator('[data-testid="create-new-rule-tab"]');
      if (await createNewTab.isVisible({ timeout: 500 })) {
        await createNewTab.click();
      }

      await page.fill('[data-testid="rule-name-input"]', `Rule ${i}`);
      await page.fill('[data-testid="rule-formula-input"]', '$source_1 * 0.05');
      await page.click('[data-testid="create-rule-button"]');
      await page.waitForTimeout(200);
    }

    // Total should be 7 sources + 8 rules = 15 nodes (plus auto-generated from tax config)
    await page.waitForTimeout(200);

    // Perform additional operations: create another node
    const startTime = Date.now();
    await createTaxRule(page, 'Final Rule', '($rule_1 + $rule_2) * 1.1');
    const creationTime = Date.now() - startTime;

    // Node should be created reasonably quickly (< 3 seconds even on large graph)
    expect(creationTime).toBeLessThan(3000);
    const finalRuleNode = page.locator('.node-widget:has([data-testid="node-title"]:text("Final Rule"))');
    await expect(finalRuleNode).toBeVisible();

    // Zoom in/out should remain responsive
    const zoomBtn = page.locator('[data-testid="zoom-in-button"]');
    await expect(zoomBtn).toBeEnabled({ timeout: 5000 });
    await zoomBtn.click();
    await page.waitForTimeout(200); // Should not freeze

    const zoomDisplay = page.locator('[data-testid="zoom-level-display"]');
    const zoomLevel = await zoomDisplay.textContent();
    expect(zoomLevel).not.toBe('100%'); // Should have changed
  });

  test('graph with 30+ nodes loads and renders', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    await page.waitForTimeout(200);

    // Add 20 source nodes
    for (let i = 1; i <= 20; i++) {
      await createSourceNode(page, `Large Source ${i}`, i * 10000);
      if (i % 5 === 0) await page.waitForTimeout(200); // Batch pauses
    }

    // Add 15 tax rules
    for (let i = 1; i <= 15; i++) {
      await page.click('[data-testid="tax-rule-button"]');
      await page.waitForTimeout(200);

      const createNewTab = page.locator('[data-testid="create-new-rule-tab"]');
      if (await createNewTab.isVisible({ timeout: 500 })) {
        await createNewTab.click();
      }

      await page.fill('[data-testid="rule-name-input"]', `Large Rule ${i}`);
      await page.fill('[data-testid="rule-formula-input"]', `$large_source_1 * ${0.05 * i}`);
      await page.click('[data-testid="create-rule-button"]');
      if (i % 5 === 0) await page.waitForTimeout(200);
    }

    await page.waitForTimeout(200);

    // Spot-check some nodes exist
    const largeSource1 = page.locator('.node-widget:has([data-testid="node-title"]:text("Large Source 1"))');
    await expect(largeSource1).toBeVisible();
    const largeRule15 = page.locator('.node-widget:has([data-testid="node-title"]:text("Large Rule 15"))');
    await expect(largeRule15).toBeVisible();

    // Score should still compute
    const scoreBadge = page.locator('[data-testid="score-badge"]');
    const scoreText = await scoreBadge.textContent();
    expect(scoreText).toMatch(/\d+/);
  });
});
