import React, { useEffect, useState } from 'react';
import { PortWidget } from '@projectstorm/react-diagrams-core';
import type { DiagramEngine } from '@projectstorm/react-diagrams';
import { DefaultPortModel } from '@projectstorm/react-diagrams';
import { evaluate } from 'mathjs';
import type { ResultNodeModel } from '../../lib/graph/TaxNodeModels.js';
import { useAppStore } from '../../store/appStore.js';
import type { ResolvedVariableMap } from '../../types/variableMapping.js';

interface ResultNodeWidgetProps {
  engine: DiagramEngine;
  node: ResultNodeModel;
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

/** Evaluate a logic node's formula to get its output value */
function evaluateLogicNode(node: any, resolvedVars: ResolvedVariableMap | null): number | undefined {
  const formula: string = node.extras?.logicBinding?.formula ?? '';
  if (!formula) return undefined;

  const allPorts = Object.values(node.getPorts?.() ?? {});
  const scope: Record<string, number> = {};

  allPorts.forEach((p: any) => {
    if (p instanceof DefaultPortModel && p.getOptions?.()?.in) {
      const v = getPortValue(p, resolvedVars);
      if (v !== undefined) scope[p.getName()] = v;
    }
  });

  try {
    const raw = evaluate(formula.replace(/\$([a-zA-Z]\w*)/g, '$1'), scope) as unknown;
    return typeof raw === 'number' && isFinite(raw) ? raw : undefined;
  } catch {
    return undefined;
  }
}

export function ResultNodeWidget({ engine, node }: ResultNodeWidgetProps): React.ReactElement {
  const resolvedVariables = useAppStore((s) => s.resolvedVariables);
  const currency = useAppStore(
    (s) => s.scenarios.find((sc) => sc.id === s.activeScenarioId)?.currency ?? 'EUR',
  );
  const inPort = node.getPort('in');
  const outPort = node.getPort('out');

  // Aggregate all connected values
  let result: number | undefined;
  let hasError = false;

  if (inPort) {
    const links = Object.values(inPort.getLinks()) as unknown[];
    const values: number[] = [];

    for (const linkRaw of links) {
      const link = linkRaw as any;
      const sourcePort = link.getSourcePort?.();
      if (!sourcePort) continue;

      const sourceNode = sourcePort.getNode?.() as any;
      if (!sourceNode) continue;

      if (sourceNode.extras?.kind === 'SourceNode') {
        const inputId: string = sourceNode.extras.sourceBinding?.inputId ?? '';
        const value =
          inputId ? resolvedVariables?.variables[inputId] : sourceNode.extras.sourceBinding?.staticValue;
        if (typeof value === 'number' && isFinite(value)) {
          values.push(value);
        } else {
          hasError = true;
        }
      } else if (sourceNode.extras?.kind === 'LogicNode') {
        const value = evaluateLogicNode(sourceNode, resolvedVariables);
        if (typeof value === 'number' && isFinite(value)) {
          values.push(value);
        } else {
          hasError = true;
        }
      } else if (sourceNode.extras?.kind === 'ResultNode') {
        // Recursive: get sum from connected Result node
        const connectedNode = sourceNode as ResultNodeModel;
        const nestedSum = connectedNode.sumInputValues(resolvedVariables);
        if (nestedSum === 'error') {
          hasError = true;
        } else {
          values.push(nestedSum);
        }
      }
    }

    if (!hasError && values.length > 0) {
      result = values.reduce((sum, v) => sum + v, 0);
    } else if (hasError) {
      result = undefined;
    }
  }

  const formattedResult =
    result !== undefined
      ? result.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
        ' ' +
        currency
      : hasError
        ? 'ERR'
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
        data-testid="delete-node-button"
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
        <div className="text-xs font-medium text-[hsl(var(--sink-node-foreground))] mb-1.5 tracking-wide uppercase" data-testid="node-title">
          {node.getOptions().name}
        </div>
        <div
          className={`text-sm font-bold mt-1 tabular-nums tracking-tight ${
            hasError ? 'text-destructive' : 'text-[hsl(var(--sink-node))]'
          }`}
        >
          {formattedResult}
        </div>
      </div>
      {outPort && (
        <div className="flex items-center pr-2">
          <PortWidget engine={engine} port={outPort}>
            <div className="w-4 h-4 rounded-full border-2 border-[hsl(var(--sink-node-foreground))] bg-[hsl(var(--sink-node))] hover:bg-[hsl(var(--sink-node))] transition-all duration-200 hover:scale-110 shadow-sm" />
          </PortWidget>
        </div>
      )}
    </div>
  );
}
