import { create } from 'zustand';
import type { AppStore } from '../types/store.js';
import type { ScenarioRow, TaxConfigRow, TaxInputRow, TaxRuleRow, FixedExpenseRow, LiabilityRow, IncomeRow, AssetRow } from '../types/db.js';
import type { GraphConfig, ScenarioGraph, TaxLawGraph } from '../types/graph.js';
import type { ScenarioNodeEntry, TaxLawNodeEntry, GraphLinkEntry } from '../types/graph.js';
import { resolveVariables } from '../lib/variableMapping/VariableMappingService.js';
import { evaluateRules } from '../lib/formula/FormulaEvaluator.js';
import { evaluate as evaluateScore } from '../lib/scoring/ScoringEngine.js';
import type { HouseholdFinances } from '../types/scenariodata.js';

interface InternalState extends AppStore {
  _scenarioDetails: Map<number, {
    finances: HouseholdFinances;
    income: TaxInputRow[];
    fixed_expenses: FixedExpenseRow[];
    liabilities: LiabilityRow[];
  }>;
  _taxRules: Map<number, TaxInputRow[]>;
  _taxRuleRows: Map<number, TaxRuleRow[]>;
}

export const useAppStore = create<InternalState>((set, get) => ({
  scenarios: [],
  taxConfigs: [],
  economyMetrics: [],
  activeScenarioId: null,
  activeTaxConfigId: null,
  activeGraphConfigId: null,
  activeScenarioGraphId: null,
  activeTaxLawGraphId: null,
  variableOverrides: {},
  resolvedVariables: null,
  formulaResults: null,
  scoreBreakdown: null,
  graphConfig: null,
  scenarioGraph: null,
  taxLawGraph: null,
  _scenarioDetails: new Map(),
  _taxRules: new Map(),
  _taxRuleRows: new Map(),

  setActiveScenario(id: number): void {
    set({ activeScenarioId: id });
    const existing = get()._scenarioDetails.get(id);
    if (existing) {
      get().triggerRecalculation();
      return;
    }
    fetch(`/api/v1/scenarios/${id}`)
      .then((r) => r.json() as Promise<{ scenario: ScenarioRow; income: IncomeRow[]; assets: AssetRow[]; liabilities: LiabilityRow[]; fixed_expenses: FixedExpenseRow[] }>)
      .then((data) => {
        const finances: HouseholdFinances = {
          metadata: {
            last_updated: data.scenario.last_updated,
            currency: data.scenario.currency,
            household_name: data.scenario.household_name,
          },
          income: data.income.map((r) => ({ name: r.name, amount: r.amount, frequency: r.frequency, type: r.type })),
          assets: data.assets.map((r) => ({ name: r.name, value: r.value, type: r.type as 'liquid' | 'invested', asset_class: r.asset_class })),
          liabilities: data.liabilities.map((r) => ({ name: r.name, total_remaining: r.total_remaining, monthly_payment: r.monthly_payment, interest_rate: r.interest_rate, type: r.type })),
          fixed_expenses: data.fixed_expenses.map((r) => ({ name: r.name, amount: r.amount, frequency: r.frequency as 'monthly' | 'yearly', type: r.type ?? undefined })),
        };
        const current = get()._scenarioDetails;
        current.set(id, { finances, income: [], fixed_expenses: data.fixed_expenses, liabilities: data.liabilities });
        set({ _scenarioDetails: current });
        get().triggerRecalculation();
      })
      .catch(() => {});
  },

  setActiveTaxConfig(id: number): void {
    if (!id) return;
    set({ activeTaxConfigId: id });
    const existingInputs = get()._taxRules.get(id);
    if (existingInputs) {
      get().triggerRecalculation();
      return;
    }
    fetch(`/api/v1/tax-configs/${id}`)
      .then((r) => r.json() as Promise<{ config: TaxConfigRow; inputs: TaxInputRow[]; rules: TaxRuleRow[] }>)
      .then((data) => {
        const taxRules = get()._taxRules;
        const taxRuleRows = get()._taxRuleRows;
        taxRules.set(id, data.inputs);
        taxRuleRows.set(id, data.rules);
        set({ _taxRules: taxRules, _taxRuleRows: taxRuleRows });
        get().triggerRecalculation();
      })
      .catch(() => {});
  },

  setVariableOverride(inputId: string, value: number): void {
    set((state) => ({
      variableOverrides: { ...state.variableOverrides, [inputId]: value },
    }));
    get().triggerRecalculation();
  },

  loadGraphConfig(graphId: string): void {
    fetch(`/api/v1/graphs/${graphId}`)
      .then((r) => r.json() as Promise<{ diagram_json: string; id: string; name: string; tax_config_id: number }>)
      .then((data) => {
        const parsed = JSON.parse(data.diagram_json) as GraphConfig;
        set({ graphConfig: parsed, activeGraphConfigId: graphId });
        get().triggerRecalculation();
      })
      .catch(() => {});
  },

  saveGraphConfig(graph: GraphConfig): void {
    const { activeGraphConfigId, activeTaxConfigId } = get();
    const diagram_json = JSON.stringify(graph);
    if (activeGraphConfigId) {
      fetch(`/api/v1/graphs/${activeGraphConfigId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagram_json }),
      }).catch(() => {});
    } else {
      fetch('/api/v1/graphs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: graph.name, tax_config_id: activeTaxConfigId, diagram_json }),
      })
        .then((r) => r.json() as Promise<{ id: string }>)
        .then((data) => set({ activeGraphConfigId: data.id }))
        .catch(() => {});
    }
    set({ graphConfig: graph });
  },

  saveGraphAsNew(graph: GraphConfig): void {
    const { activeTaxConfigId } = get();
    set({ activeGraphConfigId: null });
    const diagram_json = JSON.stringify(graph);
    fetch('/api/v1/graphs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: graph.name, tax_config_id: activeTaxConfigId, diagram_json }),
    })
      .then((r) => r.json() as Promise<{ id: string }>)
      .then((data) => set({ activeGraphConfigId: data.id, graphConfig: { ...graph, id: data.id } }))
      .catch(() => {});
  },

  saveScenarioGraph(name: string, nodes: ScenarioNodeEntry[]): void {
    const { activeTaxConfigId, activeScenarioGraphId } = get();
    if (!activeTaxConfigId) return;

    if (activeScenarioGraphId) {
      fetch(`/api/v1/scenario-graphs/${activeScenarioGraphId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, nodes }),
      })
        .then((r) => r.json() as Promise<{ id: string; name: string; tax_config_id: number; nodes_json: string; version: number }>)
        .then((data) => {
          const sg: ScenarioGraph = {
            id: data.id,
            name: data.name,
            taxConfigId: data.tax_config_id,
            nodes,
            version: data.version,
          };
          set({ scenarioGraph: sg });
        })
        .catch(() => {});
    } else {
      fetch('/api/v1/scenario-graphs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, tax_config_id: activeTaxConfigId, nodes }),
      })
        .then((r) => r.json() as Promise<{ id: string; name: string; tax_config_id: number; nodes_json: string; version: number }>)
        .then((data) => {
          const sg: ScenarioGraph = {
            id: data.id,
            name: data.name,
            taxConfigId: data.tax_config_id,
            nodes,
            version: data.version,
          };
          set({ activeScenarioGraphId: data.id, scenarioGraph: sg });
        })
        .catch(() => {});
    }
  },

  saveTaxLawGraph(name: string, nodes: TaxLawNodeEntry[], links: GraphLinkEntry[]): void {
    const { activeTaxConfigId, activeTaxLawGraphId } = get();
    if (!activeTaxConfigId) return;

    if (activeTaxLawGraphId) {
      fetch(`/api/v1/taxlaw-graphs/${activeTaxLawGraphId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, nodes, links }),
      })
        .then((r) => r.json() as Promise<{ id: string; name: string; tax_config_id: number; nodes_json: string; links_json: string; version: number }>)
        .then((data) => {
          const tg: TaxLawGraph = {
            id: data.id,
            name: data.name,
            taxConfigId: data.tax_config_id,
            nodes,
            links,
            version: data.version,
          };
          set({ taxLawGraph: tg });
        })
        .catch(() => {});
    } else {
      fetch('/api/v1/taxlaw-graphs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, tax_config_id: activeTaxConfigId, nodes, links }),
      })
        .then((r) => r.json() as Promise<{ id: string; name: string; tax_config_id: number; nodes_json: string; links_json: string; version: number }>)
        .then((data) => {
          const tg: TaxLawGraph = {
            id: data.id,
            name: data.name,
            taxConfigId: data.tax_config_id,
            nodes,
            links,
            version: data.version,
          };
          set({ activeTaxLawGraphId: data.id, taxLawGraph: tg });
        })
        .catch(() => {});
    }
  },

  /** Force create a new Scenario Graph (Save As) */
  saveScenarioGraphAs(name: string, nodes: ScenarioNodeEntry[]): void {
    const { activeTaxConfigId } = get();
    if (!activeTaxConfigId) return;
    fetch('/api/v1/scenario-graphs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, tax_config_id: activeTaxConfigId, nodes }),
    })
      .then((r) => r.json() as Promise<{ id: string; name: string; tax_config_id: number; nodes_json: string; version: number }>)
      .then((data) => {
        const sg: ScenarioGraph = {
          id: data.id,
          name: data.name,
          taxConfigId: data.tax_config_id,
          nodes,
          version: data.version,
        };
        set({ activeScenarioGraphId: data.id, scenarioGraph: sg });
      })
      .catch(() => {});
  },

  /** Force create a new Tax Law Graph (Save As) */
  saveTaxLawGraphAs(name: string, nodes: TaxLawNodeEntry[], links: GraphLinkEntry[]): void {
    const { activeTaxConfigId } = get();
    if (!activeTaxConfigId) return;
    fetch('/api/v1/taxlaw-graphs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, tax_config_id: activeTaxConfigId, nodes, links }),
    })
      .then((r) => r.json() as Promise<{ id: string; name: string; tax_config_id: number; nodes_json: string; links_json: string; version: number }>)
      .then((data) => {
        const tg: TaxLawGraph = {
          id: data.id,
          name: data.name,
          taxConfigId: data.tax_config_id,
          nodes,
          links,
          version: data.version,
        };
        set({ activeTaxLawGraphId: data.id, taxLawGraph: tg });
      })
      .catch(() => {});
  },

  loadScenarioGraph(id: string): void {
    fetch(`/api/v1/scenario-graphs/${id}`)
      .then((r) => r.json() as Promise<{ id: string; name: string; tax_config_id: number; nodes: ScenarioNodeEntry[]; version: number }>)
      .then((data) => {
        const sg: ScenarioGraph = { id: data.id, name: data.name, taxConfigId: data.tax_config_id, nodes: data.nodes, version: data.version };
        set({ activeScenarioGraphId: data.id, scenarioGraph: sg });
        if (!get().activeTaxConfigId) get().setActiveTaxConfig(data.tax_config_id);
      })
      .catch(() => {});
  },

  loadTaxLawGraph(id: string): void {
    fetch(`/api/v1/taxlaw-graphs/${id}`)
      .then((r) => r.json() as Promise<{ id: string; name: string; tax_config_id: number; nodes: TaxLawNodeEntry[]; links: GraphLinkEntry[]; version: number }>)
      .then((data) => {
        const tg: TaxLawGraph = { id: data.id, name: data.name, taxConfigId: data.tax_config_id, nodes: data.nodes, links: data.links, version: data.version };
        set({ activeTaxLawGraphId: data.id, taxLawGraph: tg });
        get().setActiveTaxConfig(data.tax_config_id);
      })
      .catch(() => {});
  },

  async createTaxRule(taxConfigId: number, rule: { name: string; formula: string; description?: string }): Promise<TaxRuleRow | null> {
    const res = await fetch(`/api/v1/tax-configs/${taxConfigId}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });
    if (!res.ok) return null;
    const newRule = await res.json() as TaxRuleRow;
    const rows = get()._taxRuleRows;
    rows.set(taxConfigId, [...(rows.get(taxConfigId) ?? []), newRule]);
    set({ _taxRuleRows: new Map(rows) });
    return newRule;
  },

  triggerRecalculation(): void {
    const state = get();
    const { activeScenarioId, activeTaxConfigId, graphConfig, variableOverrides } = state;
    if (!activeScenarioId || !activeTaxConfigId) return;

    const scenarioDetail = state._scenarioDetails.get(activeScenarioId);
    const taxInputs = state._taxRules.get(activeTaxConfigId);
    const taxRuleRows = state._taxRuleRows.get(activeTaxConfigId);
    if (!scenarioDetail || !taxInputs || !taxRuleRows) return;

    const resolvedVariables = resolveVariables(
      scenarioDetail.finances,
      activeScenarioId,
      taxInputs,
      activeTaxConfigId,
      variableOverrides,
    );

    const formulaResults = evaluateRules(
      taxRuleRows,
      resolvedVariables.variables,
      scenarioDetail.fixed_expenses,
      scenarioDetail.liabilities,
    );

    const updates: Partial<InternalState> = { resolvedVariables, formulaResults };
    if (graphConfig) {
      updates.scoreBreakdown = evaluateScore({
        graphConfig,
        resolvedVariables,
        formulaResults,
        scenarioId: activeScenarioId,
        taxConfigId: activeTaxConfigId,
      });
    }
    set(updates);
  },
}));

export type { ScenarioRow, TaxConfigRow, IncomeRow, AssetRow };
