import React from 'react';
import { PortWidget } from '@projectstorm/react-diagrams-core';
import type { DiagramEngine } from '@projectstorm/react-diagrams';
import type { SourceNodeModel } from '../../lib/graph/TaxNodeModels.js';
import { useAppStore } from '../../store/appStore.js';
import { Badge } from '../ui/badge.js';

interface SourceNodeWidgetProps {
  engine: DiagramEngine;
  node: SourceNodeModel;
}

export function SourceNodeWidget({ engine, node }: SourceNodeWidgetProps): React.ReactElement {
  const { inputId, sourceExpression } = node.extras.sourceBinding ?? { inputId: '', sourceExpression: '' };
  const resolvedVariables = useAppStore((s) => s.resolvedVariables);
  const value = resolvedVariables?.variables[inputId];
  const outPort = node.getPort('out');

  return (
    <div className="relative flex items-stretch min-w-[160px] rounded-lg border border-blue-300 bg-blue-50 shadow-sm">
      <div className="flex-1 p-2">
        <div className="text-xs font-semibold text-blue-700 mb-1">{node.getOptions().name}</div>
        {inputId && (
          <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs mb-1">
            {inputId}
          </Badge>
        )}
        {sourceExpression && (
          <div className="text-xs text-blue-500 font-mono truncate">{sourceExpression}</div>
        )}
        {value !== undefined && (
          <div className="text-xs text-blue-800 font-semibold mt-1">{value.toLocaleString()}</div>
        )}
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
