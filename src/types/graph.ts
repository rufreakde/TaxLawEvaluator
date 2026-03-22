export type TaxNodeKind = 'SourceNode' | 'LogicNode' | 'ResultNode' | 'BenchmarkResultNode';

export interface TaxNodeExtras {
  kind: TaxNodeKind;
  taxConfigId: number;
  sourceBinding?: {
    inputId: string;
    sourceExpression: string;
    staticValue?: number;
  };
  logicBinding?: {
    ruleId: number;
    formula: string;
    inputCount?: number;
    portLabels?: Record<string, string>;
  };
  resultBinding?: {
    outputId: string;
    referenceRule: string;
  };
  benchmarkResultBinding?: {
    targetValue: number;
    benchmarkId: string;
    outputId?: string;
  };
}

export interface TaxNodeDescriptor {
  id: string;
  kind: TaxNodeKind;
  label: string;
  x: number;
  y: number;
  extras: TaxNodeExtras;
  inPorts: string[];
  outPorts: string[];
}

export interface TaxLinkDescriptor {
  id: string;
  sourcePortId: string;
  targetPortId: string;
}

/** Legacy monolithic graph config — kept for backward-compat with existing load path */
export interface GraphConfig {
  id: string;
  name: string;
  taxConfigId: number;
  nodes: TaxNodeDescriptor[];
  links: TaxLinkDescriptor[];
}

export interface SerializedDiagramState {
  id: string;
  name: string;
  tax_config_id: number;
  user_id: number | null;
  created_at: string;
  updated_at: string;
  diagram_json: string;
}

export interface TaxNodeFactory {
  type: TaxNodeKind;
  getNewInstance(taxConfigId: number): unknown;
}

// ---------------------------------------------------------------------------
// Scenario Graph — Source nodes: who the taxpayer is, their input values
// ---------------------------------------------------------------------------

export interface ScenarioNodeEntry {
  nodeId: string;
  inputId: string;
  label: string;
  x: number;
  y: number;
  staticValueOverride?: number;
}

export interface ScenarioGraph {
  id: string;
  name: string;
  taxConfigId: number;
  user_id: number | null;
  nodes: ScenarioNodeEntry[];
  version: number;
  sourceFile?: string;
}

// ---------------------------------------------------------------------------
// Tax Law Graph — Logic nodes: how the tax is computed
// ---------------------------------------------------------------------------

export interface TaxLawNodeEntry {
  nodeId: string;
  ruleId: number;
  ruleName: string;
  x: number;
  y: number;
  portLabels?: Record<string, string>;
  inputCount?: number;
}

export interface GraphLinkEntry {
  id: string;
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetPort: string;
}

export interface TaxLawGraph {
  id: string;
  name: string;
  taxConfigId: number;
  user_id: number | null;
  nodes: TaxLawNodeEntry[];
  links: GraphLinkEntry[];
  version: number;
  sourceFile?: string;
}

// ---------------------------------------------------------------------------
// Eval Graph — Sink nodes: what we measure (designed in, wired later)
// ---------------------------------------------------------------------------

export interface EvalNodeEntry {
  nodeId: string;
  outputId: string;
  referenceRule?: string;
  label: string;
  x: number;
  y: number;
  targetValue?: number;
}

export interface EvalGraph {
  id: string;
  name: string;
  taxConfigId: number;
  user_id: number | null;
  nodes: EvalNodeEntry[];
  links: GraphLinkEntry[];
  version: number;
  sourceFile?: string;
}
