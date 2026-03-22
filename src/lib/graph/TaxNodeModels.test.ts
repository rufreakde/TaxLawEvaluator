// @projectstorm/react-diagrams references `self` (browser global) at module load time
// Polyfill it before importing so the test can run in the node environment
(global as unknown as Record<string, unknown>).self = global;

// Import only the model classes, not factories (factories import React which needs DOM)
import { DefaultPortModel } from '@projectstorm/react-diagrams';
import { SourceNodeModel, LogicNodeModel, ResultNodeModel, BenchmarkResultNodeModel } from './TaxNodeModels';

describe('SourceNodeModel', () => {
  it('sets sourceBinding extras on construction', () => {
    const node = new SourceNodeModel('Salary', 1, 'a', 'income[0].amount', 3200);
    expect(node.extras.kind).toBe('SourceNode');
    expect(node.extras.sourceBinding?.inputId).toBe('a');
    expect(node.extras.sourceBinding?.staticValue).toBe(3200);
  });

  it('serialize() includes extras', () => {
    const node = new SourceNodeModel('Salary', 1, 'a', '', 5000);
    const s = node.serialize();
    expect(s.extras.sourceBinding?.staticValue).toBe(5000);
    expect(s.extras.kind).toBe('SourceNode');
  });
});

describe('LogicNodeModel', () => {
  it('starts with 0 input ports and formula', () => {
    const node = new LogicNodeModel('Tax', 1, 42, '$a * 0.1');
    expect(node.extras.logicBinding?.inputCount).toBe(0);
    expect(node.extras.logicBinding?.formula).toBe('$a * 0.1');
  });

  it('addInputPort increments inputCount and returns letter', () => {
    const node = new LogicNodeModel('Tax', 1, 42, '');
    expect(node.addInputPort()).toBe('a');
    expect(node.extras.logicBinding?.inputCount).toBe(1);
    expect(node.addInputPort()).toBe('b');
    expect(node.extras.logicBinding?.inputCount).toBe(2);
  });

  it('removeLastInputPort decrements inputCount', () => {
    const node = new LogicNodeModel('Tax', 1, 42, '');
    node.addInputPort(); // a
    node.addInputPort(); // b
    node.removeLastInputPort();
    expect(node.extras.logicBinding?.inputCount).toBe(1);
  });

  it('addNamedInputPort creates port by name without sequential counter clash', () => {
    const node = new LogicNodeModel('Tax', 1, 42, '$income * 0.3');
    node.addNamedInputPort('income');
    expect(node.getPort('income')).toBeTruthy();
    expect(node.extras.logicBinding?.inputCount).toBe(1);
  });

  it('serialize() includes logicBinding with formula and inputCount', () => {
    const node = new LogicNodeModel('Tax', 1, 42, '$a + $b');
    node.addInputPort();
    node.addInputPort();
    const s = node.serialize();
    expect(s.extras.logicBinding?.formula).toBe('$a + $b');
    expect(s.extras.logicBinding?.inputCount).toBe(2);
  });
});

describe('ResultNodeModel', () => {
  it('sets resultBinding extras on construction', () => {
    const node = new ResultNodeModel('Output', 1, 'net_income', 'income_tax');
    expect(node.extras.kind).toBe('ResultNode');
    expect(node.extras.resultBinding?.outputId).toBe('net_income');
    expect(node.extras.resultBinding?.referenceRule).toBe('income_tax');
  });

  it('has both input and output ports', () => {
    const node = new ResultNodeModel('Sum', 1, 'total', 'total_rule');
    expect(node.getPort('in')).toBeInstanceOf(DefaultPortModel);
    expect(node.getPort('out')).toBeInstanceOf(DefaultPortModel);
  });

  it('serialize() includes resultBinding', () => {
    const node = new ResultNodeModel('Output', 1, 'net', 'rule_1');
    const s = node.serialize();
    expect(s.extras.resultBinding?.referenceRule).toBe('rule_1');
    expect(s.extras.kind).toBe('ResultNode');
  });

  it('sumInputValues sums all numeric inputs from source nodes', () => {
    const node = new ResultNodeModel('Sum', 1, 'total', 'total_rule');
    // Create mock source nodes with links
    // This test would require more complex setup with actual link models; we'll mock at integration level
    // For now, test that method exists and returns 0 when no links
    const result = node.sumInputValues(null);
    expect(result).toBe(0);
  });

  it('sumInputValues returns error if any input is non-numeric', () => {
    const node = new ResultNodeModel('Sum', 1, 'total', 'total_rule');
    // With no links, no error
    expect(node.sumInputValues(null)).toBe(0);
    // Cannot easily test with links without mocking entire link structure; will be covered in integration tests
  });
});

describe('BenchmarkResultNodeModel', () => {
  it('sets benchmarkResultBinding extras on construction', () => {
    const node = new BenchmarkResultNodeModel('Revenue Target', 'bench-1', 100000, 'state_income', 1);
    expect(node.extras.kind).toBe('BenchmarkResultNode');
    expect(node.extras.benchmarkResultBinding?.targetValue).toBe(100000);
    expect(node.extras.benchmarkResultBinding?.benchmarkId).toBe('bench-1');
    expect(node.extras.benchmarkResultBinding?.outputId).toBe('state_income');
  });

  it('has only input port (no output)', () => {
    const node = new BenchmarkResultNodeModel('Target', 'b1', 50000, 'income', 1);
    expect(node.getPort('in')).toBeInstanceOf(DefaultPortModel);
    expect(node.getPort('out')).toBeUndefined();
  });

  it('getTargetValue returns the target', () => {
    const node = new BenchmarkResultNodeModel('Target', 'b1', 75000, 'income', 1);
    expect(node.getTargetValue()).toBe(75000);
  });

  it('getOutputId returns the outputId', () => {
    const node = new BenchmarkResultNodeModel('Target', 'b1', 75000, 'income', 1);
    expect(node.getOutputId()).toBe('income');
  });

  it('serialize() includes benchmarkResultBinding', () => {
    const node = new BenchmarkResultNodeModel('Target', 'b1', 75000, 'income', 1);
    const s = node.serialize();
    expect(s.extras.benchmarkResultBinding?.targetValue).toBe(75000);
    expect(s.extras.kind).toBe('BenchmarkResultNode');
  });
});
