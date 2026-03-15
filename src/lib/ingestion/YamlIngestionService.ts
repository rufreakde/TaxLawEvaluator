import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import yaml from 'js-yaml';
import type Database from 'better-sqlite3';
import type { HouseholdFinances } from '../../../types/scenariodata.js';
import type { TaxRuleset } from '../../../types/tax.js';
import type { EconomicDataSchema } from '../../../types/economydata.js';

export function ingestAll(db: Database.Database, dataRoot: string): void {
  ingestEconomy(db, join(dataRoot, 'economy'));
  ingestScenarios(db, join(dataRoot, 'scenarios'));
  ingestTaxes(db, join(dataRoot, 'taxes'));
}

function readYaml<T>(filePath: string): T {
  const content = readFileSync(filePath, 'utf-8');
  return yaml.load(content) as T;
}

function globYaml(dir: string): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

export function ingestEconomy(db: Database.Database, dir: string): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO economy_metrics
      (region_code, year, currency, category, metric_key, value, unit, label)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const filePath of globYaml(dir)) {
    const data = readYaml<EconomicDataSchema>(filePath);
    const { region_code, year, currency } = data.metadata;
    for (const [category, metricMap] of Object.entries(data.economic_metrics)) {
      for (const [metric_key, metric] of Object.entries(metricMap)) {
        stmt.run(region_code, year, currency, category, metric_key, metric.value, metric.unit, metric.label);
      }
    }
  }
}

export function ingestScenarios(db: Database.Database, dir: string): void {
  const insertScenario = db.prepare(`
    INSERT OR REPLACE INTO scenarios (household_name, currency, last_updated, source_file)
    VALUES (?, ?, ?, ?)
  `);
  const insertIncome = db.prepare(`
    INSERT INTO income_items (scenario_id, name, amount, frequency, type, amount_monthly_normalized)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertAsset = db.prepare(`
    INSERT INTO asset_items (scenario_id, name, value, type, asset_class)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertLiability = db.prepare(`
    INSERT INTO liability_items (scenario_id, name, total_remaining, monthly_payment, interest_rate, type)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertExpense = db.prepare(`
    INSERT INTO fixed_expense_items (scenario_id, name, amount, frequency, type, amount_monthly_normalized)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const deleteIncomeForScenario = db.prepare('DELETE FROM income_items WHERE scenario_id = ?');
  const deleteAssetsForScenario = db.prepare('DELETE FROM asset_items WHERE scenario_id = ?');
  const deleteLiabilitiesForScenario = db.prepare('DELETE FROM liability_items WHERE scenario_id = ?');
  const deleteExpensesForScenario = db.prepare('DELETE FROM fixed_expense_items WHERE scenario_id = ?');
  const getScenarioId = db.prepare('SELECT id FROM scenarios WHERE source_file = ?');

  for (const filePath of globYaml(dir)) {
    const data = readYaml<HouseholdFinances>(filePath);
    const sourceFile = basename(filePath);

    db.transaction(() => {
      insertScenario.run(
        data.metadata.household_name,
        data.metadata.currency,
        String(data.metadata.last_updated),
        sourceFile,
      );
      const row = getScenarioId.get(sourceFile) as { id: number };
      const scenarioId = row.id;

      deleteIncomeForScenario.run(scenarioId);
      deleteAssetsForScenario.run(scenarioId);
      deleteLiabilitiesForScenario.run(scenarioId);
      deleteExpensesForScenario.run(scenarioId);

      for (const item of data.income) {
        const normalized = item.frequency === 'yearly' ? item.amount / 12 : item.amount;
        insertIncome.run(scenarioId, item.name, item.amount, item.frequency, item.type, normalized);
      }
      for (const item of data.assets) {
        insertAsset.run(scenarioId, item.name, item.value, item.type, item.asset_class);
      }
      for (const item of data.liabilities) {
        insertLiability.run(scenarioId, item.name, item.total_remaining, item.monthly_payment, item.interest_rate, item.type);
      }
      for (const item of data.fixed_expenses) {
        const normalized = item.frequency === 'yearly' ? item.amount / 12 : item.amount;
        insertExpense.run(scenarioId, item.name, item.amount, item.frequency, item.type ?? null, normalized);
      }
    })();
  }
}

export function ingestTaxes(db: Database.Database, dir: string): void {
  const insertConfig = db.prepare(`
    INSERT OR REPLACE INTO tax_configs (schema_version, region, source_file)
    VALUES (?, ?, ?)
  `);
  const insertInput = db.prepare(`
    INSERT OR REPLACE INTO tax_inputs (tax_config_id, input_id, description, source, static_value)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertRule = db.prepare(`
    INSERT OR REPLACE INTO tax_rules (tax_config_id, name, formula, description, rule_order)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertOutput = db.prepare(`
    INSERT OR REPLACE INTO tax_outputs (tax_config_id, output_id, reference_rule)
    VALUES (?, ?, ?)
  `);
  const getConfigId = db.prepare('SELECT id FROM tax_configs WHERE source_file = ?');

  for (const filePath of globYaml(dir)) {
    const data = readYaml<TaxRuleset>(filePath);
    const sourceFile = basename(filePath);

    db.transaction(() => {
      insertConfig.run(data.metadata.schema_version, data.metadata.region, sourceFile);
      const row = getConfigId.get(sourceFile) as { id: number };
      const configId = row.id;

      for (const input of data.inputs) {
        insertInput.run(configId, input.id, input.description, input.source ?? null, input.value ?? null);
      }
      for (let i = 0; i < data.tax_rules.length; i++) {
        const rule = data.tax_rules[i];
        insertRule.run(configId, rule.name, rule.formula, rule.description ?? null, i);
      }
      for (const output of data.outputs) {
        insertOutput.run(configId, output.id, output.reference_rule);
      }
    })();
  }
}
