export interface EconomyMetricRow {
  id: number;
  region_code: string;
  year: number;
  currency: string;
  category: string;
  metric_key: string;
  value: number;
  unit: string;
  label: string;
}

export interface ScenarioRow {
  id: number;
  household_name: string;
  currency: string;
  last_updated: string;
  source_file: string;
}

export interface IncomeRow {
  id: number;
  scenario_id: number;
  name: string;
  amount: number;
  frequency: 'monthly' | 'yearly';
  type: string;
  amount_monthly_normalized: number;
}

export interface AssetRow {
  id: number;
  scenario_id: number;
  name: string;
  value: number;
  type: string;
  asset_class: string;
}

export interface LiabilityRow {
  id: number;
  scenario_id: number;
  name: string;
  total_remaining: number;
  monthly_payment: number;
  interest_rate: number;
  type: string;
}

export interface FixedExpenseRow {
  id: number;
  scenario_id: number;
  name: string;
  amount: number;
  frequency: string;
  type: string | null;
  amount_monthly_normalized: number;
}

export interface TaxConfigRow {
  id: number;
  schema_version: string;
  region: string;
  user_id: number | null;
  source_file: string;
  is_template: number; // SQLite BOOLEAN = INTEGER (0 or 1)
}

export interface TaxInputRow {
  id: number;
  tax_config_id: number;
  input_id: string;
  description: string;
  source: string | null;
  static_value: number | null;
}

export interface UserRow {
  id: number;
  username: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface TaxRuleRow {
  id: number;
  tax_config_id: number;
  name: string;
  formula: string;
  description: string | null;
  rule_order: number;
}

export interface TaxOutputRow {
  id: number;
  tax_config_id: number;
  output_id: string;
  reference_rule: string;
}
