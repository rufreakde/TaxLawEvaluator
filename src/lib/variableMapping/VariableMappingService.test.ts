import { resolveVariables, parseSourcePath } from './VariableMappingService';
import type { HouseholdFinances } from '../../types/scenariodata';
import type { TaxInputRow } from '../../types/db';

const medianScenario: HouseholdFinances = {
  metadata: { last_updated: '2026-03-15', currency: 'EUR', household_name: 'Test' },
  income: [
    { name: 'Primary Salary', amount: 3200, frequency: 'monthly', type: 'employment' },
    { name: 'Secondary Salary', amount: 2400, frequency: 'monthly', type: 'employment' },
  ],
  assets: [],
  liabilities: [],
  fixed_expenses: [],
};

const taxInputs: TaxInputRow[] = [
  { id: 1, tax_config_id: 1, input_id: 'a', description: 'Primary Gross Salary', source: 'income[0].amount', static_value: null },
  { id: 2, tax_config_id: 1, input_id: 'b', description: 'Secondary Gross Salary', source: 'income[1].amount', static_value: null },
  { id: 3, tax_config_id: 1, input_id: 'c', description: 'Tax Free Allowance', source: null, static_value: 11604 },
];

describe('VariableMappingService', () => {
  it('parses source path correctly', () => {
    expect(parseSourcePath('income[0].amount')).toEqual({ collection: 'income', index: 0, field: 'amount' });
    expect(parseSourcePath('assets[2].value')).toEqual({ collection: 'assets', index: 2, field: 'value' });
    expect(parseSourcePath('invalid')).toBeNull();
  });

  it('resolves income[0].amount for median scenario to 38400 (3200 * 12)', () => {
    const result = resolveVariables(medianScenario, 1, taxInputs, 1);
    expect(result.variables['a']).toBe(38400);
  });

  it('resolves income[1].amount for median scenario to 28800 (2400 * 12)', () => {
    const result = resolveVariables(medianScenario, 1, taxInputs, 1);
    expect(result.variables['b']).toBe(28800);
  });

  it('resolves static value for c', () => {
    const result = resolveVariables(medianScenario, 1, taxInputs, 1);
    expect(result.variables['c']).toBe(11604);
  });

  it('applies overrides', () => {
    const result = resolveVariables(medianScenario, 1, taxInputs, 1, { a: 50000 });
    expect(result.variables['a']).toBe(50000);
    expect(result.variables['b']).toBe(28800);
  });
});
