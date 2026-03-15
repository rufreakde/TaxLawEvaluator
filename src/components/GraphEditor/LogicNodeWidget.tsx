import React from 'react';
import { PortWidget } from '@projectstorm/react-diagrams-core';
import type { DiagramEngine } from '@projectstorm/react-diagrams';
import { DefaultPortModel } from '@projectstorm/react-diagrams';
import type { LogicNodeModel } from '../../lib/graph/TaxNodeModels.js';
import { useAppStore } from '../../store/appStore.js';

interface LogicNodeWidgetProps {
  engine: DiagramEngine;
  node: LogicNodeModel;
}

export function LogicNodeWidget({ engine, node }: LogicNodeWidgetProps): React.ReactElement {
  const { formula } = node.extras.logicBinding ?? { formula: '' };
  const resolvedVariables = useAppStore((s) => s.resolvedVariables);

  const allPorts = Object.values(node.getPorts());
  const inPorts = allPorts.filter(
    (p) => p instanceof DefaultPortModel && (p as DefaultPortModel).getOptions().in,
  );
  const outPort = node.getPort('out');

  return (
    <div className="relative flex items-stretch min-w-[200px] rounded-lg border border-yellow-300 bg-yellow-50 shadow-sm">
      <div className="flex flex-col justify-around py-2 pl-1 gap-1">
        {inPorts.map((port) => {
          const portName = port.getName();
          const resolved = resolvedVariables?.variables[portName];
          return (
            <div key={portName} className="flex items-center gap-1">
              <PortWidget engine={engine} port={port}>
                <div className="w-3 h-3 rounded-full bg-yellow-400 border-2 border-yellow-600 cursor-pointer hover:bg-yellow-600" />
              </PortWidget>
              <span className="text-xs text-yellow-700 font-mono">{portName}</span>
              {resolved !== undefined && (
                <span className="text-xs text-yellow-600">={resolved.toLocaleString()}</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex-1 p-2 border-x border-yellow-200">
        <div className="text-xs font-semibold text-yellow-700 mb-1">{node.getOptions().name}</div>
        <code className="text-xs text-yellow-800 font-mono bg-yellow-100 px-1 py-0.5 rounded block break-all">
          {formula}
        </code>
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
