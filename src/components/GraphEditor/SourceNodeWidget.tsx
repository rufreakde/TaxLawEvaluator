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
    <div className="group node-widget relative flex items-stretch min-w-[160px] bg-card border-2 border-[hsl(var(--source-node))] rounded-xl shadow-sm hover:shadow-lg">
      <button
        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-lg invisible group-hover:visible bg-muted text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-all duration-200"
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
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
      <div className="flex-1 p-3">
        <div className="text-xs font-medium text-[hsl(var(--source-node-foreground))] mb-1 tracking-wide uppercase">
          {node.getOptions().name}
        </div>
        <div className="text-sm font-bold text-[hsl(var(--source-node))] mt-1 tabular-nums tracking-tight">
          {formattedValue}
        </div>
      </div>
      {outPort && (
        <div className="flex items-center pr-2">
          <PortWidget engine={engine} port={outPort}>
            <div className="w-4 h-4 rounded-full border-2 border-[hsl(var(--source-node-foreground))] bg-[hsl(var(--source-node))] hover:bg-[hsl(var(--source-node-foreground))] transition-all duration-200 hover:scale-110 shadow-sm" />
          </PortWidget>
        </div>
      )}
    </div>
  );
}
