import React, { useState, useEffect } from 'react';
import { PortWidget } from '@projectstorm/react-diagrams-core';
import type { DiagramEngine } from '@projectstorm/react-diagrams';
import { DefaultPortModel } from '@projectstorm/react-diagrams';
import { evaluate } from 'mathjs';
import type { LogicNodeModel } from '../../lib/graph/TaxNodeModels.js';
import { useAppStore } from '../../store/appStore.js';
import type { ResolvedVariableMap } from '../../types/variableMapping.js';

interface LogicNodeWidgetProps {
  engine: DiagramEngine;
  node: LogicNodeModel;
}

/**
 * Get the value for a port by traversing its connected link to the source node.
 * Falls back to resolvedVariables letter-lookup if no connection exists.
 */
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
  // No connection — fall back to letter-based variable lookup
  return resolvedVars?.variables[p.getName()];
}

/** Return the name of a connected SourceNode, if any. */
function getConnectedSourceName(port: unknown): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = port as any;
  const links = Object.values(p.getLinks?.() ?? {}) as unknown[];
  if (!links.length) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const link = links[0] as any;
  const sourcePort = link.getSourcePort?.();
  if (!sourcePort) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sourceNode = sourcePort.getNode?.() as any;
  if (sourceNode?.extras?.kind === 'SourceNode') {
    return sourceNode.getOptions?.().name as string;
  }
  return undefined;
}

export function LogicNodeWidget({ engine, node }: LogicNodeWidgetProps): React.ReactElement {
  const resolvedVariables = useAppStore((s) => s.resolvedVariables);
  const [localFormula, setLocalFormula] = useState(node.extras.logicBinding?.formula ?? '');
  const [localLabels, setLocalLabels] = useState<Record<string, string>>(
    node.extras.logicBinding?.portLabels ?? {},
  );

  const allPorts = Object.values(node.getPorts());
  const inPorts = allPorts.filter(
    (p) => p instanceof DefaultPortModel && (p as DefaultPortModel).getOptions().in,
  );
  const outPort = node.getPort('out');
  const inputCount = node.extras.logicBinding?.inputCount ?? 0;

  // Auto-fill port labels from connected source node names (won't overwrite manual labels)
  useEffect(() => {
    const binding = node.extras.logicBinding;
    if (!binding) return;
    const updated: Record<string, string> = { ...(binding.portLabels ?? {}) };
    let changed = false;
    inPorts.forEach((port) => {
      const portName = port.getName();
      if (updated[portName]) return;
      const name = getConnectedSourceName(port);
      if (name) {
        updated[portName] = name;
        changed = true;
      }
    });
    if (changed) {
      binding.portLabels = updated;
      setLocalLabels(updated);
    }
  }); // no deps: runs after every render, self-terminates once labels are set

  function handleFormulaBlur(): void {
    if (node.extras.logicBinding) {
      node.extras.logicBinding.formula = localFormula;
    }
    engine.repaintCanvas();
  }

  function handleLabelChange(portName: string, label: string): void {
    const next = { ...localLabels, [portName]: label };
    setLocalLabels(next);
    if (node.extras.logicBinding) {
      node.extras.logicBinding.portLabels = next;
    }
  }

  function handlePlusMouseUp(e: React.MouseEvent): void {
    // If the user is dragging an unconnected link and releases it over the + button,
    // auto-create a new port and complete the connection.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dragState = (engine as any)?.getStateMachine?.()?.getCurrentState?.();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const draggedLink = dragState?.link as any;
    if (draggedLink && !draggedLink.getTargetPort?.()) {
      e.stopPropagation();
      const letter = node.addInputPort();
      if (letter) {
        const newPort = node.getPort(letter);
        if (newPort) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          draggedLink.setTargetPort(newPort as any);
          try { dragState.eject?.(); } catch { /* no-op */ }
          engine.repaintCanvas();
          return;
        }
      }
    }
    node.addInputPort();
    engine.repaintCanvas();
  }

  function handleRemovePort(): void {
    node.removeLastInputPort();
    engine.repaintCanvas();
  }

  // Build formula scope using actual connected values (not letter-based lookup)
  const scope: Record<string, number> = {};
  inPorts.forEach((p) => {
    const v = getPortValue(p, resolvedVariables);
    if (v !== undefined) scope[p.getName()] = v;
  });

  let localResult: number | string = '—';
  if (localFormula.trim()) {
    try {
      const raw = evaluate(localFormula.replace(/\$([a-zA-Z]\w*)/g, '$1'), scope);
      localResult = (typeof raw === 'number' && isFinite(raw)) ? raw : -1;
    } catch {
      localResult = -1;
    }
  }

  return (
    <div className="group node-widget relative flex items-stretch min-w-[280px] bg-card border border-[hsl(var(--logic-node))] rounded-xl shadow-sm hover:shadow-lg">
      <button
        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-lg invisible group-hover:visible bg-muted text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-all duration-200 z-10"
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
      <div className="flex flex-col py-2 pl-2 gap-1.5">
        {inPorts.map((port) => {
          const portName = port.getName();
          const resolved = getPortValue(port, resolvedVariables);
          const label = localLabels[portName] ?? '';
          return (
            <div key={portName} className="flex items-center gap-2">
              <PortWidget engine={engine} port={port}>
                <div className="w-4 h-4 rounded-full border-2 border-[hsl(var(--logic-node-foreground))] bg-[hsl(var(--logic-node))] hover:bg-[hsl(var(--logic-node-foreground))] transition-all duration-200 hover:scale-110 shadow-sm" />
              </PortWidget>
              <span className="text-xs font-mono font-medium w-6 shrink-0 text-[hsl(var(--logic-node-foreground))]">
                {portName}
              </span>
              <input
                type="text"
                value={label}
                onChange={(e) => handleLabelChange(portName, e.target.value)}
                placeholder="label…"
                className="text-xs border-0 border-b border-[hsl(var(--logic-node))] bg-background w-52 focus:outline-none focus:border-[hsl(var(--logic-node))] placeholder:text-muted-foreground text-foreground px-1 py-0.5 transition-colors"
              />
              {resolved !== undefined && (
                <span className="text-xs font-mono text-[hsl(var(--logic-node-foreground))] tabular-nums">
                  ({resolved.toLocaleString('de-DE', { maximumFractionDigits: 2 })})
                </span>
              )}
            </div>
          );
        })}
        <div className="flex items-center gap-2 mt-1 pl-6">
          <button
            onMouseUp={handlePlusMouseUp}
            disabled={inputCount >= 26}
            className="text-xs w-6 h-6 flex items-center justify-center rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--logic-node))] hover:bg-[hsl(var(--logic-node))] hover:border-[hsl(var(--logic-node))] disabled:bg-muted disabled:cursor-not-allowed transition-all duration-200 font-bold"
          >
            +
          </button>
          <button
            onClick={handleRemovePort}
            disabled={inputCount === 0}
            className="text-xs w-6 h-6 flex items-center justify-center rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--logic-node))] hover:bg-[hsl(var(--logic-node))] hover:border-[hsl(var(--logic-node))] disabled:bg-muted disabled:cursor-not-allowed transition-all duration-200 font-bold"
          >
            −
          </button>
        </div>
      </div>
      <div className="flex-1 p-3 border-x border-border bg-[hsl(var(--muted))] rounded-r-xl">
        <div className="text-xs font-medium text-[hsl(var(--logic-node-foreground))] mb-1.5 tracking-wide" data-testid="node-title">
          {node.getOptions().name}
        </div>
        <textarea
          rows={2}
          value={localFormula}
          onChange={(e) => setLocalFormula(e.target.value)}
          onBlur={handleFormulaBlur}
          className="w-90 text-xs font-mono bg-background border border-[hsl(var(--logic-node))] rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground text-foreground transition-shadow"
        />
        <div className="text-xs mt-1.5 font-mono text-[hsl(var(--logic-node-foreground))] tabular-nums bg-muted px-2 py-1 rounded-md">
          ={' '}
          {typeof localResult === 'number'
            ? localResult.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : localResult}
        </div>
      </div>
      {outPort && (
        <div className="flex items-center pr-2">
          <PortWidget engine={engine} port={outPort}>
            <div className="w-4 h-4 rounded-full border-2 border-[hsl(var(--logic-node-foreground))] bg-[hsl(var(--logic-node))] hover:bg-[hsl(var(--logic-node))] transition-all duration-200 hover:scale-110 shadow-sm" />
          </PortWidget>
        </div>
      )}
    </div>
  );
}
