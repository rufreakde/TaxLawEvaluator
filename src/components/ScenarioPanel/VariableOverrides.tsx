import React from 'react';
import { useAppStore } from '../../store/appStore.js';
import { Card } from '../ui/card.js';
import { Slider } from '../ui/slider.js';
import { Button } from '../ui/button.js';
import { RefreshCw, TrendingUp, DollarSign } from 'lucide-react';

export function VariableOverrides(): React.ReactElement {
  const { resolvedVariables, variableOverrides, setVariableOverride } = useAppStore((s) => ({
    resolvedVariables: s.resolvedVariables,
    variableOverrides: s.variableOverrides,
    setVariableOverride: s.setVariableOverride,
  }));

  if (!resolvedVariables) {
    return (
      <Card className="p-4 mt-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
            <RefreshCw className="w-4 h-4" />
          </div>
          <p className="text-sm">No variables resolved yet.</p>
        </div>
      </Card>
    );
  }

  const entries = Object.entries(resolvedVariables.variables);
  if (entries.length === 0) {
    return (
      <Card className="p-4 mt-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
            <DollarSign className="w-4 h-4" />
          </div>
          <p className="text-sm">No input variables available.</p>
        </div>
      </Card>
    );
  }

  const currency = resolvedVariables.currency ?? 'EUR';
  const hasOverrides = Object.keys(variableOverrides).length > 0;

  function resetAllOverrides(): void {
    Object.keys(variableOverrides).forEach((key) => {
      setVariableOverride(key, resolvedVariables.variables[key]);
    });
  }

  return (
    <Card className="p-4 mt-3  border-[hsl(var(--logic-foreground))]" data-testid="variable-overrides-panel">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Variable Overrides</h3>
        </div>
        {hasOverrides && (
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={resetAllOverrides}
            data-testid="reset-overrides-button"
            className="h-7 text-xs text-foreground-muted hover:text-foreground"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Reset All
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {entries.map(([key, baseValue]) => {
          const override = variableOverrides[key];
          const currentValue = override ?? baseValue;
          const isOverridden = override !== undefined;
          const percentChange = baseValue !== 0 ? ((currentValue - baseValue) / baseValue * 100) : 0;

          // Calculate slider range around base value
          const min = 0;
          const max = baseValue * 3;
          const step = baseValue * 0.1;

          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono px-1.5 py-0.5 bg-muted rounded text-[hsl(var(--source-node))] font-bold">
                    ${key}
                  </code>
                  {isOverridden && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-secondary text-[hsl(var(--source-node))] rounded-full font-medium">
                      Modified
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Base:</span>
                  <span className="text-xs font-mono text-[hsl(var(--source-node))]">
                    {baseValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Slider
                  value={[currentValue]}
                  min={min}
                  max={max}
                  step={step}
                  onValueChange={([v]) => setVariableOverride(key, v)}
                  className="flex-1"
                  thumbClassName="border-2 border-[hsl(var(--source-node))] bg-background"
                />
                <div className="w-32">
                  <input
                    type="number"
                    value={currentValue}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) setVariableOverride(key, v);
                    }}
                    step={step}
                    min={0}
                    data-testid={`variable-input-${key}`}
                    className="w-full h-8 text-xs border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground font-mono text-right"
                  />
                </div>
              </div>

              {isOverridden && percentChange !== 0 && (
                <div className="text-xs font-medium text-foreground">
                  {percentChange > 0 ? '+' : ''}{percentChange.toFixed(1)}% from base
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
