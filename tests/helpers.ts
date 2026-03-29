import { Page, expect } from '@playwright/test';

// ============================================
// Test Data Management
// ============================================

export function uniqueName(base: string): string {
  return `${base} - ${Date.now()}`;
}

// ============================================
// Authentication
// ============================================

export async function login(page: Page, username: string, password: string): Promise<void> {
  await page.goto('http://localhost:5173/');
  await page.fill('[data-testid="username-input"]', username);
  await page.fill('[data-testid="password-input"]', password);
  await expect(page.getByRole('button', { name: 'Login' })).toBeEnabled({ timeout: 5000 });

  // Wait for the login request to complete successfully
  const responsePromise = page.waitForResponse('**/api/v1/auth/login');
  await page.click('[data-testid="login-button"]');
  const response = await responsePromise;

  // Optionally check response body for user data
  const user = await response.json().catch(() => null);
  if (!user) {
    console.warn('Login response did not contain user data');
  }

  // Ensure logout button appears, confirming UI updated
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
}

export async function logout(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  await page.click('[data-testid="logout-button"]');
  await expect(page.locator('[data-testid="username-input"]')).toBeVisible();
}

// ============================================
// Data Loading & Selection
// ============================================

export async function ensureDataLoaded(page: Page): Promise<void> {
  const scenarioCombo = page.getByRole('combobox', { name: /Scenario selector/i });
  await expect(scenarioCombo).toBeVisible();
  await scenarioCombo.click();

  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  const options = listbox.locator('[role="option"]');
  const count = await options.count();
  expect(count).toBeGreaterThan(0);

  await page.keyboard.press('Escape');
  await expect(listbox).not.toBeVisible();
}

export async function selectScenario(page: Page, label: string): Promise<void> {
  const combo = page.getByRole('combobox', { name: /Scenario selector/i });
  await combo.click();
  // Wait for the dropdown to open and options to be visible
  await expect(page.getByRole('listbox')).toBeVisible();
  const option = page.getByRole('option', { name: label });
  await expect(option).toBeVisible();
  await option.click();

  const taxCombo = page.getByRole('combobox', { name: /Tax configuration selector/i });
  await expect(taxCombo).toBeEnabled({ timeout: 5000 });
}

export async function selectTaxConfig(page: Page, label: string): Promise<void> {
  const combo = page.getByRole('combobox', { name: /Tax configuration selector/i });
  await expect(combo).toBeEnabled({ timeout: 5000 });
  await combo.click();
  // Wait for the dropdown to open and options to be visible
  await expect(page.getByRole('listbox')).toBeVisible();
  const option = page.getByRole('option', { name: label });
  await expect(option).toBeVisible();
  await option.click();

  // Wait for auto-generated nodes to appear
  await expect(page.getByText('Primary Gross Salary', { exact: true })).toBeVisible();
  await expect(page.getByText('Simplified Net Calculation', { exact: true })).toBeVisible();
}

// ============================================
// Graph Editing - Nodes
// ============================================

export async function createSourceNode(page: Page, name: string, value: number = 0): Promise<void> {
  await page.click('[data-testid="source-node-button"]');

  await expect(page.locator('[data-testid="source-node-name-input"]')).toBeVisible();
  await page.fill('[data-testid="source-node-name-input"]', name);
  await page.fill('[data-testid="source-node-value-input"]', String(value));

  await page.click('[data-testid="add-source-node-button"]');

  // Find node widget that contains a node-title with the given name
  const node = page.locator(`.node-widget:has([data-testid="node-title"]:text("${name}"))`);
  await expect(node).toBeVisible();
}

export async function createTaxRule(page: Page, name: string, formula: string): Promise<void> {
  await page.click('[data-testid="tax-rule-button"]');

  // Try to find "Create New" tab (only visible to admins)
  const createNewTab = page.locator('[data-testid="create-new-rule-tab"]');
  if (await createNewTab.isVisible()) {
    await createNewTab.click();
  }

  await expect(page.locator('[data-testid="rule-name-input"]')).toBeVisible();
  await page.fill('[data-testid="rule-name-input"]', name);
  await page.fill('[data-testid="rule-formula-input"]', formula);

  await page.click('[data-testid="create-rule-button"]');

  // Find node widget that contains a node-title with the given name
  const node = page.locator(`.node-widget:has([data-testid="node-title"]:text("${name}"))`);
  await expect(node).toBeVisible();
}

export async function createResultNode(page: Page): Promise<void> {
  await page.click('[data-testid="result-node-button"]');
  // Find node widget that contains a node-title with text "Result"
  const node = page.locator('.node-widget:has([data-testid="node-title"]:text("Result"))');
  await expect(node).toBeVisible();
}

export async function deleteNode(page: Page, nodeName: string): Promise<void> {
  // Find the node widget that contains a node-title with the given name
  const node = page.locator(`.node-widget:has([data-testid="node-title"]:text("${nodeName}"))`);
  await expect(node).toBeVisible();

  // Hover over the node to show the delete button (it appears on group-hover)
  await node.hover();

  // Click the delete button within the node
  const deleteBtn = node.locator('[data-testid="delete-node-button"]');
  await expect(deleteBtn).toBeVisible();
  await deleteBtn.click();

  // Verify node is removed
  await expect(node).not.toBeVisible();
}

// ============================================
// Graph Operations
// ============================================

export async function saveGraph(page: Page, graphType: 'scenario' | 'taxLaw', name: string): Promise<void> {
  if (graphType === 'scenario') {
    const input = page.locator('[data-testid="scenario-name-input"]');
    // Wait for input to be enabled (it's disabled until a scenario is chosen)
    await expect(input).toBeEnabled({ timeout: 5000 });
    await input.fill(name);
    await page.click('[data-testid="save-scenario-button"]');
  } else {
    const input = page.locator('[data-testid="tax-law-name-input"]');
    // Wait for input to be enabled (it's disabled until a tax config is chosen)
    await expect(input).toBeEnabled({ timeout: 5000 });
    await input.fill(name);
    await page.click('[data-testid="save-tax-law-button"]');
  }

  await page.waitForTimeout(200); // Wait for save to complete and list to update
}

export async function loadSavedGraph(page: Page, graphType: 'scenario' | 'taxLaw', graphName: string): Promise<void> {
  // Reload to refresh dropdown lists
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Ensure data is loaded before interacting with dropdowns
  await ensureDataLoaded(page);

  // Select base scenario first (required for tax law graphs)
  const scenarioCombo = page.getByRole('combobox', { name: /Scenario selector/i });
  if (await scenarioCombo.isVisible()) {
    await selectScenario(page, 'Generic Median Family - 2A 2C');
  }

  if (graphType === 'taxLaw') {
    const taxCombo = page.getByRole('combobox', { name: /Tax configuration selector/i });
    await expect(taxCombo).toBeEnabled({ timeout: 5000 });
    await taxCombo.click();
    const listbox = page.getByRole('listbox');
    const option = listbox.getByRole('option', { name: graphName });
    await expect(option).toBeVisible();
    await option.click();
  }

  await page.waitForTimeout(200);
}

// ============================================
// Zoom & Canvas
// ============================================

export async function zoomIn(page: Page): Promise<void> {
  await page.click('[data-testid="zoom-in-button"]');
}

export async function zoomOut(page: Page): Promise<void> {
  await page.click('[data-testid="zoom-out-button"]');
}

// ============================================
// Variable Overrides
// ============================================

export async function setVariableOverride(page: Page, variableKey: string, value: number): Promise<void> {
  const input = page.locator(`[data-testid="variable-input-${variableKey}"]`);
  await expect(input).toBeVisible();
  await input.fill(String(value));
  await input.dispatchEvent('input'); // Trigger change event
  await page.waitForTimeout(200); // Allow state to update
}

// ============================================
// Admin Features
// ============================================

export async function openBenchmarkEditor(page: Page): Promise<void> {
  await page.click('[data-testid="benchmark-editor-button"]');
  await expect(page.locator('[data-testid="benchmark-editor-modal"]')).toBeVisible();
}

export async function closeBenchmarkEditor(page: Page): Promise<void> {
  await page.click('[data-testid="close-benchmark-editor-button"]');
  await expect(page.locator('[data-testid="benchmark-editor-modal"]')).not.toBeVisible();
}

// ============================================
// YAML Preview
// ============================================

export async function hoverScenarioHelpIcon(page: Page): Promise<void> {
  const helpIcon = page.locator('[data-testid="scenario-help-icon"]').first();
  await expect(helpIcon).toBeVisible();
  await helpIcon.hover();
}

export async function hoverTaxLawHelpIcon(page: Page): Promise<void> {
  const helpIcons = page.locator('[data-testid="tax-law-help-icon"]');
  // At least one help icon should exist
  await expect(helpIcons.first()).toBeVisible();
  await helpIcons.first().hover();
}

// ============================================
// Assertions & Helpers
// ============================================

export async function waitForGraphReady(page: Page, timeout: number = 5000): Promise<void> {
  // Wait for the graph to be fully loaded
  await expect(page.getByText('Primary Gross Salary', { exact: true })).toBeVisible({ timeout });
  await expect(page.getByText('Simplified Net Calculation', { exact: true })).toBeVisible({ timeout });
}

export async function verifyNodeExists(page: Page, nodeName: string): Promise<void> {
  const node = page.locator(`.node-widget:has([data-testid="node-title"]:text("${nodeName}"))`);
  await expect(node).toBeVisible();
}

export async function verifyNodeAbsent(page: Page, nodeName: string): Promise<void> {
  const node = page.locator(`.node-widget:has([data-testid="node-title"]:text("${nodeName}"))`);
  await expect(node).not.toBeVisible();
}

export async function saveScenarioToFile(page: Page, name: string): Promise<void> {
  await page.fill('[data-testid="scenario-name-input"]', name);
  await page.click('[data-testid="save-scenario-button"]');
  await page.waitForTimeout(200);
}

export async function saveTaxLawToFile(page: Page, name: string): Promise<void> {
  await page.fill('[data-testid="tax-law-name-input"]', name);
  await page.click('[data-testid="save-tax-law-button"]');
  await page.waitForTimeout(200);
}

export async function saveAndLoadTaxLawGraph(page: Page, graphName: string): Promise<void> {
  await saveTaxLawToFile(page, graphName);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await ensureDataLoaded(page);
  await selectScenario(page, 'Generic Median Family - 2A 2C');
  await selectTaxConfig(page, graphName);
}
