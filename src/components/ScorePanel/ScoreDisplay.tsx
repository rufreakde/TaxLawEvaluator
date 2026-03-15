import React from 'react';
import { useAppStore } from '../../store/appStore.js';

export function ScoreDisplay(): React.ReactElement {
  const { scoreBreakdown } = useAppStore((s) => ({ scoreBreakdown: s.scoreBreakdown }));

  if (!scoreBreakdown) {
    return <p className="text-gray-500">Select a scenario and tax config to see score.</p>;
  }

  return (
    <div>
      <h2 className="font-semibold mb-2">Score: {scoreBreakdown.totalScore}</h2>
      <p>Disposable Income: {scoreBreakdown.disposableIncome.toFixed(2)} EUR/year</p>
      <table className="mt-4 w-full text-sm border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left py-1">Rule</th>
            <th className="text-right py-1">Delta</th>
            <th className="text-left py-1 pl-4">Detail</th>
          </tr>
        </thead>
        <tbody>
          {scoreBreakdown.rules.map((r) => (
            <tr key={r.ruleId} className="border-b">
              <td className="py-1">{r.ruleId}</td>
              <td className="text-right py-1">{r.pointDelta}</td>
              <td className="py-1 pl-4">{r.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
