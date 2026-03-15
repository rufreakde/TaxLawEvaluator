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
    <div className="relative flex items-stretch min-w-[160px] rounded-lg border border-blue-300 bg-blue-50 shadow-sm">
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
