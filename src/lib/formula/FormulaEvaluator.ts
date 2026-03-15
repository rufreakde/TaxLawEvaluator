import { evaluate } from 'mathjs';
import type { TaxRuleRow } from '../../types/db.js';
import type { FormulaResultSet } from '../../types/scoring.js';
import type { FixedExpenseRow, LiabilityRow } from '../../types/db.js';

const DOLLAR_VAR_REGEX = /\$([a-zA-Z_]\w*)/g;

function normalizeFormula(formula: string): string {
  return formula.replace(DOLLAR_VAR_REGEX, '$1');
}

export function evaluateRules(
  rules: TaxRuleRow[],
  variables: Record<string, number>,
  fixedExpenses: FixedExpenseRow[],
  liabilities: LiabilityRow[],
): FormulaResultSet {
  const sorted = [...rules].sort((a, b) => a.rule_order - b.rule_order);
  const scope: Record<string, number> = { ...variables };
  const results: Record<string, number> = {};

  for (const rule of sorted) {
    const formula = normalizeFormula(rule.formula);
    try {
      const result = evaluate(formula, scope) as number;
      results[rule.name] = result;
      // Make rule result available as variable for subsequent rules
      // Use a sanitized key derived from rule name
      const key = rule.name.replace(/\s+/g, '_').toLowerCase();
      scope[key] = result;
    } catch {
      results[rule.name] = 0;
    }
  }

  const annualFixedExpenses = fixedExpenses.reduce(
    (sum, e) => sum + e.amount_monthly_normalized * 12,
    0,
  );
  const annualLiabilityPayments = liabilities.reduce(
    (sum, l) => sum + l.monthly_payment * 12,
    0,
  );

  const netCalcResult = results['Simplified Net Calculation'] ?? 0;
  const disposableIncome = netCalcResult - annualFixedExpenses - annualLiabilityPayments;

  return { results, disposableIncome };
}
