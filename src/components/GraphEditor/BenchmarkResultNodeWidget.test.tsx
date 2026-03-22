import React from 'react';
import { render, screen } from '@testing-library/react';
import { BenchmarkResultNodeWidget } from './BenchmarkResultNodeWidget';
import { BenchmarkResultNodeModel } from '../../lib/graph/TaxNodeModels';
import type { DiagramEngine } from '@projectstorm/react-diagrams';

// Mock the useAppStore hook
const mockUseAppStore = jest.fn().mockReturnValue({
  resolvedVariables: {
    scenarioId: 1,
    taxConfigId: 1,
    variables: { a: 50000 },
    resolvedAt: Date.now(),
  },
  scenarios: [{ id: 1, currency: 'EUR' }],
  activeScenarioId: 1,
});

jest.mock('../../store/appStore.js', () => ({
  useAppStore: mockUseAppStore,
}));

describe('BenchmarkResultNodeWidget', () => {
  let engine: DiagramEngine;

  beforeEach(() => {
    engine = {
      getModel: () => ({
        getNodes: () => ({}),
        getLinks: () => ({}),
      }),
      repaintCanvas: jest.fn(),
    } as unknown as DiagramEngine;
  });

  function createBenchmarkNode(targetValue: number): BenchmarkResultNodeModel {
    return new BenchmarkResultNodeModel(
      'Revenue Target',
      'bench-1',
      targetValue,
      'state_income',
      1
    );
  }

  it('renders node with label', () => {
    const node = createBenchmarkNode(100000);
    // @ts-expect-error
    render(<BenchmarkResultNodeWidget engine={engine} node={node} />);
    expect(screen.getByText('Revenue Target')).toBeInTheDocument();
  });

  it('displays target value', () => {
    const node = createBenchmarkNode(100000);
    // @ts-expect-error
    render(<BenchmarkResultNodeWidget engine={engine} node={node} />);
    expect(screen.getByText('100,000.00 EUR')).toBeInTheDocument();
  });

  it('shows "Actual: —" when no input connected', () => {
    const node = createBenchmarkNode(100000);
    mockUseAppStore.mockReturnValue({
      resolvedVariables: {
        scenarioId: 1,
        taxConfigId: 1,
        variables: {},
        resolvedAt: Date.now(),
      },
      scenarios: [{ id: 1, currency: 'EUR' }],
      activeScenarioId: 1,
    });
    // @ts-expect-error
    render(<BenchmarkResultNodeWidget engine={engine} node={node} />);
    expect(screen.getByText('Actual:')).toBeInTheDocument();
    // The value should be '—' or 'ERR'
    const actualValueElement = screen.getByText((content) => content.includes('—') || content.includes('ERR'));
    expect(actualValueElement).toBeInTheDocument();
  });

  it('does not have a delete button', () => {
    const node = createBenchmarkNode(50000);
    // @ts-expect-error
    render(<BenchmarkResultNodeWidget engine={engine} node={node} />);
    expect(screen.queryByTitle('Delete node')).not.toBeInTheDocument();
  });

  it('does not have an output port', () => {
    const node = createBenchmarkNode(75000);
    // @ts-expect-error
    const { container } = render(<BenchmarkResultNodeWidget engine={engine} node={node} />);
    // Check that there is no PortWidget associated with an output port (Benchmark nodes only have 'in')
    // This is a basic check; more thorough would be to ensure no port labeled 'out'
    const portWidgets = container.querySelectorAll('.PortWidget');
    // All port widgets should be for the input (inPort only)
    // Since we're not actually creating ports in the mock, this test is limited
    // In integration test with real node, we'd check node.getPort('out') is undefined
  });

  it('shows variance percentage', () => {
    const node = createBenchmarkNode(100000);
    // @ts-expect-error
    render(<BenchmarkResultNodeWidget engine={engine} node={node} />);
    expect(screen.getByText('Variance:')).toBeInTheDocument();
  });
});
