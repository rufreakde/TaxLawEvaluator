import React from 'react';
import { useAppStore } from '../../store/appStore.js';
import { Slider } from '../ui/slider.js';

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
    <div className="mt-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">Variable Overrides</h3>
      {entries.map(([key, baseValue]) => {
        const currentValue = variableOverrides[key] ?? baseValue;
        const max = Math.ceil(baseValue * 2 / 1000) * 1000 || 10000;
        return (
          <div key={key} className="space-y-1">
            <div className="flex justify-between text-xs text-gray-600">
              <span className="font-mono">{key}</span>
              <span>{currentValue.toLocaleString('de-DE')} €</span>
            </div>
            <Slider
              min={0}
              max={max}
              step={100}
              value={[currentValue]}
              onValueChange={([val]) => setVariableOverride(key, val)}
              className="w-full"
            />
          </div>
        );
      })}
    </div>
  );
}
