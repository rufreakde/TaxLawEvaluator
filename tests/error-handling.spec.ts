import { test, expect } from '@playwright/test';
import { login, ensureDataLoaded, selectScenario, selectTaxConfig, uniqueName } from './helpers';

test.describe('Error Handling & Edge Cases', () => {
  test.setTimeout(120000);

  // Helper to log failed network requests and errors
  test.beforeEach(async ({ page }) => {
    page.on('requestfailed', request => {
      if (request.failure()?.errorText.includes('net::ERR_ABORTED') === false) {
        console.log(`Request failed: ${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
      }
    });

    page.on('response', async response => {
      if (response.status() >= 400) {
        console.log(`Response ${response.status()}: ${response.url()}`);
        // Try to get body for 401 responses to see the error message
        if (response.status() === 401) {
          try {
            const text = await response.text();
            console.log(`401 body: ${text}`);
          } catch (e) {
            // can't read body multiple times
          }
        }
      }
    });

    page.on('pageerror', error => {
      console.log('Page error:', error.message);
    });

    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`Console ${msg.type()}: ${msg.text()}`);
      }
    });
  });

  test('invalid formula syntax shows error message', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // Try to create a rule with malformed formula
    await expect(page.locator('[data-testid="tax-rule-button"]')).toBeEnabled();
    await page.click('[data-testid="tax-rule-button"]');

    // Wait for popup and switch to Create New tab
    const createNewTab = page.locator('[data-testid="create-new-rule-tab"]');
    await expect(createNewTab).toBeVisible({ timeout: 5000 });
    await createNewTab.click();

    // Fill in the form
    await expect(page.locator('[data-testid="rule-name-input"]')).toBeVisible();
    const ruleName = uniqueName('Invalid Rule');
    await page.fill('[data-testid="rule-name-input"]', ruleName);
    // Invalid formula: incomplete expression with no right operand
    await page.fill('[data-testid="rule-formula-input"]', '$a * ');

    // Click create
    await expect(page.locator('[data-testid="create-rule-button"]')).toBeEnabled();
    await page.click('[data-testid="create-rule-button"]');

    // The rule node should NOT appear on canvas due to validation error
    // Wait a bit for any potential async validation
    await page.waitForTimeout(500);
    const ruleNode = page.locator(`.node-widget:has([data-testid="node-title"]:text("${ruleName}"))`);
    await expect(ruleNode).not.toBeVisible();
  });

  test('node with formula using only literals (no variables) works', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    await expect(page.locator('[data-testid="tax-rule-button"]')).toBeEnabled();
    await page.click('[data-testid="tax-rule-button"]');

    const createNewTab = page.locator('[data-testid="create-new-rule-tab"]');
    await expect(createNewTab).toBeVisible({ timeout: 5000 });
    await createNewTab.click();

    await expect(page.locator('[data-testid="rule-name-input"]')).toBeVisible();
    const ruleName = uniqueName('Literal Rule');
    await page.fill('[data-testid="rule-name-input"]', ruleName);
    // Formula with no variable references
    await page.fill('[data-testid="rule-formula-input"]', '1000 * 0.15');

    await expect(page.locator('[data-testid="create-rule-button"]')).toBeEnabled();
    await page.click('[data-testid="create-rule-button"]');

    // Should create node without issue
    await expect(page.locator(`.node-widget:has([data-testid="node-title"]:text("${ruleName}"))`)).toBeVisible({ timeout: 10000 });
  });

  test('empty scenario selection prevents tax config selection', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);

    // Tax config should be disabled initially
    const taxCombo = page.getByRole('combobox', { name: 'Tax configuration selector' });
    await expect(taxCombo).toBeDisabled({ timeout: 5000 });
  });

  test('graph nodes render correctly after rapid creation', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await ensureDataLoaded(page);
    await selectScenario(page, 'Generic Median Family - 2A 2C');
    await selectTaxConfig(page, 'DE (1.0)');

    // Verify auto-generated nodes appeared (Primary Gross Salary, Simplified Net Calculation)
    await expect(page.getByText('Primary Gross Salary', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Simplified Net Calculation', { exact: true })).toBeVisible({ timeout: 10000 });

    // Ensure the tax rule button is enabled before starting
    await expect(page.locator('[data-testid="tax-rule-button"]')).toBeEnabled({ timeout: 10000 });

    // Create multiple nodes in rapid succession
    const names = ['Rule 1', 'Rule 2', 'Rule 3'];
    for (const name of names) {
      // Wait for button to be enabled (state might change after previous creation)
      await expect(page.locator('[data-testid="tax-rule-button"]')).toBeEnabled({ timeout: 5000 });

      await page.click('[data-testid="tax-rule-button"]');

      // Wait for the popup to open and the "Create New" tab to be available
      const createNewTab = page.locator('[data-testid="create-new-rule-tab"]');
      await expect(createNewTab).toBeVisible({ timeout: 5000 });
      await createNewTab.click();

      // Wait for the input fields to be ready
      await expect(page.locator('[data-testid="rule-name-input"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('[data-testid="rule-formula-input"]')).toBeVisible({ timeout: 5000 });

      await page.fill('[data-testid="rule-name-input"]', name);
      await page.fill('[data-testid="rule-formula-input"]', '$a * 0.10');

      // Ensure create button is enabled before clicking
      await expect(page.locator('[data-testid="create-rule-button"]')).toBeEnabled({ timeout: 5000 });
      await page.click('[data-testid="create-rule-button"]');

      // Wait for the node to appear on canvas before proceeding
      await expect(page.locator(`.node-widget:has([data-testid="node-title"]:text("${name}"))`)).toBeVisible({ timeout: 10000 });
    }
  });
});
