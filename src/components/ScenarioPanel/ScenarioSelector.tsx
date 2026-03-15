import React, { useEffect } from 'react';
import { useAppStore } from '../../store/appStore.js';
import type { ScenarioRow, TaxConfigRow } from '../../types/db.js';

export function ScenarioSelector(): React.ReactElement {
  const {
    scenarios,
    taxConfigs,
    activeScenarioId,
    activeTaxConfigId,
    setActiveScenario,
    setActiveTaxConfig,
  } = useAppStore((s) => ({
    scenarios: s.scenarios,
    taxConfigs: s.taxConfigs,
    activeScenarioId: s.activeScenarioId,
    activeTaxConfigId: s.activeTaxConfigId,
    setActiveScenario: s.setActiveScenario,
    setActiveTaxConfig: s.setActiveTaxConfig,
  }));

  useEffect(() => {
    fetch('/api/v1/scenarios')
      .then((r) => r.json() as Promise<ScenarioRow[]>)
      .then((data) => {
        useAppStore.setState({ scenarios: data });
      })
      .catch(() => {
        // Silently ignore fetch errors
      });

    fetch('/api/v1/tax-configs')
      .then((r) => r.json() as Promise<TaxConfigRow[]>)
      .then((data) => {
        useAppStore.setState({ taxConfigs: data });
      })
      .catch(() => {
        // Silently ignore fetch errors
      });
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Scenario</h2>
        <select
          value={activeScenarioId ?? ''}
          onChange={(e) => setActiveScenario(Number(e.target.value))}
          className="w-full border rounded p-1 text-sm"
        >
          <option value="">Select scenario…</option>
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.household_name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Tax Law</h2>
        <select
          value={activeTaxConfigId ?? ''}
          onChange={(e) => setActiveTaxConfig(Number(e.target.value))}
          className="w-full border rounded p-1 text-sm"
        >
          <option value="">Select tax config…</option>
          {taxConfigs.map((t) => (
            <option key={t.id} value={t.id}>
              {t.region} — {t.schema_version}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
