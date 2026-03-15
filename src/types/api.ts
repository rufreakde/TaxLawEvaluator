import type { ScenarioRow, TaxConfigRow, EconomyMetricRow } from './db.js';
import type { SerializedDiagramState } from './graph.js';

export interface ApiScenarioListResponse {
  scenarios: ScenarioRow[];
}

export interface ApiTaxConfigListResponse {
  taxConfigs: TaxConfigRow[];
}

export interface ApiGraphListResponse {
  graphs: SerializedDiagramState[];
}

export interface ApiGraphResponse {
  graph: SerializedDiagramState | null;
}

export interface ApiEconomyResponse {
  metrics: EconomyMetricRow[];
}

export interface ApiCreateGraphResponse {
  id: string;
}
