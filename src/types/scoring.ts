import type { GraphConfig } from './graph.js';
import type { ResolvedVariableMap } from './variableMapping.js';

export interface FormulaResultSet {
  results: Record<string, number>;
  disposableIncome: number;
}

export interface ScoringContext {
  graphConfig: GraphConfig;
  resolvedVariables: ResolvedVariableMap;
  formulaResults: FormulaResultSet;
  scenarioId: number;
  taxConfigId: number;
}

export interface ScoringRule {
  readonly id: string;
  readonly description: string;
  evaluate(context: ScoringContext): ScoringRuleResult;
}

export interface ScoringRuleResult {
  ruleId: string;
  pointDelta: number;
  detail: string;
}

export interface ScoreBreakdown {
  baseScore: 100;
  rules: ScoringRuleResult[];
  totalScore: number;
  disposableIncome: number;
  computedAt: number;
}
