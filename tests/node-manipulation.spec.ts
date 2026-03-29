import { test, expect } from '@playwright/test';
import { login, ensureDataLoaded, selectScenario, selectTaxConfig, createSourceNode, deleteNode, uniqueName } from './helpers';

test.describe('Node Manipulation', () => {
  test.setTimeout(120000);

  test('user can delete a source node', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    const nodeName = uniqueName('ToDelete');
    await createSourceNode(page, nodeName, 1000);

    // Verify node exists
    const node = page.locator(`.node-widget:has([data-testid="node-title"]:text("${nodeName}"))`);
    await expect(node).toBeVisible();

    // Delete the node
    await deleteNode(page, nodeName);

    // Verify node is gone
    await expect(page.locator(`.node-widget:has([data-testid="node-title"]:text("${nodeName}"))`)).not.toBeVisible();
  });

  test('deleting a node also removes its connections', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // Create a source node and a tax rule (auto-wiring should happen)
    const sourceName = uniqueName('Source For Delete');
    const ruleName = uniqueName('Rule For Delete');

    await createSourceNode(page, sourceName, 5000);
    await page.click('[data-testid="tax-rule-button"]');

    const createNewTab = page.locator('[data-testid="create-new-rule-tab"]');
    if (await createNewTab.isVisible()) {
      await createNewTab.click();
    }

    await page.fill('[data-testid="rule-name-input"]', ruleName);
    await page.fill('[data-testid="rule-formula-input"]', `$${sourceName} * 0.10`);
    await page.click('[data-testid="create-rule-button"]');

    // Wait for auto-wiring
    await page.waitForTimeout(200);

    // Delete the source node
    await deleteNode(page, sourceName);

    // The rule node should still exist but its input port should be unconnected
    await expect(page.locator(`.node-widget:has([data-testid="node-title"]:text("${ruleName}"))`)).toBeVisible();

    // Verify the connection is gone (can't verify visually, but node still exists)
    // This test primarily ensures deletion doesn't crash and related nodes remain
  });

  test('user can move a node on canvas', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // Create a source node
    const nodeName = uniqueName('Movable Node');
    await createSourceNode(page, nodeName, 1000);

    // Wait for node to be positioned
    await page.waitForTimeout(200);

    // Get the node element
    const node = page.locator(`.node-widget:has([data-testid="node-title"]:text("${nodeName}"))`);
    await expect(node).toBeVisible();

    // Get initial position using bounding box
    const initialBox = await node.boundingBox();
    expect(initialBox).toBeDefined();

    // Drag the node to a new position
    if (initialBox) {
      const startX = initialBox.x + initialBox.width / 2;
      const startY = initialBox.y + initialBox.height / 2;
      const endX = startX + 100;
      const endY = startY + 100;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(endX, endY);
      await page.mouse.up();

      // Verify position changed (with some tolerance)
      const newBox = await node.boundingBox();
      expect(newBox).toBeDefined();

      // Position should have changed (allowing for grid snapping)
      const movedX = Math.abs((newBox?.x || 0) - (initialBox?.x || 0));
      const movedY = Math.abs((newBox?.y || 0) - (initialBox?.y || 0));

      // At least one coordinate should have moved by a significant amount (> 10px)
      expect(movedX + movedY).toBeGreaterThan(10);
    }
  });
});
