export type TaxNodeKind = 'SourceNode' | 'LogicNode' | 'SinkNode';

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
  sinkBinding?: {
    outputId: string;
    referenceRule: string;
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
  created_at: string;
  updated_at: string;
  diagram_json: string;
}

export interface TaxNodeFactory {
  type: TaxNodeKind;
  getNewInstance(taxConfigId: number): unknown;
}
