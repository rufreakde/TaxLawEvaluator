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
  ResultNodeModel,
  BenchmarkResultNodeModel,
} from '../../lib/graph/TaxNodeModels.js';
import { useAppStore } from '../../store/appStore.js';
import { useAuthStore } from '../../store/authStore.js';
import * as yaml from 'js-yaml';
import { HelpCircle } from 'lucide-react';
import { extractScenarioGraph, extractTaxLawGraph } from '../../lib/graph/GraphSerializationService.js';

interface NodeToolbarProps {
  engine: DiagramEngine;
  onSaveScenario: (name: string) => void;
  onSaveTaxLaw: (name: string) => void;
  onSaveScenarioAs?: (name: string) => void;
  onSaveTaxLawAs?: (name: string) => void;
  onOpenBenchmarkEditor?: () => void;
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

export function NodeToolbar({ engine, onSaveScenario, onSaveTaxLaw, onSaveScenarioAs, onSaveTaxLawAs, onOpenBenchmarkEditor }: NodeToolbarProps): React.ReactElement {
  const {
    activeTaxConfigId,
    activeScenarioId,
    activeScenarioGraphId,
    activeTaxLawGraphId,
    taxRuleRows,
    createTaxRule,
    scenarios,
    taxConfigs,
    scenarioGraph,
    taxLawGraph,
  } = useAppStore((s) => ({
    activeTaxConfigId: s.activeTaxConfigId,
    activeScenarioId: s.activeScenarioId,
    activeScenarioGraphId: s.activeScenarioGraphId,
    activeTaxLawGraphId: s.activeTaxLawGraphId,
    taxRuleRows: s.activeTaxConfigId ? s._taxRuleRows.get(s.activeTaxConfigId) ?? [] : [],
    createTaxRule: s.createTaxRule,
    scenarios: s.scenarios,
    taxConfigs: s.taxConfigs,
    scenarioGraph: s.scenarioGraph,
    taxLawGraph: s.taxLawGraph,
  }));

  // Tooltip state
  const [scenarioHelpVisible, setScenarioHelpVisible] = useState(false);
  const [taxLawHelpVisible, setTaxLawHelpVisible] = useState(false);
  const scenarioHelpRef = useRef<HTMLDivElement>(null);
  const taxLawHelpRef = useRef<HTMLDivElement>(null);

  const { user } = useAuthStore();

  const activeScenarioName = scenarios.find((s) => s.id === activeScenarioId)?.household_name ?? '';
  const activeTaxConfigName = taxConfigs.find((t) => t.id === activeTaxConfigId)?.region ?? '';
  const activeTaxConfig = taxConfigs.find((t) => t.id === activeTaxConfigId);

  // Determine ownership for scenario graph and tax law graph
  const isScenarioGraphOwned = !activeScenarioGraphId || scenarioGraph?.user_id === user?.id || user?.role === 'admin';
  const isTaxLawGraphOwned = !activeTaxLawGraphId || taxLawGraph?.user_id === user?.id || user?.role === 'admin';

  // Determine if user can modify the tax config (i.e., add new rules)
  const canModifyTaxConfig = user?.role === 'admin' || (activeTaxConfig && activeTaxConfig.user_id !== null && activeTaxConfig.user_id === user?.id);

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

  // Clone tax config to create a user-owned variant
  const handleCloneTaxConfig = async () => {
    if (!activeTaxConfigId) return;
    try {
      const res = await fetch(`/api/v1/tax-configs/${activeTaxConfigId}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include',
      });
      if (res.ok) {
        const newConfig = await res.json() as { id: number };
        useAppStore.getState().setActiveTaxConfig(newConfig.id);
        fetch('/api/v1/tax-configs')
          .then(r => r.json() as Promise<any[]>)
          .then(data => { useAppStore.setState({ taxConfigs: data }); })
          .catch(() => {});
        setShowTax(false);
      } else {
        alert('Failed to clone tax config');
      }
    } catch {
      alert('Error cloning tax config');
    }
  };

  const scenarioChosen = activeScenarioId !== null || activeScenarioGraphId !== null;
  const disabled = !scenarioChosen;
  const taxDisabled = !activeTaxConfigId;

  function addNodeAtRandom(node: SourceNodeModel | LogicNodeModel | ResultNodeModel | BenchmarkResultNodeModel): void {
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

        const vars: string[] = [];
        const rx = /\$([a-zA-Z]\w*)/g;
        let m: RegExpExecArray | null;
        while ((m = rx.exec(newRule.formula)) !== null) {
          if (!vars.includes(m[1])) vars.push(m[1]);
        }
        vars.sort().forEach((v) => logicNode.addNamedInputPort(v));

        addNodeAtRandom(logicNode);

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
      // Non-fatal
    }
    setNewTaxName('');
    setNewTaxFormula('');
    setNewTaxDefaultSource('');
    setShowTax(false);
  }

  function addResultNode(): void {
    addNodeAtRandom(new ResultNodeModel('Result', activeTaxConfigId ?? 0, '', ''));
  }

  return (
    <div className="bg-card border-b shadow-sm">
      {/* Main toolbar row */}
      <div className="flex items-center gap-3 p-3 flex-wrap">

        {/* Node Creation Group */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Add Nodes</span>
        </div>

        {/* New Source button + popup */}
        <div className="relative" ref={sourceRef}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSource((v) => !v)}
            disabled={disabled}
            className="border-[hsl(var(--source-node))] text-foreground bg-secondary hover:bg-muted transition-all duration-200"
          >
            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Source
          </Button>
          {showSource && (
            <div className="absolute left-0 top-full mt-2 z-50 bg-card border border-border rounded-xl shadow-lg p-4 min-w-[360px]">
              <div className="flex items-center gap-3">
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    placeholder="Name (e.g. 'Gross Income')"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddSource(); }}
                    autoFocus
                    className="w-full h-9 text-sm border border-border rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground placeholder:text-muted-foreground"
                  />
                  <input
                    type="number"
                    placeholder="Static value (optional)"
                    value={sourceValue}
                    onChange={(e) => setSourceValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddSource(); }}
                    className="w-full h-9 text-sm border border-border rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground placeholder:text-muted-foreground font-mono"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleAddSource}
                  disabled={!sourceName}
                  className="border-[hsl(var(--source-node))] text-foreground bg-secondary hover:bg-muted"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add
                </Button>
              </div>
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
            className="border-[hsl(var(--logic-node))] text-foreground bg-secondary hover:bg-muted transition-all duration-200"
          >
            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Tax Rule
          </Button>
          {showTax && (
            <div className="absolute left-0 top-full mt-2 z-50 bg-card border border-border rounded-xl shadow-lg p-4 min-w-[480px]">
              {/* Tabs */}
              <div className="flex gap-2 mb-4 border-b border-border pb-2">
                <button
                  onClick={() => setTaxTab('existing')}
                  className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-all ${
                    taxTab === 'existing'
                      ? 'bg-secondary text-foreground border border-[hsl(var(--logic-node))]'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  Existing Rules
                </button>
                {canModifyTaxConfig && (
                  <button
                    onClick={() => setTaxTab('new')}
                    className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-all ${
                      taxTab === 'new'
                        ? 'bg-secondary text-foreground border border-[hsl(var(--logic-node))]'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    Create New
                  </button>
                )}
              </div>

              {!canModifyTaxConfig && (
                <div className="mb-4 p-3 bg-secondary border border-border rounded-lg">
                  <p className="text-sm text-destructive mb-2">
                    You cannot modify an admin template.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={handleCloneTaxConfig}
                  >
                    Clone to My Custom Config
                  </Button>
                </div>
              )}

              {taxTab === 'existing' ? (
                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Select a rule</label>
                    <Select value={selectedRuleId} onValueChange={setSelectedRuleId}>
                      <SelectTrigger className="h-10 border-border focus:ring-ring">
                        <SelectValue placeholder="Choose from existing rules…" />
                      </SelectTrigger>
                      <SelectContent>
                        {taxRuleRows.map((rule) => (
                          <SelectItem key={rule.id} value={String(rule.id)} className="text-sm">
                            <div>
                              <div className="font-medium">{rule.name}</div>
                              <div className="text-xs text-muted-foreground font-mono">{rule.formula}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleAddExistingRule}
                    disabled={!selectedRuleId}
                    className="border-[hsl(var(--logic-node))] text-foreground bg-secondary hover:bg-muted"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Rule
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Rule Name</label>
                      <input
                        type="text"
                        placeholder="e.g. 'Tax Bracket 1'"
                        value={newTaxName}
                        onChange={(e) => setNewTaxName(e.target.value)}
                        autoFocus
                        className="w-full h-10 text-sm border border-border rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground placeholder:text-muted-foreground/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Default Source (auto-wire)</label>
                      <input
                        type="text"
                        placeholder="e.g. 'Gross Income'"
                        value={newTaxDefaultSource}
                        onChange={(e) => setNewTaxDefaultSource(e.target.value)}
                        className="w-full h-10 text-sm border border-border rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground placeholder:text-muted-foreground/50"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Formula</label>
                    <input
                      type="text"
                      placeholder="e.g. $a * 0.10 (use $ for variable references)"
                      value={newTaxFormula}
                      onChange={(e) => setNewTaxFormula(e.target.value)}
                      className="w-full h-10 text-sm border border-border rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground placeholder:text-muted-foreground/50 font-mono"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => { void handleSaveNewTax(); }}
                      disabled={!newTaxName || !newTaxFormula}
                      className="bg-primary text-primary-foreground hover:bg-primary"
                    >
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Create & Add Rule
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setNewTaxName('');
                        setNewTaxFormula('');
                        setNewTaxDefaultSource('');
                        setTaxTab('existing');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* + Result */}
        <Button
          size="sm"
          variant="outline"
          onClick={addResultNode}
          disabled={disabled}
          className="border-[hsl(var(--sink-node))] text-foreground bg-secondary hover:bg-muted transition-all duration-200"
        >
          <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Result
        </Button>

        {/* Benchmark Editor - Admin only */}
        {user?.role === 'admin' && onOpenBenchmarkEditor && (
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenBenchmarkEditor}
            disabled={disabled}
            className="border-[hsl(var(--benchmark-result-node))] text-foreground bg-secondary hover:bg-muted transition-all duration-200"
          >
            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Benchmark
          </Button>
        )}

        <div className="flex-1" />

        {/* Save Actions Group */}
        <div className="flex items-center gap-4 border-l pl-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Save</span>
          </div>

          {/* Save Scenario */}
          <div className="flex items-center gap-2">
            <div className="relative" ref={scenarioHelpRef}>
              <button
                type="button"
                onMouseEnter={() => setScenarioHelpVisible(true)}
                onMouseLeave={() => setScenarioHelpVisible(false)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-all"
                title="What data will be saved?"
              >
                <HelpCircle size={16} />
              </button>
              {scenarioHelpVisible && (
                <div className="absolute right-0 top-full mt-2 z-50 w-96 max-h-96 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                  <div className="p-4 border-b border-border bg-muted">
                    <h4 className="font-semibold text-sm">Scenario YAML</h4>
                    <p className="text-xs text-muted-foreground mt-1">This is what will be saved</p>
                  </div>
                  <div className="overflow-auto max-h-80">
                    <pre className="p-4 text-xs whitespace-pre-wrap break-words font-mono bg-background text-foreground">
                      {(() => {
                        try {
                          const { nodes } = extractScenarioGraph(engine);
                          const yamlData: any = {
                            name: scenarioName || activeScenarioName || 'Untitled Scenario',
                            taxConfigId: activeTaxConfigId,
                            user_id: user?.id ?? null,
                            nodes: nodes.map(n => ({
                              nodeId: n.nodeId,
                              label: n.label,
                              inputId: n.inputId,
                              x: Math.round(n.x),
                              y: Math.round(n.y),
                              ...(n.staticValueOverride !== undefined ? { staticValueOverride: n.staticValueOverride } : {}),
                            })),
                            version: scenarioGraph?.version || 1,
                            sourceFile: scenarioGraph?.sourceFile,
                          };
                          if (scenarioGraph?.id) {
                            yamlData.id = scenarioGraph.id;
                          }
                          return yaml.dump(yamlData, { lineWidth: -1 });
                        } catch (e) {
                          return 'Error generating YAML: ' + (e as Error).message;
                        }
                      })()}
                    </pre>
                  </div>
                </div>
              )}
            </div>
            <div className="w-64">
              <input
                type="text"
                placeholder="Scenario name…"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                disabled={disabled}
                className="w-full h-9 text-sm border border-border rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-muted disabled:cursor-not-allowed bg-background text-foreground placeholder:text-muted-foreground/50"
              />
            </div>
            <Button
              size="sm"
              onClick={() => {
                if (isScenarioGraphOwned) {
                  onSaveScenario(scenarioName);
                } else if (onSaveScenarioAs) {
                  onSaveScenarioAs(scenarioName);
                }
              }}
              disabled={disabled || !scenarioName}
              className="border-[hsl(var(--source-node))] text-[hsl(var(--source-node-foreground))] bg-[hsl(var(--source-node))] hover:bg-muted min-w-[100px]"
              title={isScenarioGraphOwned ? "Save Source node layout for the current scenario" : "Save as a new scenario graph (you cannot overwrite this template)"}
            >
              {isScenarioGraphOwned ? (
                <>
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Save
                </>
              ) : (
                'Save As…'
              )}
            </Button>
          </div>

          {/* Save Tax Law */}
          <div className="flex items-center gap-2 border-l pl-4">
            <div className="relative" ref={taxLawHelpRef}>
              <button
                type="button"
                onMouseEnter={() => setTaxLawHelpVisible(true)}
                onMouseLeave={() => setTaxLawHelpVisible(false)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-all"
                title="What data will be saved?"
              >
                <HelpCircle size={16} />
              </button>
              {taxLawHelpVisible && (
                <div className="absolute right-0 top-full mt-2 z-50 w-96 max-h-96 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                  <div className="p-4 border-b border-border bg-muted">
                    <h4 className="font-semibold text-sm">Tax Law YAML</h4>
                    <p className="text-xs text-muted-foreground mt-1">This is what will be saved</p>
                  </div>
                  <div className="overflow-auto max-h-80">
                    <pre className="p-4 text-xs whitespace-pre-wrap break-words font-mono bg-background text-foreground">
                      {(() => {
                        try {
                          const { nodes, links } = extractTaxLawGraph(engine);
                          const yamlData: any = {
                            name: taxLawName || activeTaxConfigName || 'Untitled Tax Law',
                            taxConfigId: activeTaxConfigId,
                            user_id: user?.id ?? null,
                            nodes: nodes.map(n => ({
                              nodeId: n.nodeId,
                              ruleId: n.ruleId,
                              ruleName: n.ruleName,
                              x: Math.round(n.x),
                              y: Math.round(n.y),
                              portLabels: n.portLabels,
                              inputCount: n.inputCount,
                            })),
                            links: links.map(l => ({
                              id: l.id,
                              sourceNodeId: l.sourceNodeId,
                              sourcePort: l.sourcePort,
                              targetNodeId: l.targetNodeId,
                              targetPort: l.targetPort,
                            })),
                            version: taxLawGraph?.version || 1,
                            sourceFile: taxLawGraph?.sourceFile,
                          };
                          if (taxLawGraph?.id) {
                            yamlData.id = taxLawGraph.id;
                          }
                          return yaml.dump(yamlData, { lineWidth: -1 });
                        } catch (e) {
                          return 'Error generating YAML: ' + (e as Error).message;
                        }
                      })()}
                    </pre>
                  </div>
                </div>
              )}
            </div>
            <div className="w-64">
              <input
                type="text"
                placeholder="Law name…"
                value={taxLawName}
                onChange={(e) => setTaxLawName(e.target.value)}
                disabled={taxDisabled}
                className="w-full h-9 text-sm border border-border rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-muted disabled:cursor-not-allowed bg-background text-foreground placeholder:text-muted-foreground/50"
              />
            </div>
            <Button
              size="sm"
              onClick={() => {
                if (isTaxLawGraphOwned) {
                  onSaveTaxLaw(taxLawName);
                } else if (onSaveTaxLawAs) {
                  onSaveTaxLawAs(taxLawName);
                }
              }}
              disabled={taxDisabled || !taxLawName}
              className="border-[hsl(var(--logic-node))] text-[hsl(var(--logic-node-foreground))] bg-[hsl(var(--logic-node))] hover:bg-muted min-w-[100px]"
              title={isTaxLawGraphOwned ? "Save tax law graph" : "Save as a new tax law graph (you cannot overwrite this template)"}
            >
              {isTaxLawGraphOwned ? (
                <>
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Save
                </>
              ) : (
                'Save As…'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
