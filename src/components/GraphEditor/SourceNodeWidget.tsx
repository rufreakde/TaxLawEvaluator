import React from 'react';
import { PortWidget } from '@projectstorm/react-diagrams-core';
import type { DiagramEngine } from '@projectstorm/react-diagrams';
import type { SourceNodeModel } from '../../lib/graph/TaxNodeModels.js';
import { useAppStore } from '../../store/appStore.js';

interface SourceNodeWidgetProps {
  engine: DiagramEngine;
  node: SourceNodeModel;
}

export function SourceNodeWidget({ engine, node }: SourceNodeWidgetProps): React.ReactElement {
  const { inputId } = node.extras.sourceBinding ?? { inputId: '' };
  const resolvedVariables = useAppStore((s) => s.resolvedVariables);
  const currency = useAppStore((s) => s.scenarios.find((sc) => sc.id === s.activeScenarioId)?.currency ?? 'EUR');
  const value = (inputId ? resolvedVariables?.variables[inputId] : undefined) ?? node.extras.sourceBinding?.staticValue;
  const outPort = node.getPort('out');

  const formattedValue =
    value !== undefined
      ? value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency
      : '—';

  return (
    <div className="group relative flex items-stretch min-w-[160px] rounded-lg border border-blue-300 bg-blue-50 shadow-sm">
      <button
        className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-opacity"
        onClick={() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          Object.values(node.getPorts()).forEach((p: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Object.values(p.getLinks()).forEach((l: any) => l.remove());
          });
          node.remove();
          engine.repaintCanvas();
        }}
        title="Delete node"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
      <div className="flex-1 p-2">
        <div className="text-xs font-semibold text-blue-700 mb-1">{node.getOptions().name}</div>
        <div className="text-sm font-bold text-blue-900 mt-1">{formattedValue}</div>
      </div>
      {outPort && (
        <div className="flex items-center pr-1">
          <PortWidget engine={engine} port={outPort}>
            <div className="w-3 h-3 rounded-full bg-blue-400 border-2 border-blue-600 cursor-pointer hover:bg-blue-600" />
          </PortWidget>
        </div>
      )}
    </div>
  );
}
