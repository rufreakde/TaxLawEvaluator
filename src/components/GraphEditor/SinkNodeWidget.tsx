import React from 'react';
import { PortWidget } from '@projectstorm/react-diagrams-core';
import type { DiagramEngine } from '@projectstorm/react-diagrams';
import type { SinkNodeModel } from '../../lib/graph/TaxNodeModels.js';
import { useAppStore } from '../../store/appStore.js';
import { Badge } from '../ui/badge.js';

interface SinkNodeWidgetProps {
  engine: DiagramEngine;
  node: SinkNodeModel;
}

export function SinkNodeWidget({ engine, node }: SinkNodeWidgetProps): React.ReactElement {
  const { outputId, referenceRule } = node.extras.sinkBinding ?? { outputId: '', referenceRule: '' };
  const formulaResults = useAppStore((s) => s.formulaResults);
  const result = formulaResults?.results[referenceRule];
  const inPort = node.getPort('in');

  return (
    <div className="relative flex items-stretch min-w-[160px] rounded-lg border border-green-300 bg-green-50 shadow-sm">
      {inPort && (
        <div className="flex items-center pl-1">
          <PortWidget engine={engine} port={inPort}>
            <div className="w-3 h-3 rounded-full bg-green-400 border-2 border-green-600 cursor-pointer hover:bg-green-600" />
          </PortWidget>
        </div>
      )}
      <div className="flex-1 p-2">
        <div className="text-xs font-semibold text-green-700 mb-1">{node.getOptions().name}</div>
        {outputId && (
          <Badge variant="outline" className="text-green-600 border-green-300 text-xs mb-1">
            {outputId}
          </Badge>
        )}
        {referenceRule && (
          <div className="text-xs text-green-500 truncate">{referenceRule}</div>
        )}
        {result !== undefined && (
          <div className="text-xs text-green-800 font-semibold mt-1">{result.toLocaleString()}</div>
        )}
      </div>
    </div>
  );
}
