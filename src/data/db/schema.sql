PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS economy_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region_code TEXT NOT NULL,
  year INTEGER NOT NULL,
  currency TEXT NOT NULL,
  category TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  label TEXT NOT NULL,
  UNIQUE (region_code, year, category, metric_key)
);

CREATE TABLE IF NOT EXISTS scenarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  last_updated TEXT NOT NULL,
  source_file TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS income_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly','yearly')),
  type TEXT NOT NULL,
  amount_monthly_normalized REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS asset_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value REAL NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('liquid','invested')),
  asset_class TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS liability_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_remaining REAL NOT NULL,
  monthly_payment REAL NOT NULL,
  interest_rate REAL NOT NULL,
  type TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fixed_expense_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly','yearly')),
  type TEXT,
  amount_monthly_normalized REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS tax_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schema_version TEXT NOT NULL,
  region TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  source_file TEXT NOT NULL UNIQUE,
  is_template BOOLEAN NOT NULL DEFAULT 1  -- 1 for admin-provided defaults, 0 for user-created variants
);

CREATE TABLE IF NOT EXISTS tax_inputs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tax_config_id INTEGER NOT NULL REFERENCES tax_configs(id) ON DELETE CASCADE,
  input_id TEXT NOT NULL,
  description TEXT NOT NULL,
  source TEXT,
  static_value REAL,
  UNIQUE (tax_config_id, input_id)
);

CREATE TABLE IF NOT EXISTS tax_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tax_config_id INTEGER NOT NULL REFERENCES tax_configs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  formula TEXT NOT NULL,
  description TEXT,
  rule_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tax_outputs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tax_config_id INTEGER NOT NULL REFERENCES tax_configs(id) ON DELETE CASCADE,
  output_id TEXT NOT NULL,
  reference_rule TEXT NOT NULL,
  UNIQUE (tax_config_id, output_id)
);

CREATE TABLE IF NOT EXISTS graph_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tax_config_id INTEGER NOT NULL REFERENCES tax_configs(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  diagram_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scenario_graphs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tax_config_id INTEGER NOT NULL REFERENCES tax_configs(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  nodes_json TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  source_file TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS taxlaw_graphs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tax_config_id INTEGER NOT NULL REFERENCES tax_configs(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  nodes_json TEXT NOT NULL DEFAULT '[]',
  links_json TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  source_file TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS eval_graphs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tax_config_id INTEGER NOT NULL REFERENCES tax_configs(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  nodes_json TEXT NOT NULL DEFAULT '[]',
  links_json TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  source_file TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
