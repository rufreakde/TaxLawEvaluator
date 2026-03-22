import React from 'react';
import { PortWidget } from '@projectstorm/react-diagrams-core';
import type { DiagramEngine } from '@projectstorm/react-diagrams';
import { DefaultPortModel } from '@projectstorm/react-diagrams';
import { evaluate } from 'mathjs';
import type { SinkNodeModel } from '../../lib/graph/TaxNodeModels.js';
import { useAppStore } from '../../store/appStore.js';
import type { ResolvedVariableMap } from '../../types/variableMapping.js';

interface SinkNodeWidgetProps {
  engine: DiagramEngine;
  node: SinkNodeModel;
}

/** Resolve port value via connected source link, falling back to letter-lookup. */
function getPortValue(port: unknown, resolvedVars: ResolvedVariableMap | null): number | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = port as any;
  const links = Object.values(p.getLinks?.() ?? {}) as unknown[];
  if (links.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const link = links[0] as any;
    const sourcePort = link.getSourcePort?.();
    if (sourcePort) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sourceNode = sourcePort.getNode?.() as any;
      if (sourceNode?.extras?.kind === 'SourceNode') {
        const inputId: string = sourceNode.extras.sourceBinding?.inputId ?? '';
        return (
          (inputId ? resolvedVars?.variables[inputId] : undefined) ??
          sourceNode.extras.sourceBinding?.staticValue
        );
      }
    }
  }
  return resolvedVars?.variables[p.getName()];
}

export function SinkNodeWidget({ engine, node }: SinkNodeWidgetProps): React.ReactElement {
  const resolvedVariables = useAppStore((s) => s.resolvedVariables);
  const currency = useAppStore(
    (s) => s.scenarios.find((sc) => sc.id === s.activeScenarioId)?.currency ?? 'EUR',
  );
  const inPort = node.getPort('in');

  // Derive the result by traversing the connected link
  let result: number | undefined;
  if (inPort) {
    const links = Object.values(inPort.getLinks());
    if (links.length > 0) {
      const link = links[0];
      const connectedPort = link.getSourcePort();
      if (connectedPort) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const connectedNode = connectedPort.getNode() as any;
        if (connectedNode?.extras?.kind === 'LogicNode') {
          const formula: string = connectedNode.extras.logicBinding?.formula ?? '';
          const allPorts = Object.values(connectedNode.getPorts());
          const scope: Record<string, number> = {};
          allPorts.forEach((p) => {
            if (p instanceof DefaultPortModel && (p as DefaultPortModel).getOptions().in) {
              // Use connected-source value, not letter-lookup
              const v = getPortValue(p, resolvedVariables);
              if (v !== undefined) scope[p.getName()] = v;
            }
          });
          try {
            const raw = evaluate(formula.replace(/\$([a-zA-Z]\w*)/g, '$1'), scope) as unknown;
            result = (typeof raw === 'number' && isFinite(raw)) ? raw : undefined;
          } catch {
            result = undefined;
          }
        } else if (connectedNode?.extras?.kind === 'SourceNode') {
          const inputId: string = connectedNode.extras.sourceBinding?.inputId ?? '';
          result =
            (inputId ? resolvedVariables?.variables[inputId] : undefined) ??
            connectedNode.extras.sourceBinding?.staticValue;
        }
      }
    }
  }

  const formattedResult =
    result !== undefined
      ? result.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
        ' ' +
        currency
      : '—';

  return (
    <div className="group node-widget relative flex items-stretch min-w-[160px] bg-card border-2 border-[hsl(var(--sink-node))] rounded-xl shadow-sm hover:shadow-lg">
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
      {inPort && (
        <div className="flex items-center pl-2">
          <PortWidget engine={engine} port={inPort}>
            <div className="w-4 h-4 rounded-full border-2 border-[hsl(var(--sink-node-foreground))] bg-[hsl(var(--sink-node))] hover:bg-[hsl(var(--sink-node-foreground))] transition-all duration-200 hover:scale-110 shadow-sm" />
          </PortWidget>
        </div>
      )}
      <div className="flex-1 p-3">
        <div className="text-xs font-medium text-[hsl(var(--sink-node-foreground))] mb-1.5 tracking-wide uppercase">
          {node.getOptions().name}
        </div>
        <div className="text-sm font-bold text-[hsl(var(--sink-node))] mt-1 tabular-nums tracking-tight">
          {formattedResult}
        </div>
      </div>
    </div>
  );
}
