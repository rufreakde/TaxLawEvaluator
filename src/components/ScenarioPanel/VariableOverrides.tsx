import React from 'react';
import { useAppStore } from '../../store/appStore.js';

export function VariableOverrides(): React.ReactElement {
  const { resolvedVariables, variableOverrides, setVariableOverride } = useAppStore((s) => ({
    resolvedVariables: s.resolvedVariables,
    variableOverrides: s.variableOverrides,
    setVariableOverride: s.setVariableOverride,
  }));

  if (!resolvedVariables) {
    return <p className="text-xs text-gray-400 mt-2">No variables resolved yet.</p>;
  }

  const entries = Object.entries(resolvedVariables.variables);
  if (entries.length === 0) {
    return <p className="text-xs text-gray-400 mt-2">No input variables available.</p>;
  }

  return (
    <div className="mt-4 space-y-2">
      <h3 className="text-sm font-semibold text-gray-700">Variable Overrides</h3>
      {entries.map(([key, baseValue]) => {
        const currentValue = variableOverrides[key] ?? baseValue;
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="font-mono text-xs text-gray-600 w-4 shrink-0">{key}</span>
            <input
              type="number"
              value={currentValue}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v)) setVariableOverride(key, v);
              }}
              className="flex-1 h-7 text-xs border border-gray-300 rounded px-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <span className="text-xs text-gray-400 shrink-0">€</span>
          </div>
        );
      })}
    </div>
  );
}
