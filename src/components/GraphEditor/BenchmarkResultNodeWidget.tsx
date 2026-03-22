import React, { useEffect, useState } from 'react';
import { PortWidget } from '@projectstorm/react-diagrams-core';
import type { DiagramEngine } from '@projectstorm/react-diagrams';
import { DefaultPortModel } from '@projectstorm/react-diagrams';
import { evaluate } from 'mathjs';
import type { BenchmarkResultNodeModel } from '../../lib/graph/TaxNodeModels.js';
import { useAppStore } from '../../store/appStore.js';
import type { ResolvedVariableMap } from '../../types/variableMapping.js';

interface BenchmarkResultNodeWidgetProps {
  engine: DiagramEngine;
  node: BenchmarkResultNodeModel;
}

/** Resolve port value via connected source link */
function getPortValue(port: unknown, resolvedVars: ResolvedVariableMap | null): number | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = port as any;
  const links = Object.values(p.getLinks?.() ?? {}) as unknown[];
  if (links.length > 0) {
    const linkRaw = links[0] as unknown;
    const link = linkRaw as any;
    const sourcePort = link.getSourcePort?.();
    if (sourcePort) {
      const sourceNode = sourcePort.getNode?.() as any;
      if (sourceNode?.extras?.kind === 'SourceNode') {
        const inputId: string = sourceNode.extras.sourceBinding?.inputId ?? '';
        return (
          (inputId ? resolvedVars?.variables[inputId] : undefined) ??
          sourceNode.extras.sourceBinding?.staticValue
        );
      } else if (sourceNode?.extras?.kind === 'LogicNode') {
        // Evaluate logic node
        const formula: string = sourceNode.extras?.logicBinding?.formula ?? '';
        if (!formula) return undefined;
        const allPorts = Object.values(sourceNode.getPorts?.() ?? {});
        const scope: Record<string, number> = {};
        allPorts.forEach((port: any) => {
          if (port instanceof DefaultPortModel && port.getOptions?.()?.in) {
            const v = getPortValue(port, resolvedVars);
            if (v !== undefined) scope[port.getName()] = v;
          }
        });
        try {
          const raw = evaluate(formula.replace(/\$([a-zA-Z]\w*)/g, '$1'), scope) as unknown;
          return typeof raw === 'number' && isFinite(raw) ? raw : undefined;
        } catch {
          return undefined;
        }
      } else if (sourceNode?.extras?.kind === 'ResultNode') {
        // Get result from connected Result node
        const resultNode = sourceNode as any;
        const inPort = resultNode.getPort('in');
        if (inPort) {
          const links = Object.values(inPort.getLinks()) as any[];
          let sum = 0;
          let hasError = false;
          for (const link of links) {
            const sp = link.getSourcePort?.();
            if (!sp) continue;
            const sn = sp.getNode?.() as any;
            if (sn?.extras?.kind === 'SourceNode') {
              const inputId = sn.extras.sourceBinding?.inputId ?? '';
              const val = inputId ? resolvedVars?.variables[inputId] : sn.extras.sourceBinding?.staticValue;
              if (typeof val === 'number' && isFinite(val)) sum += val;
              else hasError = true;
            } else {
              hasError = true;
            }
          }
          return hasError ? undefined : sum;
        }
      }
    }
  }
  return undefined;
}

export function BenchmarkResultNodeWidget({ engine, node }: BenchmarkResultNodeWidgetProps): React.ReactElement {
  const resolvedVariables = useAppStore((s) => s.resolvedVariables);
  const currency = useAppStore(
    (s) => s.scenarios.find((sc) => sc.id === s.activeScenarioId)?.currency ?? 'EUR',
  );
  const inPort = node.getPort('in');

  const [actual, setActual] = useState<number | null>(null);
  const [error, setError] = useState(false);

  const targetValue = node.getTargetValue();
  const outputId = node.getOutputId();

  // Compute actual value whenever resolved variables change
  useEffect(() => {
    if (!inPort) {
      setActual(null);
      return;
    }

    const links = Object.values(inPort.getLinks()) as any[];
    if (links.length === 0) {
      setActual(null);
      return;
    }

    // For benchmark, we expect a single connection to a Result or Logic node
    // But we can aggregate multiple source links if needed
    let sum = 0;
    let hasError = false;

    for (const link of links) {
      const sourcePort = link.getSourcePort?.();
      if (!sourcePort) continue;

      const sourceNode = sourcePort.getNode?.() as any;
      if (!sourceNode) continue;

      if (sourceNode.extras?.kind === 'SourceNode') {
        const inputId: string = sourceNode.extras.sourceBinding?.inputId ?? '';
        const value =
          inputId ? resolvedVariables?.variables[inputId] : sourceNode.extras.sourceBinding?.staticValue;
        if (typeof value === 'number' && isFinite(value)) {
          sum += value;
        } else {
          hasError = true;
        }
      } else if (sourceNode.extras?.kind === 'LogicNode') {
        const formula: string = sourceNode.extras?.logicBinding?.formula ?? '';
        if (!formula) {
          hasError = true;
          continue;
        }
        const allPorts = Object.values(sourceNode.getPorts?.() ?? {});
        const scope: Record<string, number> = {};
        allPorts.forEach((p: any) => {
          if (p instanceof DefaultPortModel && p.getOptions?.()?.in) {
            const v = getPortValue(p, resolvedVariables);
            if (v !== undefined) scope[p.getName()] = v;
          }
        });
        try {
          const raw = evaluate(formula.replace(/\$([a-zA-Z]\w*)/g, '$1'), scope) as unknown;
          if (typeof raw === 'number' && isFinite(raw)) {
            sum += raw;
          } else {
            hasError = true;
          }
        } catch {
          hasError = true;
        }
      } else if (sourceNode.extras?.kind === 'ResultNode') {
        const resultNode = sourceNode as any;
        const rInPort = resultNode.getPort('in');
        if (rInPort) {
          const rLinks = Object.values(rInPort.getLinks()) as any[];
          let rSum = 0;
          let rError = false;
          for (const rLink of rLinks) {
            const rSourcePort = rLink.getSourcePort?.();
            if (!rSourcePort) continue;
            const rSourceNode = rSourcePort.getNode?.() as any;
            if (rSourceNode?.extras?.kind === 'SourceNode') {
              const inputId = rSourceNode.extras.sourceBinding?.inputId ?? '';
              const val = inputId ? resolvedVariables?.variables[inputId] : rSourceNode.extras.sourceBinding?.staticValue;
              if (typeof val === 'number' && isFinite(val)) rSum += val;
              else rError = true;
            } else {
              rError = true;
            }
          }
          if (rError) {
            hasError = true;
          } else {
            sum += rSum;
          }
        }
      }
    }

    setError(hasError);
    setActual(hasError ? null : sum);
  }, [resolvedVariables, inPort]);

  const variance = actual !== null ? ((actual - targetValue) / targetValue) * 100 : null;
  const isMet = actual !== null && variance !== null && variance >= 0;

  const formattedActual =
    actual !== null ? actual.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
  const formattedTarget = targetValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedVariance =
    variance !== null ? `${variance >= 0 ? '+' : ''}${variance.toFixed(1)}%` : '—';

  return (
    <div className="group node-widget relative flex items-stretch min-w-[200px] bg-card border-2 border-[hsl(var(--benchmark-result-node))] rounded-xl shadow-sm hover:shadow-lg">
      {inPort && (
        <div className="flex items-center pl-2">
          <PortWidget engine={engine} port={inPort}>
            <div className="w-4 h-4 rounded-full border-2 border-[hsl(var(--benchmark-result-node-foreground))] bg-[hsl(var(--benchmark-result-node))] hover:bg-[hsl(var(--benchmark-result-node-foreground))] transition-all duration-200 hover:scale-110 shadow-sm" />
          </PortWidget>
        </div>
      )}
      <div className="flex-1 p-3">
        <div className="text-xs font-medium text-[hsl(var(--benchmark-result-node-foreground))] mb-2 tracking-wide uppercase">
          {node.getOptions().name}
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Actual:</span>
            <span className={`font-mono tabular-nums ${error ? 'text-destructive' : 'text-foreground'}`}>
              {error ? 'ERR' : formattedActual + ' ' + currency}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Target:</span>
            <span className="font-mono tabular-nums text-[hsl(var(--benchmark-result-node))]">
              {formattedTarget} {currency}
            </span>
          </div>
          <div
            className={`flex items-center justify-between pt-1 border-t border-border ${
              isMet ? 'text-green-600' : variance !== null ? 'text-red-600' : 'text-muted-foreground'
            }`}
          >
            <span>Variance:</span>
            <span className="font-mono tabular-nums">{formattedVariance}</span>
          </div>
        </div>
      </div>
      {/* No output port and no delete button - benchmark nodes are admin-managed */}
    </div>
  );
}
