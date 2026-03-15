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
            result = evaluate(formula.replace(/\$([a-zA-Z]\w*)/g, '$1'), scope) as number;
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
        <div className="text-base font-bold text-green-900 mt-1">{formattedResult}</div>
      </div>
    </div>
  );
}
