import React from 'react';
import { useAppStore } from '../../store/appStore.js';

export function ScoreDisplay(): React.ReactElement {
  const { scoreBreakdown } = useAppStore((s) => ({ scoreBreakdown: s.scoreBreakdown }));

  if (!scoreBreakdown) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <div className="w-16 h-16 rounded-full border-2 border-border flex items-center justify-center">
          <svg className="w-8 h-8 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-sm font-medium">No Score Available</p>
        <p className="text-xs text-muted-foreground">Select a scenario and tax config to see evaluation results</p>
      </div>
    );
  }

  const totalScore = scoreBreakdown.totalScore;
  const scoreColor = totalScore >= 90 ? 'text-[hsl(var(--sink-node))]' : totalScore >= 70 ? 'text-[hsl(var(--logic-node))]' : 'text-[hsl(var(--destructive))]';

  // Calculate score grade
  const getScoreGrade = (score: number): string => {
    if (score >= 95) return 'Outstanding';
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Very Good';
    if (score >= 70) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Improvement';
  };

  const grade = getScoreGrade(totalScore);

  // Group rules by impact
  const positiveRules = scoreBreakdown.rules.filter(r => r.pointDelta > 0);
  const negativeRules = scoreBreakdown.rules.filter(r => r.pointDelta < 0);

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold tracking-tight">Evaluation Score</h2>

        {/* Main score card */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-md">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-primary/60" />
          <div className="pl-3">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Total Score</p>
                <p className={`text-4xl font-bold tracking-tight ${scoreColor}`}>
                  {totalScore}
                </p>
                <p className="text-xs text-muted-foreground mt-1">/ 1000 points</p>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-full text-xs font-medium">
                  <span className={`w-2 h-2 rounded-full ${totalScore >= 90 ? 'bg-[hsl(var(--sink-node))]' : totalScore >= 70 ? 'bg-[hsl(var(--logic-node))]' : 'bg-[hsl(var(--destructive))]'}`} />
                  {grade}
                </div>
                <p className="text-sm font-medium mt-2 text-foreground">
                  {scoreBreakdown.disposableIncome.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                </p>
                <p className="text-xs text-muted-foreground">per year</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="score-metric">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Complexity</p>
          <p className="text-sm font-bold mt-1 text-foreground">{scoreBreakdown.complexityPenalty}</p>
        </div>
        <div className="score-metric">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">State Income</p>
          <p className="text-sm font-bold mt-1 text-foreground">
            {Math.abs(scoreBreakdown.stateIncomeEffect).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
          </p>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">Score Breakdown</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {positiveRules.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[hsl(var(--sink-node))]" />
                +{positiveRules.reduce((sum, r) => sum + r.pointDelta, 0)}
              </span>
            )}
            {negativeRules.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[hsl(var(--destructive))]" />
                {negativeRules.reduce((sum, r) => sum + r.pointDelta, 0)}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-1">
          {scoreBreakdown.rules
            .sort((a, b) => b.pointDelta - a.pointDelta)
            .map((rule) => {
              const isPositive = rule.pointDelta > 0;
              const isNegative = rule.pointDelta < 0;
              const colorClass = isPositive ? 'text-[hsl(var(--sink-node))]' : isNegative ? 'text-[hsl(var(--destructive))]' : 'text-muted-foreground';

              return (
                <div
                  key={rule.ruleId}
                  className="group p-2.5 rounded-lg border border-border bg-card hover:bg-muted transition-all duration-200 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate" title={rule.detail}>
                        {rule.ruleId}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {rule.detail}
                      </p>
                    </div>
                    <div className={`text-lg font-bold tabular-nums shrink-0 ${colorClass}`}>
                      {isPositive ? '+' : ''}{rule.pointDelta}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
