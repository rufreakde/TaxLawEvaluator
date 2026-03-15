import type { ScoringContext, ScoringRule, ScoringRuleResult, ScoreBreakdown } from '../../types/scoring.js';

export class NodeCountPenaltyRule implements ScoringRule {
  readonly id = 'node-count-penalty';
  readonly description = 'Deducts 1 point per node in the graph';

  evaluate(context: ScoringContext): ScoringRuleResult {
    const count = context.graphConfig.nodes.length;
    return {
      ruleId: this.id,
      pointDelta: -count,
      detail: `${count} node(s) × -1 = -${count}`,
    };
  }
}

export class FormulaRulePenaltyRule implements ScoringRule {
  readonly id = 'formula-rule-penalty';
  readonly description = 'Deducts 1 point per LogicNode in the graph';

  evaluate(context: ScoringContext): ScoringRuleResult {
    const count = context.graphConfig.nodes.filter((n) => n.extras.kind === 'LogicNode').length;
    return {
      ruleId: this.id,
      pointDelta: -count,
      detail: `${count} LogicNode(s) × -1 = -${count}`,
    };
  }
}

const DEFAULT_RULES: ScoringRule[] = [
  new NodeCountPenaltyRule(),
  new FormulaRulePenaltyRule(),
];

export function evaluate(context: ScoringContext, rules: ScoringRule[] = DEFAULT_RULES): ScoreBreakdown {
  const ruleResults: ScoringRuleResult[] = rules.map((rule) => rule.evaluate(context));
  const totalScore = ruleResults.reduce((score, r) => score + r.pointDelta, 100);

  return {
    baseScore: 100,
    rules: ruleResults,
    totalScore,
    disposableIncome: context.formulaResults.disposableIncome,
    computedAt: Date.now(),
  };
}
