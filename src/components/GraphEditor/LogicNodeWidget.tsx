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
      localResult = evaluate(localFormula.replace(/\$([a-zA-Z]\w*)/g, '$1'), scope) as number;
    } catch {
      localResult = -1;
    }
  }

  return (
    <div className="relative flex items-stretch min-w-[240px] rounded-lg border border-yellow-300 bg-yellow-50 shadow-sm">
      <div className="flex flex-col py-2 pl-1 gap-1">
        {inPorts.map((port) => {
          const portName = port.getName();
          const resolved = getPortValue(port, resolvedVariables);
          const label = localLabels[portName] ?? '';
          return (
            <div key={portName} className="flex items-center gap-1">
              <PortWidget engine={engine} port={port}>
                <div className="w-3 h-3 rounded-full bg-yellow-400 border-2 border-yellow-600 cursor-pointer hover:bg-yellow-600" />
              </PortWidget>
              <span className="text-xs text-yellow-700 font-mono w-3 shrink-0">{portName}</span>
              <input
                type="text"
                value={label}
                onChange={(e) => handleLabelChange(portName, e.target.value)}
                placeholder="label…"
                className="text-xs border-0 border-b border-yellow-300 bg-transparent w-24 focus:outline-none focus:border-yellow-500 placeholder-yellow-300 text-yellow-700"
              />
              {resolved !== undefined && (
                <span className="text-xs text-yellow-600 font-mono">
                  ={resolved.toLocaleString('de-DE', { maximumFractionDigits: 2 })}
                </span>
              )}
            </div>
          );
        })}
        <div className="flex items-center gap-1 mt-1">
          <button
            onMouseUp={handlePlusMouseUp}
            disabled={inputCount >= 26}
            className="text-xs w-5 h-5 flex items-center justify-center rounded border border-yellow-400 text-yellow-700 hover:bg-yellow-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            +
          </button>
          <button
            onClick={handleRemovePort}
            disabled={inputCount === 0}
            className="text-xs w-5 h-5 flex items-center justify-center rounded border border-yellow-400 text-yellow-700 hover:bg-yellow-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            −
          </button>
        </div>
      </div>
      <div className="flex-1 p-2 border-x border-yellow-200">
        <div className="text-xs font-semibold text-yellow-700 mb-1">{node.getOptions().name}</div>
        <textarea
          rows={2}
          value={localFormula}
          onChange={(e) => setLocalFormula(e.target.value)}
          onBlur={handleFormulaBlur}
          className="w-full text-xs font-mono bg-yellow-100 border border-yellow-300 rounded px-1 py-0.5 resize-none focus:outline-none focus:ring-1 focus:ring-yellow-400"
        />
        <div className="text-xs text-yellow-800 mt-1 font-mono">
          ={' '}
          {typeof localResult === 'number'
            ? localResult.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : localResult}
        </div>
      </div>
      {outPort && (
        <div className="flex items-center pr-1">
          <PortWidget engine={engine} port={outPort}>
            <div className="w-3 h-3 rounded-full bg-yellow-400 border-2 border-yellow-600 cursor-pointer hover:bg-yellow-600" />
          </PortWidget>
        </div>
      )}
    </div>
  );
}
