import React, { useState } from 'react';
import type { DiagramEngine } from '@projectstorm/react-diagrams';
import { Button } from '../ui/button.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select.js';
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
  const { activeTaxConfigId, taxRuleRows, taxInputRows } = useAppStore((s) => ({
    activeTaxConfigId: s.activeTaxConfigId,
    taxRuleRows: s.activeTaxConfigId ? s._taxRuleRows.get(s.activeTaxConfigId) ?? [] : [],
    taxInputRows: s.activeTaxConfigId ? s._taxRules.get(s.activeTaxConfigId) ?? [] : [],
  }));

  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [selectedInputId, setSelectedInputId] = useState<string>('');

  function addNodeAtRandom(node: SourceNodeModel | LogicNodeModel | SinkNodeModel): void {
    const model = engine.getModel();
    node.setPosition(100 + Math.random() * 300, 100 + Math.random() * 200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(node as any);
    engine.repaintCanvas();
  }

  function addLogicNode(): void {
    if (!activeTaxConfigId) return;
    const rule = taxRuleRows.find((r) => String(r.id) === selectedRuleId);
    if (rule) {
      addNodeAtRandom(new LogicNodeModel(rule.name, activeTaxConfigId, rule.id, rule.formula));
    } else {
      addNodeAtRandom(new LogicNodeModel('Logic', activeTaxConfigId, 0, ''));
    }
  }

  function addSourceNode(): void {
    if (!activeTaxConfigId) return;
    const input = taxInputRows.find((i) => i.input_id === selectedInputId);
    if (input) {
      addNodeAtRandom(
        new SourceNodeModel(
          input.description,
          activeTaxConfigId,
          input.input_id,
          input.source ?? '',
          input.static_value ?? undefined,
        ),
      );
    } else {
      addNodeAtRandom(new SourceNodeModel('Source', activeTaxConfigId, '', ''));
    }
  }

  function addSinkNode(): void {
    if (!activeTaxConfigId) return;
    addNodeAtRandom(new SinkNodeModel('Sink', activeTaxConfigId, '', ''));
  }

  const disabled = !activeTaxConfigId;

  return (
    <div className="flex items-center gap-2 p-2 border-b bg-white flex-wrap">
      <span className="text-xs font-medium text-gray-500 mr-1">Add Node:</span>

      <div className="flex items-center gap-1">
        <Select value={selectedInputId} onValueChange={setSelectedInputId} disabled={disabled}>
          <SelectTrigger className="h-8 w-40 text-xs text-blue-700 border-blue-300">
            <SelectValue placeholder="Pick input…" />
          </SelectTrigger>
          <SelectContent>
            {taxInputRows.map((input) => (
              <SelectItem key={input.input_id} value={input.input_id} className="text-xs">
                {input.input_id} — {input.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          onClick={addSourceNode}
          disabled={disabled}
          className="text-blue-700 border-blue-300 hover:bg-blue-50"
        >
          + Source
        </Button>
      </div>

      <div className="flex items-center gap-1">
        <Select value={selectedRuleId} onValueChange={setSelectedRuleId} disabled={disabled}>
          <SelectTrigger className="h-8 w-48 text-xs text-yellow-700 border-yellow-300">
            <SelectValue placeholder="Pick rule…" />
          </SelectTrigger>
          <SelectContent>
            {taxRuleRows.map((rule) => (
              <SelectItem key={rule.id} value={String(rule.id)} className="text-xs">
                {rule.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          onClick={addLogicNode}
          disabled={disabled}
          className="text-yellow-700 border-yellow-300 hover:bg-yellow-50"
        >
          + Logic
        </Button>
      </div>

      <Button
        size="sm"
        variant="outline"
        onClick={addSinkNode}
        disabled={disabled}
        className="text-green-700 border-green-300 hover:bg-green-50"
      >
        + Sink
      </Button>

      <div className="flex-1" />
      <Button size="sm" onClick={onSave} disabled={disabled}>
        Save Graph
      </Button>
    </div>
  );
}
