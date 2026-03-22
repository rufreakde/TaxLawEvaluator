/**
 * Tests for GraphSerializationService — covers:
 *  - New Source node creation and extraction
 *  - New Tax node creation (existing rule + new rule paths)
 *  - Automatic Source→Logic linking and link capture
 *  - Save Scenario (extractScenarioGraph)
 *  - Save Tax Law  (extractTaxLawGraph)
 *  - Save Eval     (extractEvalGraph)
 *
 * All tests run in the node environment with the `self` polyfill so that
 * @projectstorm/react-diagrams can be imported without a DOM.
 */

// Polyfill browser global required by @projectstorm/react-diagrams
(global as unknown as Record<string, unknown>).self = global;

import { DiagramModel, DefaultLinkModel } from '@projectstorm/react-diagrams';
import type { DiagramEngine } from '@projectstorm/react-diagrams';
import { SourceNodeModel, LogicNodeModel, ResultNodeModel, BenchmarkResultNodeModel } from './TaxNodeModels';
import {
  extractScenarioGraph,
  extractTaxLawGraph,
  extractEvalGraph,
} from './GraphSerializationService';

/** Minimal engine stub — only getModel() is called by the extraction functions. */
function makeEngine(model: DiagramModel): DiagramEngine {
  return { getModel: () => model } as unknown as DiagramEngine;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wire sourceNode.out → logicNode[portName] and add the link to the model. */
function wire(
  model: DiagramModel,
  source: SourceNodeModel,
  logic: LogicNodeModel,
  portName: string,
): DefaultLinkModel {
  const link = new DefaultLinkModel();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  link.setSourcePort(source.getPort('out') as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  link.setTargetPort(logic.getPort(portName) as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model.addLink(link as any);
  return link;
}

// ===========================================================================
// New Source — SourceNodeModel creation and extraction
// ===========================================================================

describe('New Source node', () => {
  it('creates a SourceNode with the given label and static value', () => {
    const node = new SourceNodeModel('Gross Income', 1, 'gross_income', '', 52000);
    expect(node.extras.kind).toBe('SourceNode');
    expect(node.extras.sourceBinding?.inputId).toBe('gross_income');
    expect(node.extras.sourceBinding?.staticValue).toBe(52000);
    expect(node.getOptions().name).toBe('Gross Income');
  });

  it('creates a SourceNode bound to a source expression (no static value)', () => {
    const node = new SourceNodeModel('Salary', 1, 'salary', 'income[0].amount');
    expect(node.extras.sourceBinding?.sourceExpression).toBe('income[0].amount');
    expect(node.extras.sourceBinding?.staticValue).toBeUndefined();
  });

  it('exposes a single out-port named "out"', () => {
    const node = new SourceNodeModel('Income', 1, 'income', '', 1000);
    expect(node.getPort('out')).toBeTruthy();
  });
});

// ===========================================================================
// New Tax node — LogicNodeModel creation (existing rule + new rule paths)
// ===========================================================================

describe('New Tax node — existing rule path', () => {
  it('creates a LogicNode from an existing rule with ruleId and formula', () => {
    const node = new LogicNodeModel('Income Tax', 1, 7, '$a * 0.25');
    expect(node.extras.kind).toBe('LogicNode');
    expect(node.extras.logicBinding?.ruleId).toBe(7);
    expect(node.extras.logicBinding?.formula).toBe('$a * 0.25');
    expect(node.getOptions().name).toBe('Income Tax');
  });

  it('starts with zero input ports', () => {
    const node = new LogicNodeModel('Tax', 1, 3, '$a * 0.1');
    expect(node.extras.logicBinding?.inputCount).toBe(0);
  });

  it('addNamedInputPort creates port matching a formula variable', () => {
    const node = new LogicNodeModel('Tax', 1, 3, '$salary * 0.3');
    node.addNamedInputPort('salary');
    expect(node.getPort('salary')).toBeTruthy();
    expect(node.extras.logicBinding?.inputCount).toBe(1);
  });

  it('addInputPort assigns sequential letters a, b, c …', () => {
    const node = new LogicNodeModel('Tax', 1, 3, '$a + $b');
    expect(node.addInputPort()).toBe('a');
    expect(node.addInputPort()).toBe('b');
    expect(node.extras.logicBinding?.inputCount).toBe(2);
  });
});

describe('New Tax node — new rule path (ruleId = 0)', () => {
  it('creates an empty LogicNode as placeholder when no rule is selected', () => {
    const node = new LogicNodeModel('Logic', 1, 0, '');
    expect(node.extras.logicBinding?.ruleId).toBe(0);
    expect(node.extras.logicBinding?.formula).toBe('');
  });

  it('formula can be set on the binding after construction', () => {
    const node = new LogicNodeModel('Logic', 1, 0, '');
    if (node.extras.logicBinding) node.extras.logicBinding.formula = '$a * 0.15';
    expect(node.extras.logicBinding?.formula).toBe('$a * 0.15');
  });
});

// ===========================================================================
// Automatic linking — Source → Logic wiring
// ===========================================================================

describe('Automatic Source→Logic linking', () => {
  it('wires a single source to a logic input port and link is captured', () => {
    const model = new DiagramModel();
    const source = new SourceNodeModel('Gross Income', 1, 'salary', '', 50000);
    const logic = new LogicNodeModel('Income Tax', 1, 3, '$salary * 0.3');
    logic.addNamedInputPort('salary');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(source as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(logic as any);
    const link = wire(model, source, logic, 'salary');

    const { nodes, links } = extractTaxLawGraph(makeEngine(model));

    expect(nodes).toHaveLength(1);
    expect(links).toHaveLength(1);
    expect(links[0].id).toBe(link.getID());
    expect(links[0].sourceNodeId).toBe(source.getID());
    expect(links[0].sourcePort).toBe('out');
    expect(links[0].targetNodeId).toBe(logic.getID());
    expect(links[0].targetPort).toBe('salary');
  });

  it('wires multiple sources to multiple input ports on the same logic node', () => {
    const model = new DiagramModel();
    const srcA = new SourceNodeModel('Income', 1, 'a', '', 40000);
    const srcB = new SourceNodeModel('Deduction', 1, 'b', '', 5000);
    const logic = new LogicNodeModel('Net Tax', 1, 5, '($a - $b) * 0.3');
    logic.addNamedInputPort('a');
    logic.addNamedInputPort('b');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(srcA as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(srcB as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(logic as any);
    wire(model, srcA, logic, 'a');
    wire(model, srcB, logic, 'b');

    const { nodes, links } = extractTaxLawGraph(makeEngine(model));

    expect(nodes).toHaveLength(1);
    expect(links).toHaveLength(2);

    const byTarget = Object.fromEntries(links.map((l) => [l.targetPort, l]));
    expect(byTarget['a'].sourceNodeId).toBe(srcA.getID());
    expect(byTarget['b'].sourceNodeId).toBe(srcB.getID());
  });

  it('auto-link between two logic nodes is also captured', () => {
    const model = new DiagramModel();
    const logicA = new LogicNodeModel('Step 1', 1, 1, '$a * 2');
    const logicB = new LogicNodeModel('Step 2', 1, 2, '$x + 1');
    logicA.addNamedInputPort('a');
    logicB.addNamedInputPort('x');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(logicA as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(logicB as any);

    // Wire logicA.out → logicB.x
    const link = new DefaultLinkModel();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    link.setSourcePort(logicA.getPort('out') as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    link.setTargetPort(logicB.getPort('x') as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addLink(link as any);

    const { nodes, links } = extractTaxLawGraph(makeEngine(model));
    expect(nodes).toHaveLength(2);
    expect(links).toHaveLength(1);
    expect(links[0].sourceNodeId).toBe(logicA.getID());
    expect(links[0].targetNodeId).toBe(logicB.getID());
    expect(links[0].targetPort).toBe('x');
  });

  it('link without a connected target port is ignored', () => {
    const model = new DiagramModel();
    const source = new SourceNodeModel('Income', 1, 'a', '', 1000);
    const logic = new LogicNodeModel('Tax', 1, 1, '$a * 0.1');
    logic.addNamedInputPort('a');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(source as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(logic as any);

    // Dangling link — source port only, no target
    const dangling = new DefaultLinkModel();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dangling.setSourcePort(source.getPort('out') as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addLink(dangling as any);

    const { links } = extractTaxLawGraph(makeEngine(model));
    expect(links).toHaveLength(0);
  });

  it('Source→Result link is NOT captured in extractTaxLawGraph', () => {
    const model = new DiagramModel();
    const source = new SourceNodeModel('Income', 1, 'a', '', 1000);
    const result = new ResultNodeModel('Output', 1, 'out', 'rule');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(source as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(result as any);

    const link = new DefaultLinkModel();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    link.setSourcePort(source.getPort('out') as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    link.setTargetPort(result.getPort('in') as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addLink(link as any);

    const { links } = extractTaxLawGraph(makeEngine(model));
    expect(links).toHaveLength(0);
  });
});

// ===========================================================================
// Save Scenario — extractScenarioGraph
// ===========================================================================

describe('extractScenarioGraph (Save Scenario)', () => {
  it('returns empty nodes for an empty canvas', () => {
    const model = new DiagramModel();
    const { nodes } = extractScenarioGraph(makeEngine(model));
    expect(nodes).toHaveLength(0);
  });

  it('extracts a newly added source node with all fields', () => {
    const model = new DiagramModel();
    const node = new SourceNodeModel('Gross Income', 1, 'gross_income', '', 52000);
    node.setPosition(40, 60);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(node as any);

    const { nodes } = extractScenarioGraph(makeEngine(model));
    expect(nodes).toHaveLength(1);
    expect(nodes[0].nodeId).toBe(node.getID());
    expect(nodes[0].inputId).toBe('gross_income');
    expect(nodes[0].label).toBe('Gross Income');
    expect(nodes[0].x).toBe(40);
    expect(nodes[0].y).toBe(60);
    expect(nodes[0].staticValueOverride).toBe(52000);
  });

  it('omits staticValueOverride when staticValue is undefined', () => {
    const model = new DiagramModel();
    const node = new SourceNodeModel('Salary', 1, 'salary', 'income[0].amount');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(node as any);

    const { nodes } = extractScenarioGraph(makeEngine(model));
    expect('staticValueOverride' in nodes[0]).toBe(false);
  });

  it('extracts multiple source nodes independently', () => {
    const model = new DiagramModel();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(new SourceNodeModel('A', 1, 'a', '', 100) as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(new SourceNodeModel('B', 1, 'b', '', 200) as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(new SourceNodeModel('C', 1, 'c', '', 300) as any);

    const { nodes } = extractScenarioGraph(makeEngine(model));
    expect(nodes).toHaveLength(3);
    expect(nodes.map((n) => n.inputId).sort()).toEqual(['a', 'b', 'c']);
    expect(nodes.map((n) => n.staticValueOverride).sort((x, y) => (x ?? 0) - (y ?? 0))).toEqual([100, 200, 300]);
  });

  it('excludes LogicNodes and ResultNodes from scenario extraction', () => {
    const model = new DiagramModel();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(new SourceNodeModel('Source', 1, 'src', '', 1) as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(new LogicNodeModel('Logic', 1, 1, '$a') as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(new ResultNodeModel('Result', 1, 'out', 'rule') as any);

    const { nodes } = extractScenarioGraph(makeEngine(model));
    expect(nodes).toHaveLength(1);
    expect(nodes[0].inputId).toBe('src');
  });

  it('serialize() round-trips sourceBinding', () => {
    const node = new SourceNodeModel('Income', 1, 'income', 'income[0].amount', 3000);
    const s = node.serialize();
    expect(s.extras.sourceBinding?.inputId).toBe('income');
    expect(s.extras.sourceBinding?.staticValue).toBe(3000);
    expect(s.extras.kind).toBe('SourceNode');
  });
});

// ===========================================================================
// Save Tax Law — extractTaxLawGraph
// ===========================================================================

describe('extractTaxLawGraph (Save Tax Law)', () => {
  it('returns empty nodes and links for an empty canvas', () => {
    const model = new DiagramModel();
    const { nodes, links } = extractTaxLawGraph(makeEngine(model));
    expect(nodes).toHaveLength(0);
    expect(links).toHaveLength(0);
  });

  it('extracts a logic node with ruleId, ruleName, position and inputCount', () => {
    const model = new DiagramModel();
    const node = new LogicNodeModel('Income Tax', 1, 7, '$a * 0.25');
    node.addInputPort(); // 'a'
    node.setPosition(340, 100);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(node as any);

    const { nodes } = extractTaxLawGraph(makeEngine(model));
    expect(nodes).toHaveLength(1);
    expect(nodes[0].nodeId).toBe(node.getID());
    expect(nodes[0].ruleId).toBe(7);
    expect(nodes[0].ruleName).toBe('Income Tax');
    expect(nodes[0].x).toBe(340);
    expect(nodes[0].y).toBe(100);
    expect(nodes[0].inputCount).toBe(1);
  });

  it('captures portLabels when set', () => {
    const model = new DiagramModel();
    const node = new LogicNodeModel('Tax', 1, 3, '$a * 0.1');
    node.addNamedInputPort('a');
    if (node.extras.logicBinding) {
      node.extras.logicBinding.portLabels = { a: 'Gross Salary' };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(node as any);

    const { nodes } = extractTaxLawGraph(makeEngine(model));
    expect(nodes[0].portLabels).toEqual({ a: 'Gross Salary' });
  });

  it('full round-trip: Source+Logic wired together → both node and link captured', () => {
    const model = new DiagramModel();
    const source = new SourceNodeModel('Salary', 1, 'salary', '', 45000);
    const logic = new LogicNodeModel('Payroll Tax', 1, 9, '$salary * 0.22');
    logic.addNamedInputPort('salary');
    source.setPosition(40, 60);
    logic.setPosition(340, 60);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(source as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(logic as any);
    wire(model, source, logic, 'salary');

    const { nodes, links } = extractTaxLawGraph(makeEngine(model));
    expect(nodes).toHaveLength(1);
    expect(nodes[0].ruleName).toBe('Payroll Tax');
    expect(links).toHaveLength(1);
    expect(links[0].sourceNodeId).toBe(source.getID());
    expect(links[0].targetNodeId).toBe(logic.getID());
    expect(links[0].targetPort).toBe('salary');
  });

  it('handles multiple logic nodes each with their own wiring', () => {
    const model = new DiagramModel();
    const srcIncome = new SourceNodeModel('Income', 1, 'income', '', 60000);
    const srcDeduct = new SourceNodeModel('Deductions', 1, 'deductions', '', 10000);
    const rule1 = new LogicNodeModel('Gross Tax', 1, 1, '$income * 0.3');
    const rule2 = new LogicNodeModel('Net Tax', 1, 2, '$income - $deductions');
    rule1.addNamedInputPort('income');
    rule2.addNamedInputPort('income');
    rule2.addNamedInputPort('deductions');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [srcIncome, srcDeduct, rule1, rule2].forEach((n) => model.addNode(n as any));
    wire(model, srcIncome, rule1, 'income');
    wire(model, srcIncome, rule2, 'income');
    wire(model, srcDeduct, rule2, 'deductions');

    const { nodes, links } = extractTaxLawGraph(makeEngine(model));
    expect(nodes).toHaveLength(2);
    expect(links).toHaveLength(3);

    const rule1Links = links.filter((l) => l.targetNodeId === rule1.getID());
    const rule2Links = links.filter((l) => l.targetNodeId === rule2.getID());
    expect(rule1Links).toHaveLength(1);
    expect(rule2Links).toHaveLength(2);
  });

  it('serialize() round-trips logicBinding with formula and inputCount', () => {
    const node = new LogicNodeModel('Tax', 1, 5, '$a + $b');
    node.addInputPort();
    node.addInputPort();
    const s = node.serialize();
    expect(s.extras.logicBinding?.formula).toBe('$a + $b');
    expect(s.extras.logicBinding?.inputCount).toBe(2);
  });
});

// ===========================================================================
// extractEvalGraph (Result & BenchmarkResult nodes)
// ===========================================================================

describe('extractEvalGraph', () => {
  it('returns empty for an empty canvas', () => {
    const model = new DiagramModel();
    const { nodes, links } = extractEvalGraph(makeEngine(model));
    expect(nodes).toHaveLength(0);
    expect(links).toHaveLength(0);
  });

  it('extracts a ResultNode with all fields', () => {
    const model = new DiagramModel();
    const result = new ResultNodeModel('State Income', 1, 'state_income', 'income_tax');
    result.setPosition(600, 100);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(result as any);

    const { nodes } = extractEvalGraph(makeEngine(model));
    expect(nodes).toHaveLength(1);
    expect(nodes[0].nodeId).toBe(result.getID());
    expect(nodes[0].outputId).toBe('state_income');
    expect(nodes[0].referenceRule).toBe('income_tax');
    expect(nodes[0].label).toBe('State Income');
    expect(nodes[0].x).toBe(600);
    expect(nodes[0].y).toBe(100);
    expect(nodes[0].targetValue).toBeUndefined();
  });

  it('extracts a BenchmarkResultNode with targetValue', () => {
    const model = new DiagramModel();
    const benchmark = new BenchmarkResultNodeModel('Revenue Target', 'bench-123', 100000, 'state_income', 1);
    benchmark.setPosition(600, 200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(benchmark as any);

    const { nodes } = extractEvalGraph(makeEngine(model));
    expect(nodes).toHaveLength(1);
    expect(nodes[0].nodeId).toBe(benchmark.getID());
    expect(nodes[0].outputId).toBe('state_income');
    expect(nodes[0].label).toBe('Revenue Target');
    expect(nodes[0].targetValue).toBe(100000);
    expect(nodes[0].referenceRule).toBeUndefined(); // optional
  });

  it('captures a Logic→Result link', () => {
    const model = new DiagramModel();
    const logic = new LogicNodeModel('Income Tax', 1, 3, '$a * 0.2');
    const result = new ResultNodeModel('Output', 1, 'net_income', 'income_tax');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(logic as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(result as any);

    const link = new DefaultLinkModel();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    link.setSourcePort(logic.getPort('out') as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    link.setTargetPort(result.getPort('in') as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addLink(link as any);

    const { links } = extractEvalGraph(makeEngine(model));
    expect(links).toHaveLength(1);
    expect(links[0].sourceNodeId).toBe(logic.getID());
    expect(links[0].sourcePort).toBe('out');
    expect(links[0].targetNodeId).toBe(result.getID());
    expect(links[0].targetPort).toBe('in');
  });

  it('handles mixed ResultNode and BenchmarkResultNode on same canvas', () => {
    const model = new DiagramModel();
    const result = new ResultNodeModel('Regular Output', 1, 'total', 'total_rule');
    result.setPosition(100, 100);
    const benchmark = new BenchmarkResultNodeModel('Target', 'b1', 50000, 'total', 1);
    benchmark.setPosition(100, 250);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(result as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(benchmark as any);

    const { nodes } = extractEvalGraph(makeEngine(model));
    expect(nodes).toHaveLength(2);
    const resultEntry = nodes.find(n => n.label === 'Regular Output');
    const benchEntry = nodes.find(n => n.label === 'Target');
    expect(resultEntry).toBeDefined();
    expect(benchEntry).toBeDefined();
    expect(resultEntry?.targetValue).toBeUndefined();
    expect(benchEntry?.targetValue).toBe(50000);
  });
});
