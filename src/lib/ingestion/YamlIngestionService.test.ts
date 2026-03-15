import { createInMemoryDatabase } from '../db/DatabaseService';
import { ingestEconomy, ingestScenarios, ingestTaxes } from './YamlIngestionService';
import { join } from 'path';

const DATA_ROOT = join(process.cwd(), 'data');

describe('YamlIngestionService', () => {
  it('ingests economy metrics', () => {
    const db = createInMemoryDatabase();
    ingestEconomy(db, join(DATA_ROOT, 'economy'));
    const rows = db.prepare('SELECT * FROM economy_metrics').all();
    expect(rows.length).toBeGreaterThan(0);
  });

  it('ingests scenarios with normalized monthly amounts', () => {
    const db = createInMemoryDatabase();
    ingestScenarios(db, join(DATA_ROOT, 'scenarios'));
    const scenarios = db.prepare('SELECT * FROM scenarios').all() as Array<{ id: number }>;
    expect(scenarios.length).toBeGreaterThan(0);
    const income = db.prepare('SELECT * FROM income_items WHERE scenario_id = ?').all(scenarios[0].id) as Array<{
      amount: number; frequency: string; amount_monthly_normalized: number;
    }>;
    for (const item of income) {
      if (item.frequency === 'yearly') {
        expect(item.amount_monthly_normalized).toBeCloseTo(item.amount / 12);
      } else {
        expect(item.amount_monthly_normalized).toBeCloseTo(item.amount);
      }
    }
  });

  it('ingests tax configs', () => {
    const db = createInMemoryDatabase();
    ingestTaxes(db, join(DATA_ROOT, 'taxes'));
    const configs = db.prepare('SELECT * FROM tax_configs').all();
    expect(configs.length).toBeGreaterThan(0);
    const rules = db.prepare('SELECT * FROM tax_rules').all();
    expect(rules.length).toBeGreaterThan(0);
  });

  it('is idempotent - re-ingestion does not create duplicates', () => {
    const db = createInMemoryDatabase();
    ingestTaxes(db, join(DATA_ROOT, 'taxes'));
    ingestTaxes(db, join(DATA_ROOT, 'taxes'));
    const configs = db.prepare('SELECT * FROM tax_configs').all();
    expect(configs.length).toBe(1);
  });
});
