import React from 'react';
import { ScenarioSelector } from './components/ScenarioPanel/ScenarioSelector.js';
import { VariableOverrides } from './components/ScenarioPanel/VariableOverrides.js';
import { ScoreDisplay } from './components/ScorePanel/ScoreDisplay.js';
import { GraphEditor } from './components/GraphEditor/GraphEditor.js';
import { useAppStore } from './store/appStore.js';
import { Badge } from './components/ui/badge.js';

export default function App(): React.ReactElement {
  const scoreBreakdown = useAppStore((s) => s.scoreBreakdown);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2 bg-white border-b shadow-sm">
        <h1 className="text-base font-bold tracking-tight">TaxLawEvaluator</h1>
        {scoreBreakdown && (
          <Badge variant={scoreBreakdown.totalScore >= 90 ? 'default' : 'secondary'}>
            Score: {scoreBreakdown.totalScore}
          </Badge>
        )}
      </header>

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Scenario Panel */}
        <aside className="w-64 flex-shrink-0 bg-white border-r p-4 overflow-y-auto">
          <ScenarioSelector />
          <VariableOverrides />
        </aside>

        {/* Center: Node Graph Canvas */}
        <main className="flex-1 overflow-hidden p-2">
          <GraphEditor />
        </main>

        {/* Right: Score Panel */}
        <aside className="w-72 flex-shrink-0 bg-white border-l p-4 overflow-y-auto">
          <ScoreDisplay />
        </aside>
      </div>
    </div>
  );
}
