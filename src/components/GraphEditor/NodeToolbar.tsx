import React, { useState, useRef, useEffect } from 'react';
import type { DiagramEngine } from '@projectstorm/react-diagrams';
import { DefaultLinkModel } from '@projectstorm/react-diagrams';
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
  onSaveScenario: (name: string) => void;
  onSaveTaxLaw: (name: string) => void;
}

/** Closes a popup when the user clicks outside the given ref element. */
function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void): void {
  useEffect(() => {
    function handle(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [ref, onClose]);
}

export function NodeToolbar({ engine, onSaveScenario, onSaveTaxLaw }: NodeToolbarProps): React.ReactElement {
  const { activeTaxConfigId, activeScenarioId, activeScenarioGraphId, taxRuleRows, createTaxRule, scenarios, taxConfigs } =
    useAppStore((s) => ({
      activeTaxConfigId: s.activeTaxConfigId,
      activeScenarioId: s.activeScenarioId,
      activeScenarioGraphId: s.activeScenarioGraphId,
      taxRuleRows: s.activeTaxConfigId ? s._taxRuleRows.get(s.activeTaxConfigId) ?? [] : [],
      createTaxRule: s.createTaxRule,
      scenarios: s.scenarios,
      taxConfigs: s.taxConfigs,
    }));

  const activeScenarioName = scenarios.find((s) => s.id === activeScenarioId)?.household_name ?? '';
  const activeTaxConfigName = taxConfigs.find((t) => t.id === activeTaxConfigId)?.region ?? '';

  // Scenario name is pre-filled from the active scenario; user can override before saving
  const [scenarioName, setScenarioName] = useState<string>('');
  const [taxLawName, setTaxLawName] = useState<string>('');

  // Sync name fields when the active selection changes
  useEffect(() => { if (activeScenarioName) setScenarioName(activeScenarioName); }, [activeScenarioName]);
  useEffect(() => { if (activeTaxConfigName) setTaxLawName(activeTaxConfigName); }, [activeTaxConfigName]);

  // --- New Source popup ---
  const [showSource, setShowSource] = useState(false);
  const sourceRef = useRef<HTMLDivElement>(null);
  const [sourceName, setSourceName] = useState('');
  const [sourceValue, setSourceValue] = useState('');
  useClickOutside(sourceRef, () => setShowSource(false));

  // --- New Tax popup ---
  const [showTax, setShowTax] = useState(false);
  const taxRef = useRef<HTMLDivElement>(null);
  const [taxTab, setTaxTab] = useState<'existing' | 'new'>('existing');
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [newTaxName, setNewTaxName] = useState('');
  const [newTaxFormula, setNewTaxFormula] = useState('');
  const [newTaxDefaultSource, setNewTaxDefaultSource] = useState('');
  useClickOutside(taxRef, () => setShowTax(false));

  const scenarioChosen = activeScenarioId !== null || activeScenarioGraphId !== null;
  // Source + Sink nodes only need a scenario; Logic nodes additionally need a tax config
  const disabled = !scenarioChosen;
  const taxDisabled = !activeTaxConfigId;

  function addNodeAtRandom(node: SourceNodeModel | LogicNodeModel | SinkNodeModel): void {
    const model = engine.getModel();
    node.setPosition(100 + Math.random() * 300, 100 + Math.random() * 200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.addNode(node as any);
    engine.repaintCanvas();
  }

  function handleAddSource(): void {
    if (!activeTaxConfigId || !sourceName) return;
    const numValue = parseFloat(sourceValue);
    addNodeAtRandom(
      new SourceNodeModel(sourceName, activeTaxConfigId, '', '', isNaN(numValue) ? undefined : numValue),
    );
    setSourceName('');
    setSourceValue('');
    setShowSource(false);
  }

  function handleAddExistingRule(): void {
    if (!activeTaxConfigId) return;
    const rule = taxRuleRows.find((r) => String(r.id) === selectedRuleId);
    if (rule) {
      addNodeAtRandom(new LogicNodeModel(rule.name, activeTaxConfigId, rule.id, rule.formula));
    } else {
      addNodeAtRandom(new LogicNodeModel('Logic', activeTaxConfigId, 0, ''));
    }
    setShowTax(false);
  }

  async function handleSaveNewTax(): Promise<void> {
    if (!activeTaxConfigId || !newTaxName || !newTaxFormula) return;
    try {
      const newRule = await createTaxRule(activeTaxConfigId, {
        name: newTaxName,
        formula: newTaxFormula,
        description: newTaxDefaultSource || undefined,
      });
      if (newRule) {
        const logicNode = new LogicNodeModel(newRule.name, activeTaxConfigId, newRule.id, newRule.formula);

        // Add named input ports for each formula variable
        const vars: string[] = [];
        const rx = /\$([a-zA-Z]\w*)/g;
        let m: RegExpExecArray | null;
        while ((m = rx.exec(newRule.formula)) !== null) {
          if (!vars.includes(m[1])) vars.push(m[1]);
        }
        vars.sort().forEach((v) => logicNode.addNamedInputPort(v));

        addNodeAtRandom(logicNode);

        // Auto-wire first formula variable to the named Default Source node if found on canvas
        if (newTaxDefaultSource && vars.length > 0) {
          const model = engine.getModel();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sourceNode = (Object.values((model as any).getNodes()) as any[]).find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (n: any) => n.extras?.kind === 'SourceNode' && n.getOptions?.().name === newTaxDefaultSource,
          );
          if (sourceNode) {
            const sourcePort = sourceNode.getPort('out');
            const targetPort = logicNode.getPort(vars[0]);
            if (sourcePort && targetPort) {
              const link = new DefaultLinkModel();
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              link.setSourcePort(sourcePort as any);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              link.setTargetPort(targetPort as any);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (model as any).addLink(link);
              engine.repaintCanvas();
            }
          }
        }
      }
    } catch {
      // Non-fatal — rule may or may not have been saved; do not crash the UI
    }
    setNewTaxName('');
    setNewTaxFormula('');
    setNewTaxDefaultSource('');
    setShowTax(false);
  }

  function addSinkNode(): void {
    addNodeAtRandom(new SinkNodeModel('Sink', activeTaxConfigId ?? 0, '', ''));
  }

  return (
    <div className="border-b bg-white">
      {/* Main toolbar row */}
      <div className="flex items-center gap-2 p-2 flex-wrap">

        {/* New Source button + popup */}
        <div className="relative" ref={sourceRef}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSource((v) => !v)}
            disabled={disabled}
            className="text-blue-700 border-blue-300 hover:bg-blue-50"
          >
            New Source
          </Button>
          {showSource && (
            <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-blue-200 rounded-lg shadow-lg p-3 flex items-center gap-2 min-w-max">
              <input
                type="text"
                placeholder="Name"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddSource(); }}
                autoFocus
                className="h-8 text-xs border border-blue-300 rounded px-2 w-28 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <input
                type="number"
                placeholder="Value"
                value={sourceValue}
                onChange={(e) => setSourceValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddSource(); }}
                className="h-8 text-xs border border-blue-300 rounded px-2 w-24 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddSource}
                disabled={!sourceName}
                className="text-blue-700 border-blue-300 hover:bg-blue-50"
              >
                + Source
              </Button>
            </div>
          )}
        </div>

        {/* New Tax button + popup */}
        <div className="relative" ref={taxRef}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowTax((v) => !v)}
            disabled={taxDisabled}
            className="text-amber-700 border-amber-300 hover:bg-amber-50"
          >
            New Tax
          </Button>
          {showTax && (
            <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-amber-200 rounded-lg shadow-lg p-3 min-w-max">
              {/* Tabs */}
              <div className="flex gap-1 mb-3">
                <button
                  onClick={() => setTaxTab('existing')}
                  className={`text-xs px-3 py-1 rounded border transition-colors ${
                    taxTab === 'existing'
                      ? 'bg-amber-100 border-amber-400 text-amber-800 font-medium'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  Existing rule
                </button>
                <button
                  onClick={() => setTaxTab('new')}
                  className={`text-xs px-3 py-1 rounded border transition-colors ${
                    taxTab === 'new'
                      ? 'bg-amber-100 border-amber-400 text-amber-800 font-medium'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  New rule
                </button>
              </div>

              {taxTab === 'existing' ? (
                <div className="flex items-center gap-2">
                  <Select value={selectedRuleId} onValueChange={setSelectedRuleId}>
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
                    onClick={handleAddExistingRule}
                    className="text-yellow-700 border-yellow-300 hover:bg-yellow-50"
                  >
                    + TaxRule
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Name"
                    value={newTaxName}
                    onChange={(e) => setNewTaxName(e.target.value)}
                    autoFocus
                    className="h-8 text-xs border border-amber-300 rounded px-2 w-28 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <input
                    type="text"
                    placeholder="Formula (e.g. $a * 0.10)"
                    value={newTaxFormula}
                    onChange={(e) => setNewTaxFormula(e.target.value)}
                    className="h-8 text-xs border border-amber-300 rounded px-2 w-40 font-mono focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <input
                    type="text"
                    placeholder="Default Source"
                    value={newTaxDefaultSource}
                    onChange={(e) => setNewTaxDefaultSource(e.target.value)}
                    className="h-8 text-xs border border-amber-300 rounded px-2 w-32 focus:outline-none focus:ring-1 focus:ring-amber-400"
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
                    onClick={() => { setNewTaxName(''); setNewTaxFormula(''); setNewTaxDefaultSource(''); setTaxTab('existing'); }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* + Sink */}
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

        {/* Save Scenario */}
        <div className="flex items-center gap-1 border-l pl-2">
          <input
            type="text"
            placeholder="Scenario name…"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            disabled={disabled}
            className="h-8 text-xs border border-blue-200 rounded px-2 w-36 focus:outline-none focus:ring-1 focus:ring-blue-300 disabled:opacity-50"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSaveScenario(scenarioName)}
            disabled={disabled || !scenarioName}
            className="text-blue-700 border-blue-300 hover:bg-blue-50"
            title="Save Source node layout for the current scenario"
          >
            Save Scenario
          </Button>
        </div>
      </div>

      {/* Save Tax Law row */}
      <div className="flex items-center gap-2 px-2 pb-2">
        <div className="flex-1" />
        <div className="flex items-center gap-1 border-l pl-2">
          <input
            type="text"
            placeholder="Law name…"
            value={taxLawName}
            onChange={(e) => setTaxLawName(e.target.value)}
            disabled={taxDisabled}
            className="h-8 text-xs border border-yellow-200 rounded px-2 w-36 focus:outline-none focus:ring-1 focus:ring-yellow-300 disabled:opacity-50"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSaveTaxLaw(taxLawName)}
            disabled={taxDisabled || !taxLawName}
            className="text-yellow-700 border-yellow-300 hover:bg-yellow-50"
          >
            Save Tax Law
          </Button>
        </div>
      </div>
    </div>
  );
}
