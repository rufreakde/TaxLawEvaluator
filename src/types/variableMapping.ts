export interface ScenarioPath {
  collection: 'income' | 'assets' | 'liabilities' | 'fixed_expenses';
  index: number;
  field: string;
}

export interface ResolvedVariableMap {
  scenarioId: number;
  taxConfigId: number;
  variables: Record<string, number>;
  resolvedAt: number;
}
