import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore.js';
import type { ScenarioRow, TaxConfigRow } from '../../types/db.js';

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
      .then((r) => r.json() as Promise<ScenarioRow[]>)
      .then((data) => {
        useAppStore.setState({ scenarios: data });
      })
      .catch(() => {});

    fetch('/api/v1/tax-configs')
      .then((r) => r.json() as Promise<TaxConfigRow[]>)
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

  const scenarioChosen = activeScenarioId !== null || activeScenarioGraphId !== null;

  function handleScenarioChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    const v = e.target.value;
    if (!v) return;
    if (v.startsWith('s:')) setActiveScenario(Number(v.slice(2)));
    else loadScenarioGraph(v.slice(3));
  }

  function handleTaxChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    const v = e.target.value;
    if (!v) return;
    if (v.startsWith('tc:')) setActiveTaxConfig(Number(v.slice(3)));
    else loadTaxLawGraph(v.slice(3));
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Scenario</h2>
        <select
          value={scenarioValue}
          onChange={handleScenarioChange}
          className="w-full border rounded p-1 text-sm"
        >
          <option value="">Select scenario…</option>
          <optgroup label="Templates">
            {scenarios.map((s) => (
              <option key={s.id} value={`s:${s.id}`}>
                {s.household_name}
              </option>
            ))}
          </optgroup>
          {scenarioGraphs.length > 0 && (
            <optgroup label="Custom">
              {scenarioGraphs.map((g) => (
                <option key={g.id} value={`sg:${g.id}`}>
                  {g.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Tax Law</h2>
        <select
          value={taxValue}
          onChange={handleTaxChange}
          disabled={!scenarioChosen}
          className="w-full border rounded p-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Select tax config…</option>
          <optgroup label="Templates">
            {taxConfigs.map((t) => (
              <option key={t.id} value={`tc:${t.id}`}>
                {t.region} — {t.schema_version}
              </option>
            ))}
          </optgroup>
          {taxLawGraphs.length > 0 && (
            <optgroup label="Custom">
              {taxLawGraphs.map((g) => (
                <option key={g.id} value={`tg:${g.id}`}>
                  {g.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
    </div>
  );
}
