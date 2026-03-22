import type { ScenarioRow, TaxConfigRow, EconomyMetricRow, TaxRuleRow } from './db.js';
import type { GraphConfig, ScenarioGraph, TaxLawGraph } from './graph.js';
import type { ResolvedVariableMap } from './variableMapping.js';
import type { FormulaResultSet, ScoreBreakdown } from './scoring.js';
import type { ScenarioNodeEntry, TaxLawNodeEntry, GraphLinkEntry } from './graph.js';

export interface AppStore {
  scenarios: ScenarioRow[];
  taxConfigs: TaxConfigRow[];
  economyMetrics: EconomyMetricRow[];
  activeScenarioId: number | null;
  activeTaxConfigId: number | null;
  /** Legacy monolithic graph id — kept for backward-compat load path */
  activeGraphConfigId: string | null;
  activeScenarioGraphId: string | null;
  activeTaxLawGraphId: string | null;
  variableOverrides: Record<string, number>;
  resolvedVariables: ResolvedVariableMap | null;
  formulaResults: FormulaResultSet | null;
  scoreBreakdown: ScoreBreakdown | null;
  /** Legacy monolithic graph — kept for backward-compat load path */
  graphConfig: GraphConfig | null;
  scenarioGraph: ScenarioGraph | null;
  taxLawGraph: TaxLawGraph | null;

  setActiveScenario(id: number): void;
  setActiveTaxConfig(id: number): void;
  setVariableOverride(inputId: string, value: number): void;

  /** Legacy load — kept for backward-compat */
  loadGraphConfig(graphId: string): void;
  /** Legacy save — kept for backward-compat */
  saveGraphConfig(graph: GraphConfig): void;
  /** Legacy save-as-new — kept for backward-compat */
  saveGraphAsNew(graph: GraphConfig): void;

  /**
   * Save Source nodes as a Scenario Graph.
   * Creates a new entry (POST) when activeScenarioGraphId is null,
   * otherwise updates (PUT).
   */
  saveScenarioGraph(name: string, nodes: ScenarioNodeEntry[]): void;

  /**
   * Save Logic nodes + their wiring as a Tax Law Graph.
   * Creates a new entry (POST) when activeTaxLawGraphId is null,
   * otherwise updates (PUT).
   */
  saveTaxLawGraph(name: string, nodes: TaxLawNodeEntry[], links: GraphLinkEntry[]): void;

  /**
   * Force create a new Scenario Graph (Save As).
   */
  saveScenarioGraphAs(name: string, nodes: ScenarioNodeEntry[]): void;

  /**
   * Force create a new Tax Law Graph (Save As).
   */
  saveTaxLawGraphAs(name: string, nodes: TaxLawNodeEntry[], links: GraphLinkEntry[]): void;

  loadScenarioGraph(id: string): void;
  loadTaxLawGraph(id: string): void;

  triggerRecalculation(): void;
  createTaxRule(taxConfigId: number, rule: { name: string; formula: string; description?: string }): Promise<TaxRuleRow | null>;
}
