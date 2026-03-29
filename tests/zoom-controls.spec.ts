import { test, expect } from '@playwright/test';
import { login, ensureDataLoaded, selectScenario, selectTaxConfig, zoomIn, zoomOut } from './helpers';

test.describe('Zoom Controls', () => {
  test.setTimeout(120000);

  test('zoom in button enlarges canvas', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // Get initial zoom level
    const zoomDisplay = page.locator('[data-testid="zoom-level-display"]');
    const initialZoom = await zoomDisplay.textContent();
    expect(initialZoom).toBeDefined();

    // Click zoom in
    await page.click('[data-testid="zoom-in-button"]');

    // Verify zoom level increased
    const newZoom = await zoomDisplay.textContent();
    const zoomPercent = parseInt(newZoom || '100', 10);
    expect(zoomPercent).toBeGreaterThan(parseInt(initialZoom || '100', 10));
  });

  test('zoom out button shrinks canvas', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // Get initial zoom level
    const zoomDisplay = page.locator('[data-testid="zoom-level-display"]');
    const initialZoom = await zoomDisplay.textContent();
    expect(initialZoom).toBeDefined();

    // Click zoom out
    await page.click('[data-testid="zoom-out-button"]');

    // Verify zoom level decreased
    const newZoom = await zoomDisplay.textContent();
    const zoomPercent = parseInt(newZoom || '100', 10);
    expect(zoomPercent).toBeLessThan(parseInt(initialZoom || '100', 10));
  });

  test('zoom reset button returns to 100%', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // Zoom in a few times
    await page.click('[data-testid="zoom-in-button"]');
    await page.click('[data-testid="zoom-in-button"]');
    await page.click('[data-testid="zoom-in-button"]');

    // Get current zoom
    const zoomDisplay = page.locator('[data-testid="zoom-level-display"]');
    const zoomBefore = await zoomDisplay.textContent();

    // Click reset
    await page.click('[data-testid="zoom-reset-button"]');

    // Verify it's back to 100%
    const zoomAfter = await zoomDisplay.textContent();
    expect(zoomAfter).toBe('100%');

    // Reset button should be disabled when at 100%
    await expect(page.locator('[data-testid="zoom-reset-button"]')).toBeDisabled({ timeout: 5000 });
  });

  test('zoom buttons have correct enabled/disabled states', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    const zoomInBtn = page.locator('[data-testid="zoom-in-button"]');
    const zoomOutBtn = page.locator('[data-testid="zoom-out-button"]');
    const zoomResetBtn = page.locator('[data-testid="zoom-reset-button"]');

    // At 100%, zoom out should be enabled, zoom in enabled, reset disabled
    await expect(zoomOutBtn).toBeEnabled({ timeout: 5000 });
    await expect(zoomInBtn).toBeEnabled({ timeout: 5000 });
    await expect(zoomResetBtn).toBeDisabled({ timeout: 5000 });

    // Zoom out to minimum
    for (let i = 0; i < 8; i++) {
      await page.click('[data-testid="zoom-out-button"]');
    }
    await expect(zoomOutBtn).toBeDisabled({ timeout: 5000 });

    // Zoom reset should now be enabled
    await expect(zoomResetBtn).toBeEnabled({ timeout: 5000 });

    // Zoom in should be enabled
    await expect(zoomInBtn).toBeEnabled({ timeout: 5000 });
  });
});
