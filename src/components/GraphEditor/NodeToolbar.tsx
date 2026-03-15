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
  const { activeTaxConfigId, taxRuleRows, createTaxRule } = useAppStore((s) => ({
    activeTaxConfigId: s.activeTaxConfigId,
    taxRuleRows: s.activeTaxConfigId ? s._taxRuleRows.get(s.activeTaxConfigId) ?? [] : [],
    createTaxRule: s.createTaxRule,
  }));

  const [selectedRuleId, setSelectedRuleId] = useState<string>('');

  // Custom source node form
  const [sourceName, setSourceName] = useState('');
  const [sourceValue, setSourceValue] = useState('');

  // New Tax rule form
  const [showNewTax, setShowNewTax] = useState(false);
  const [newTaxName, setNewTaxName] = useState('');
  const [newTaxFormula, setNewTaxFormula] = useState('');
  const [newTaxDesc, setNewTaxDesc] = useState('');

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

  function addCustomSourceNode(): void {
    if (!activeTaxConfigId || !sourceName) return;
    const numValue = parseFloat(sourceValue);
    addNodeAtRandom(
      new SourceNodeModel(
        sourceName,
        activeTaxConfigId,
        '',
        '',
        isNaN(numValue) ? undefined : numValue,
      ),
    );
    setSourceName('');
    setSourceValue('');
  }

  function addSinkNode(): void {
    if (!activeTaxConfigId) return;
    addNodeAtRandom(new SinkNodeModel('Sink', activeTaxConfigId, '', ''));
  }

  async function handleSaveNewTax(): Promise<void> {
    if (!activeTaxConfigId || !newTaxName || !newTaxFormula) return;
    await createTaxRule(activeTaxConfigId, {
      name: newTaxName,
      formula: newTaxFormula,
      description: newTaxDesc || undefined,
    });
    setNewTaxName('');
    setNewTaxFormula('');
    setNewTaxDesc('');
    setShowNewTax(false);
  }

  const disabled = !activeTaxConfigId;

  return (
    <div className="flex flex-col border-b bg-white">
      <div className="flex items-center gap-2 p-2 flex-wrap">
        <span className="text-xs font-medium text-gray-500 mr-1">Add Node:</span>

        {/* Custom Source: name + value */}
        <div className="flex items-center gap-1">
          <input
            type="text"
            placeholder="Name"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            disabled={disabled}
            className="h-8 text-xs border border-blue-300 rounded px-2 w-28 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
          />
          <input
            type="number"
            placeholder="Value"
            value={sourceValue}
            onChange={(e) => setSourceValue(e.target.value)}
            disabled={disabled}
            className="h-8 text-xs border border-blue-300 rounded px-2 w-24 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={addCustomSourceNode}
            disabled={disabled || !sourceName}
            className="text-blue-700 border-blue-300 hover:bg-blue-50"
          >
            + Source
          </Button>
        </div>

        {/* Logic node from existing rule */}
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
            + TaxRule
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

        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowNewTax((v) => !v)}
          disabled={disabled}
          className="text-amber-700 border-amber-300 hover:bg-amber-50"
        >
          New Tax
        </Button>

        <div className="flex-1" />
        <Button size="sm" onClick={onSave} disabled={disabled}>
          Save Graph
        </Button>
      </div>

      {showNewTax && (
        <div className="flex items-center gap-2 px-2 pb-2 flex-wrap">
          <span className="text-xs font-medium text-gray-500">New rule:</span>
          <input
            type="text"
            placeholder="Name"
            value={newTaxName}
            onChange={(e) => setNewTaxName(e.target.value)}
            className="h-7 text-xs border border-amber-300 rounded px-2 w-32 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
          <input
            type="text"
            placeholder="Formula (e.g. $a * 0.10)"
            value={newTaxFormula}
            onChange={(e) => setNewTaxFormula(e.target.value)}
            className="h-7 text-xs border border-amber-300 rounded px-2 w-44 font-mono focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newTaxDesc}
            onChange={(e) => setNewTaxDesc(e.target.value)}
            className="h-7 text-xs border border-amber-300 rounded px-2 w-40 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
          <Button
            size="sm"
            onClick={() => { void handleSaveNewTax(); }}
            disabled={!newTaxName || !newTaxFormula}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setShowNewTax(false); setNewTaxName(''); setNewTaxFormula(''); setNewTaxDesc(''); }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
