import { evaluate, NodeCountPenaltyRule, FormulaRulePenaltyRule } from './ScoringEngine';
import type { ScoringContext } from '../../types/scoring';
import type { GraphConfig } from '../../types/graph';

function makeContext(nodes: GraphConfig['nodes']): ScoringContext {
  return {
    graphConfig: { id: 'g1', name: 'Test', taxConfigId: 1, nodes, links: [] },
    resolvedVariables: { scenarioId: 1, taxConfigId: 1, variables: {}, resolvedAt: 0 },
    formulaResults: { results: {}, disposableIncome: 30000 },
    scenarioId: 1,
    taxConfigId: 1,
  };
}

describe('ScoringEngine', () => {
  it('starts at base 100 with no nodes', () => {
    const result = evaluate(makeContext([]));
    expect(result.baseScore).toBe(100);
    expect(result.totalScore).toBe(100);
  });

  it('deducts 1 point per node', () => {
    const nodes: GraphConfig['nodes'] = [
      { id: 'n1', kind: 'SourceNode', label: 'S', x: 0, y: 0, extras: { kind: 'SourceNode', taxConfigId: 1 }, inPorts: [], outPorts: ['out'] },
      { id: 'n2', kind: 'LogicNode', label: 'L', x: 0, y: 0, extras: { kind: 'LogicNode', taxConfigId: 1 }, inPorts: ['in'], outPorts: ['out'] },
    ];
    const result = evaluate(makeContext(nodes), [new NodeCountPenaltyRule()]);
    expect(result.totalScore).toBe(98);
  });

  it('deducts 1 point per LogicNode (formula rule penalty)', () => {
    const nodes: GraphConfig['nodes'] = [
      { id: 'n1', kind: 'SourceNode', label: 'S', x: 0, y: 0, extras: { kind: 'SourceNode', taxConfigId: 1 }, inPorts: [], outPorts: ['out'] },
      { id: 'n2', kind: 'LogicNode', label: 'L1', x: 0, y: 0, extras: { kind: 'LogicNode', taxConfigId: 1 }, inPorts: ['in'], outPorts: ['out'] },
      { id: 'n3', kind: 'LogicNode', label: 'L2', x: 0, y: 0, extras: { kind: 'LogicNode', taxConfigId: 1 }, inPorts: ['in'], outPorts: ['out'] },
    ];
    const result = evaluate(makeContext(nodes), [new FormulaRulePenaltyRule()]);
    expect(result.totalScore).toBe(98); // 100 - 2 LogicNodes
  });

  it('applies both rules: 2 nodes (both LogicNodes) → 100 - 2 - 2 = 96', () => {
    const nodes: GraphConfig['nodes'] = [
      { id: 'n1', kind: 'LogicNode', label: 'L1', x: 0, y: 0, extras: { kind: 'LogicNode', taxConfigId: 1 }, inPorts: ['in'], outPorts: ['out'] },
      { id: 'n2', kind: 'LogicNode', label: 'L2', x: 0, y: 0, extras: { kind: 'LogicNode', taxConfigId: 1 }, inPorts: ['in'], outPorts: ['out'] },
    ];
    const result = evaluate(makeContext(nodes));
    expect(result.totalScore).toBe(96);
  });
});
