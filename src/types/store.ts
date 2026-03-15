import type { ScenarioRow, TaxConfigRow, EconomyMetricRow } from './db.js';
import type { GraphConfig } from './graph.js';
import type { ResolvedVariableMap } from './variableMapping.js';
import type { FormulaResultSet, ScoreBreakdown } from './scoring.js';

export interface AppStore {
  scenarios: ScenarioRow[];
  taxConfigs: TaxConfigRow[];
  economyMetrics: EconomyMetricRow[];
  activeScenarioId: number | null;
  activeTaxConfigId: number | null;
  activeGraphConfigId: string | null;
  variableOverrides: Record<string, number>;
  resolvedVariables: ResolvedVariableMap | null;
  formulaResults: FormulaResultSet | null;
  scoreBreakdown: ScoreBreakdown | null;
  graphConfig: GraphConfig | null;
  setActiveScenario(id: number): void;
  setActiveTaxConfig(id: number): void;
  setVariableOverride(inputId: string, value: number): void;
  loadGraphConfig(graphId: string): void;
  saveGraphConfig(graph: GraphConfig): void;
  triggerRecalculation(): void;
  createTaxRule(taxConfigId: number, rule: { name: string; formula: string; description?: string }): Promise<void>;
}
