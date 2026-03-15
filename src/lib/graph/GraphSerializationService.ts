/**
 * Extracts domain-specific graph payloads from a react-diagrams engine.
 * Each function reads the live canvas and returns a typed, serializable structure.
 * No React dependencies — pure model traversal.
 */
import type { DiagramEngine } from '@projectstorm/react-diagrams';
import type {
  ScenarioNodeEntry,
  TaxLawNodeEntry,
  GraphLinkEntry,
  EvalNodeEntry,
} from '../../types/graph.js';

export interface ScenarioGraphPayload {
  nodes: ScenarioNodeEntry[];
}

export interface TaxLawGraphPayload {
  nodes: TaxLawNodeEntry[];
  links: GraphLinkEntry[];
}

export interface EvalGraphPayload {
  nodes: EvalNodeEntry[];
  links: GraphLinkEntry[];
}

/** Extract all Source nodes from the canvas. */
export function extractScenarioGraph(engine: DiagramEngine): ScenarioGraphPayload {
  const model = engine.getModel();
  const nodes: ScenarioNodeEntry[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Object.values((model as any).getNodes()).forEach((node: any) => {
    if (node.extras?.kind !== 'SourceNode') return;
    const pos = node.getPosition();
    const entry: ScenarioNodeEntry = {
      nodeId: node.getID() as string,
      inputId: (node.extras.sourceBinding?.inputId ?? '') as string,
      label: (node.getOptions().name ?? '') as string,
      x: pos.x as number,
      y: pos.y as number,
    };
    if (node.extras.sourceBinding?.staticValue !== undefined) {
      entry.staticValueOverride = node.extras.sourceBinding.staticValue as number;
    }
    nodes.push(entry);
  });

  return { nodes };
}

/** Extract all Logic nodes and any links that target them. */
export function extractTaxLawGraph(engine: DiagramEngine): TaxLawGraphPayload {
  const model = engine.getModel();
  const nodes: TaxLawNodeEntry[] = [];
  const links: GraphLinkEntry[] = [];
  const logicNodeIds = new Set<string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Object.values((model as any).getNodes()).forEach((node: any) => {
    if (node.extras?.kind !== 'LogicNode') return;
    const pos = node.getPosition();
    logicNodeIds.add(node.getID() as string);
    const entry: TaxLawNodeEntry = {
      nodeId: node.getID() as string,
      ruleId: (node.extras.logicBinding?.ruleId ?? 0) as number,
      ruleName: (node.getOptions().name ?? '') as string,
      x: pos.x as number,
      y: pos.y as number,
    };
    if (node.extras.logicBinding?.portLabels) {
      entry.portLabels = node.extras.logicBinding.portLabels as Record<string, string>;
    }
    if (node.extras.logicBinding?.inputCount !== undefined) {
      entry.inputCount = node.extras.logicBinding.inputCount as number;
    }
    nodes.push(entry);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Object.values((model as any).getLinks()).forEach((link: any) => {
    const sourcePort = link.getSourcePort?.();
    const targetPort = link.getTargetPort?.();
    if (!sourcePort || !targetPort) return;
    const targetNodeId = targetPort.getNode?.()?.getID?.() as string | undefined;
    if (!targetNodeId || !logicNodeIds.has(targetNodeId)) return;
    links.push({
      id: link.getID() as string,
      sourceNodeId: (sourcePort.getNode?.()?.getID?.() ?? '') as string,
      sourcePort: (sourcePort.getName?.() ?? '') as string,
      targetNodeId,
      targetPort: (targetPort.getName?.() ?? '') as string,
    });
  });

  return { nodes, links };
}

/** Extract all Sink nodes and any links that target them. */
export function extractEvalGraph(engine: DiagramEngine): EvalGraphPayload {
  const model = engine.getModel();
  const nodes: EvalNodeEntry[] = [];
  const links: GraphLinkEntry[] = [];
  const sinkNodeIds = new Set<string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Object.values((model as any).getNodes()).forEach((node: any) => {
    if (node.extras?.kind !== 'SinkNode') return;
    const pos = node.getPosition();
    sinkNodeIds.add(node.getID() as string);
    nodes.push({
      nodeId: node.getID() as string,
      outputId: (node.extras.sinkBinding?.outputId ?? '') as string,
      referenceRule: (node.extras.sinkBinding?.referenceRule ?? '') as string,
      label: (node.getOptions().name ?? '') as string,
      x: pos.x as number,
      y: pos.y as number,
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Object.values((model as any).getLinks()).forEach((link: any) => {
    const sourcePort = link.getSourcePort?.();
    const targetPort = link.getTargetPort?.();
    if (!sourcePort || !targetPort) return;
    const targetNodeId = targetPort.getNode?.()?.getID?.() as string | undefined;
    if (!targetNodeId || !sinkNodeIds.has(targetNodeId)) return;
    links.push({
      id: link.getID() as string,
      sourceNodeId: (sourcePort.getNode?.()?.getID?.() ?? '') as string,
      sourcePort: (sourcePort.getName?.() ?? '') as string,
      targetNodeId,
      targetPort: (targetPort.getName?.() ?? '') as string,
    });
  });

  return { nodes, links };
}
