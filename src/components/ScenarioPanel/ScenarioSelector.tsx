import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore.js';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '../ui/select.js';
import { Card } from '../ui/card.js';
import { FileText, Calculator, Database, TrendingUp, GitBranch } from 'lucide-react';

export function ScenarioSelector(): React.ReactElement {
  const {
    scenarios,
    taxConfigs,
    activeScenarioId,
    activeTaxConfigId,
    activeScenarioGraphId,
    activeTaxLawGraphId,
    setActiveScenario,
    setActiveTaxConfig,
    loadScenarioGraph,
    loadTaxLawGraph,
  } = useAppStore((s) => ({
    scenarios: s.scenarios,
    taxConfigs: s.taxConfigs,
    activeScenarioId: s.activeScenarioId,
    activeTaxConfigId: s.activeTaxConfigId,
    activeScenarioGraphId: s.activeScenarioGraphId,
    activeTaxLawGraphId: s.activeTaxLawGraphId,
    setActiveScenario: s.setActiveScenario,
    setActiveTaxConfig: s.setActiveTaxConfig,
    loadScenarioGraph: s.loadScenarioGraph,
    loadTaxLawGraph: s.loadTaxLawGraph,
  }));

  const [scenarioGraphs, setScenarioGraphs] = useState<{ id: string; name: string }[]>([]);
  const [taxLawGraphs, setTaxLawGraphs] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch('/api/v1/scenarios')
      .then((r) => r.json() as Promise<any[]>)
      .then((data) => {
        useAppStore.setState({ scenarios: data });
      })
      .catch(() => {});

    fetch('/api/v1/tax-configs')
      .then((r) => r.json() as Promise<any[]>)
      .then((data) => {
        useAppStore.setState({ taxConfigs: data });
      })
      .catch(() => {});

    fetch('/api/v1/scenario-graphs')
      .then((r) => r.json() as Promise<{ id: string; name: string }[]>)
      .then(setScenarioGraphs)
      .catch(() => {});

    fetch('/api/v1/taxlaw-graphs')
      .then((r) => r.json() as Promise<{ id: string; name: string }[]>)
      .then(setTaxLawGraphs)
      .catch(() => {});
  }, []);

  const scenarioChosen = activeScenarioId !== null || activeScenarioGraphId !== null;

  const scenarioValue = activeScenarioGraphId
    ? `sg:${activeScenarioGraphId}`
    : activeScenarioId
    ? `s:${activeScenarioId}`
    : '';

  const taxValue = activeTaxLawGraphId
    ? `tg:${activeTaxLawGraphId}`
    : activeTaxConfigId
    ? `tc:${activeTaxConfigId}`
    : '';

  // Separate tax configs into templates and custom
  const templateTaxConfigs = taxConfigs.filter((t) => t.is_template === 1);
  const customTaxConfigs = taxConfigs.filter((t) => t.is_template === 0);

  function handleScenarioChange(value: string): void {
    if (!value) return;
    if (value.startsWith('s:')) setActiveScenario(Number(value.slice(2)));
    else loadScenarioGraph(value.slice(3));
  }

  function handleTaxChange(value: string): void {
    if (!value) return;
    if (value.startsWith('tc:')) setActiveTaxConfig(Number(value.slice(3)));
    else loadTaxLawGraph(value.slice(3));
  }

  return (
    <div className="space-y-3">
      <Card className="p-4  border-[hsl(var(--logic-foreground))]">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
            <FileText className="w-4 h-4 text-[hsl(var(--source-node))]" />
          </div>
          <h2 className="text-sm font-semibold text-[hsl(var(--source-node))]">Scenario</h2>
        </div>

        <Select value={scenarioValue} onValueChange={handleScenarioChange}>
          <SelectTrigger className="h-10 border-border bg-background" aria-label="Scenario selector">
            <SelectValue placeholder="Select a scenario…" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel className="text-xs font-medium text-[hsl(var(--source-node))] uppercase tracking-wide">Templates</SelectLabel>
              {scenarios.map((s) => (
                <SelectItem key={s.id} value={`s:${s.id}`} className="text-sm" aria-label={s.household_name}>
                  <div className="flex items-center gap-2 text-[hsl(var(--source-node))]">
                    <FileText className="w-3.5 h-3.5 text-[hsl(var(--source-node))]" />
                    <span>{s.household_name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>

            {scenarioGraphs.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-xs font-medium text-[hsl(var(--source-node))] uppercase tracking-wide">Your Custom Scenarios</SelectLabel>
                {scenarioGraphs.map((g) => (
                  <SelectItem key={g.id} value={`sg:${g.id}`} className="text-sm" aria-label={g.name}>
                    <div className="flex items-center gap-2 text-[hsl(var(--source-node))]">
                      <GitBranch className="w-3.5 h-3.5 text-[hsl(var(--source-node))]" />
                      <span>{g.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
      </Card>

      <Card className="p-4 border-[hsl(var(--logic-foreground))]">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
            <Calculator className="w-4 h-4 text-[hsl(var(--logic-node))]" />
          </div>
          <h2 className="text-sm font-semibold text-[hsl(var(--logic-node))]">Tax Law Configuration</h2>
        </div>

        <Select
          value={taxValue}
          onValueChange={handleTaxChange}
          disabled={!scenarioChosen}
        >
          <SelectTrigger className="h-10 border-border bg-background disabled:opacity-50" aria-label="Tax configuration selector">
            <SelectValue placeholder="Select a tax law…" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel className="text-xs font-medium text-[hsl(var(--logic-node))] uppercase tracking-wide">Default Templates</SelectLabel>
              {templateTaxConfigs.map((t) => (
                <SelectItem key={t.id} value={`tc:${t.id}`} className="text-sm" aria-label={`${t.region} (${t.schema_version})`}>
                  <div className="flex items-center gap-2 text-[hsl(var(--logic-node))]">
                    <Database className="w-3.5 h-3.5 text-foreground" />
                    <span>{t.region}</span>
                    <span className="text-xs text-[hsl(var(--logic-node))]">({t.schema_version})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>

            {customTaxConfigs.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-xs font-medium text-[hsl(var(--logic-node))] uppercase tracking-wide">Your Custom Configs</SelectLabel>
                {customTaxConfigs.map((t) => (
                  <SelectItem key={t.id} value={`tc:${t.id}`} className="text-sm" aria-label={`${t.region} (${t.schema_version})`}>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5 text-foreground" />
                      <span>{t.region}</span>
                      <span className="text-xs text-[hsl(var(--logic-node))]">({t.schema_version}) yours</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}

            {taxLawGraphs.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-xs font-medium text-[hsl(var(--logic-node))] uppercase tracking-wide">Saved Tax Law Graphs</SelectLabel>
                {taxLawGraphs.map((g) => (
                  <SelectItem key={g.id} value={`tg:${g.id}`} className="text-sm">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-3.5 h-3.5 text-[hsl(var(--logic-node))]" />
                      <span>{g.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>

        {!scenarioChosen && (
          <p className="text-xs text-[hsl(var(--logic-node))] mt-2">
            Select a scenario first to enable tax law selection
          </p>
        )}
      </Card>
    </div>
  );
}
