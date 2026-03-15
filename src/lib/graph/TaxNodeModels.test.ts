// @projectstorm/react-diagrams references `self` (browser global) at module load time
// Polyfill it before importing so the test can run in the node environment
(global as unknown as Record<string, unknown>).self = global;

// Import only the model classes, not factories (factories import React which needs DOM)
import { SourceNodeModel, LogicNodeModel, SinkNodeModel } from './TaxNodeModels';

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

describe('SinkNodeModel', () => {
  it('sets sinkBinding extras on construction', () => {
    const node = new SinkNodeModel('Output', 1, 'net_income', 'income_tax');
    expect(node.extras.kind).toBe('SinkNode');
    expect(node.extras.sinkBinding?.outputId).toBe('net_income');
  });

  it('serialize() round-trips sinkBinding', () => {
    const node = new SinkNodeModel('Output', 1, 'net', 'rule_1');
    const s = node.serialize();
    expect(s.extras.sinkBinding?.referenceRule).toBe('rule_1');
  });
});
