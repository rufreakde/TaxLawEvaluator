import { evaluateRules } from './FormulaEvaluator';
import type { TaxRuleRow, FixedExpenseRow, LiabilityRow } from '../../types/db';

const rules: TaxRuleRow[] = [
  { id: 1, tax_config_id: 1, name: 'Simplified Net Calculation', formula: '($a + $b) * 0.65', description: null, rule_order: 0 },
  { id: 2, tax_config_id: 1, name: 'Social Security Contribution', formula: '($a + $b) * 0.20', description: null, rule_order: 1 },
  { id: 3, tax_config_id: 1, name: 'Taxable Base', formula: '($a + $b) - $c', description: null, rule_order: 2 },
];

const noExpenses: FixedExpenseRow[] = [];
const noLiabilities: LiabilityRow[] = [];

describe('FormulaEvaluator', () => {
  it('evaluates (a + b) * 0.65 with a=38400, b=28800 to 43680', () => {
    const result = evaluateRules(rules, { a: 38400, b: 28800, c: 11604 }, noExpenses, noLiabilities);
    expect(result.results['Simplified Net Calculation']).toBeCloseTo(43680);
  });

  it('computes disposable income subtracting fixed expenses and liabilities', () => {
    const expenses: FixedExpenseRow[] = [
      { id: 1, scenario_id: 1, name: 'Internet', amount: 85, frequency: 'monthly', type: null, amount_monthly_normalized: 85 },
    ];
    const liabs: LiabilityRow[] = [
      { id: 1, scenario_id: 1, name: 'Mortgage', total_remaining: 195000, monthly_payment: 1100, interest_rate: 3.5, type: 'mortgage' },
    ];
    const result = evaluateRules(rules, { a: 38400, b: 28800, c: 11604 }, expenses, liabs);
    // 43680 - (85 * 12) - (1100 * 12) = 43680 - 1020 - 13200 = 29460
    expect(result.disposableIncome).toBeCloseTo(29460);
  });
});
