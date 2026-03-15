import React from 'react';
import type { DiagramEngine } from '@projectstorm/react-diagrams';
import { Button } from '../ui/button.js';
import {
  SourceNodeModel,
  LogicNodeModel,
  SinkNodeModel,
} from '../../lib/graph/TaxNodeModels.js';
import { useAppStore } from '../../store/appStore.js';

interface NodeToolbarProps {
  engine: DiagramEngine;
  onSave: () => void;
}

export function NodeToolbar({ engine, onSave }: NodeToolbarProps): React.ReactElement {
  const { activeTaxConfigId } = useAppStore((s) => ({
    activeTaxConfigId: s.activeTaxConfigId,
  }));

  function addNode(type: 'source' | 'logic' | 'sink'): void {
    if (!activeTaxConfigId) return;
    const model = engine.getModel();
    let node: SourceNodeModel | LogicNodeModel | SinkNodeModel;
    const x = 100 + Math.random() * 200;
    const y = 100 + Math.random() * 200;

    if (type === 'source') {
      node = new SourceNodeModel('Source', activeTaxConfigId, '', '');
    } else if (type === 'logic') {
      node = new LogicNodeModel('Logic', activeTaxConfigId, 0, '');
    } else {
      node = new SinkNodeModel('Sink', activeTaxConfigId, '', '');
    }
    node.setPosition(x, y);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(node as any);
    engine.repaintCanvas();
  }

  return (
    <div className="flex items-center gap-2 p-2 border-b bg-white">
      <span className="text-xs font-medium text-gray-500 mr-2">Add Node:</span>
      <Button
        size="sm"
        variant="outline"
        onClick={() => addNode('source')}
        disabled={!activeTaxConfigId}
        className="text-blue-700 border-blue-300 hover:bg-blue-50"
      >
        + Source
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => addNode('logic')}
        disabled={!activeTaxConfigId}
        className="text-yellow-700 border-yellow-300 hover:bg-yellow-50"
      >
        + Logic
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => addNode('sink')}
        disabled={!activeTaxConfigId}
        className="text-green-700 border-green-300 hover:bg-green-50"
      >
        + Sink
      </Button>
      <div className="flex-1" />
      <Button size="sm" onClick={onSave} disabled={!activeTaxConfigId}>
        Save Graph
      </Button>
    </div>
  );
}
