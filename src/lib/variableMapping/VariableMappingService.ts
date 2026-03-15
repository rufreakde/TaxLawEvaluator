import type { HouseholdFinances } from '../../../types/scenariodata.js';
import type { TaxInputRow } from '../../types/db.js';
import type { ScenarioPath, ResolvedVariableMap } from '../../types/variableMapping.js';

const SOURCE_PATH_REGEX = /^(\w+)\[(\d+)\]\.(\w+)$/;

export function parseSourcePath(source: string): ScenarioPath | null {
  const match = SOURCE_PATH_REGEX.exec(source);
  if (!match) return null;
  return {
    collection: match[1] as ScenarioPath['collection'],
    index: parseInt(match[2], 10),
    field: match[3],
  };
}

export function resolveVariables(
  scenario: HouseholdFinances,
  scenarioId: number,
  taxInputs: TaxInputRow[],
  taxConfigId: number,
  overrides: Record<string, number> = {},
): ResolvedVariableMap {
  const variables: Record<string, number> = {};

  for (const input of taxInputs) {
    if (input.input_id in overrides) {
      variables[input.input_id] = overrides[input.input_id];
      continue;
    }

    if (input.source) {
      const path = parseSourcePath(input.source);
      if (path) {
        const value = resolveFromScenario(scenario, path);
        if (value !== null) {
          variables[input.input_id] = value;
          continue;
        }
      }
    }

    if (input.static_value !== null) {
      variables[input.input_id] = input.static_value;
    }
  }

  return {
    scenarioId,
    taxConfigId,
    variables,
    resolvedAt: Date.now(),
  };
}

function resolveFromScenario(scenario: HouseholdFinances, path: ScenarioPath): number | null {
  const collection = scenario[path.collection];
  if (!Array.isArray(collection) || path.index >= collection.length) return null;

  const item = collection[path.index] as Record<string, unknown>;
  const rawValue = item[path.field];
  if (typeof rawValue !== 'number') return null;

  // Normalize monthly amounts to yearly for tax calculations
  if (path.field === 'amount' && 'frequency' in item) {
    const freq = item['frequency'] as string;
    if (freq === 'monthly') return rawValue * 12;
  }

  return rawValue;
}
