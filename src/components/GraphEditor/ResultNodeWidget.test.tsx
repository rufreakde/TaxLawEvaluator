import React from 'react';
import { render, screen } from '@testing-library/react';
import { ResultNodeWidget } from './ResultNodeWidget';
import type { ResultNodeModel } from '../../lib/graph/TaxNodeModels';
import type { DiagramEngine } from '@projectstorm/react-diagrams';

// Mock the useAppStore hook
const mockResolvedVariables = {
  scenarioId: 1,
  taxConfigId: 1,
  variables: { a: 1000, b: 2000 },
  resolvedAt: Date.now(),
};
const mockUseAppStore = jest.fn().mockReturnValue({
  resolvedVariables: mockResolvedVariables,
  scenarios: [{ id: 1, currency: 'EUR' }],
  activeScenarioId: 1,
});

// Need to mock the store import
jest.mock('../../store/appStore.js', () => ({
  useAppStore: mockUseAppStore,
}));

describe('ResultNodeWidget', () => {
  let engine: DiagramEngine;

  beforeEach(() => {
    // Create a minimal engine stub
    engine = {
      getModel: () => ({
        getNodes: () => ({}),
        getLinks: () => ({}),
      }),
      repaintCanvas: jest.fn(),
    } as unknown as DiagramEngine;
  });

  function createNodeWithLinks(linkValues: Array<{ value: number; kind: 'SourceNode' | 'LogicNode' | 'ResultNode' }>): ResultNodeModel {
    const node = new ResultNodeModel('Sum Result', 1, 'total', 'total_rule');
    // In a full test, we would mock the port links and source nodes properly
    // For unit test, we'll focus on rendering; integration test would cover aggregation logic
    return node;
  }

  it('renders node with label', () => {
    const node = new ResultNodeModel('Total Income', 1, 'total_income', 'total');
    // @ts-expect-error - simplified engine mock
    render(<ResultNodeWidget engine={engine} node={node} />);
    expect(screen.getByText('Total Income')).toBeInTheDocument();
  });

  it('shows "—" when no input connected', () => {
    const node = new ResultNodeModel('Sum', 1, 'sum', 'sum_rule');
    // @ts-expect-error
    render(<ResultNodeWidget engine={engine} node={node} />);
    // The widget will check inPort links; with no links, result = undefined => '—'
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('displays an output port', () => {
    const node = new ResultNodeModel('Result', 1, 'out', 'rule');
    // @ts-expect-error
    const { container } = render(<ResultNodeWidget engine={engine} node={node} />);
    // The output port is rendered as a div with specific class inside the PortWidget
    const portWidgets = container.querySelectorAll('.PortWidget');
    expect(portWidgets.length).toBeGreaterThan(0);
  });

  it('shows delete button on hover (present in DOM)', () => {
    const node = new ResultNodeModel('Delete Me', 1, 'out', 'rule');
    // @ts-expect-error
    render(<ResultNodeWidget engine={engine} node={node} />);
    const deleteBtn = screen.getByTitle('Delete node');
    expect(deleteBtn).toBeInTheDocument();
  });
});
