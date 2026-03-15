export interface TaxRuleset {
  metadata: {
    schema_version: string;
    region: string;
  };
  inputs: InputDefinition[];
  tax_rules: TaxRule[];
  outputs: OutputDefinition[];
}

export interface InputDefinition {
  id: string; // "a", "b", etc.
  description: string;
  source?: string; // Reference to your other YAML (e.g., "income[0].amount")
  value?: number;  // Static fallback value
}

export interface TaxRule {
  name: string;
  formula: string; // The string containing "$a * 0.75"
  description?: string;
}

export interface OutputDefinition {
  id: string;
  reference_rule: string; // Link to the name of a TaxRule
}