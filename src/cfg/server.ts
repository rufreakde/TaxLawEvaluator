import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import session from 'express-session';
import bcrypt from 'bcrypt';
import type Database from 'better-sqlite3';
import { getDatabase } from '../lib/db/DatabaseService.js';
import { ingestAll } from '../lib/ingestion/YamlIngestionService.js';
import { v4 as uuidv4 } from 'uuid';
import yaml from 'js-yaml';
import type { SerializedDiagramState } from '../types/graph.js';
import type { ScenarioNodeEntry, TaxLawNodeEntry, GraphLinkEntry, EvalNodeEntry } from '../types/graph.js';
import type { TaxRuleset } from '../types/tax.js';
import type { UserRow } from '../types/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// Session configuration (use SECRET_SESSION env var in production)
const SESSION_SECRET = process.env.SECRET_SESSION ?? 'dev-secret-change-in-production';
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    },
  }),
);

app.use(express.json());

const DATA_ROOT = join(__dirname, '../../data');
const SCENARIO_GRAPHS_DIR = join(DATA_ROOT, 'scenarios', 'custom');
const TAXLAW_GRAPHS_DIR = join(DATA_ROOT, 'taxes', 'custom');
const EVAL_GRAPHS_DIR = join(DATA_ROOT, 'eval', 'custom');

// Ensure output directories exist
mkdirSync(SCENARIO_GRAPHS_DIR, { recursive: true });
mkdirSync(TAXLAW_GRAPHS_DIR, { recursive: true });
mkdirSync(EVAL_GRAPHS_DIR, { recursive: true });

const db = getDatabase();
ensureDefaultAdmin(db);
ingestAll(db, DATA_ROOT);

// ---------------------------------------------------------------------------
// Authentication & Authorization
// ---------------------------------------------------------------------------

/**
 * Attach current user to request if session is valid.
 */
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(req.session.userId) as UserRow | undefined;
  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: 'User not found' });
    return;
  }
  // Attach user to request
  (req as any).user = user;
  next();
}

/**
 * Require admin role.
 */
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const user = (req as any).user as UserRow | undefined;
  if (!user || user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

/**
 * Check ownership: allowed if user is admin OR resource belongs to the user.
 */
function checkOwnership(resourceUserId: number | null, req: express.Request): boolean {
  const user = (req as any).user as UserRow | undefined;
  if (!user) return false;
  if (user.role === 'admin') return true;
  return resourceUserId !== null && resourceUserId === user.id;
}

// Auth endpoints
app.post('/api/v1/auth/login', (req, res) => {
  const { username, password } = req.body as { username: string; password: string };
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as { id: number; username: string; password_hash: string; role: string } | undefined;
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  // Store user ID in session
  req.session.userId = user.id;
  const { password_hash, ...safeUser } = user;
  res.json(safeUser);
});

app.post('/api/v1/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'Logout failed' });
    } else {
      res.json({ ok: true });
    }
  });
});

app.get('/api/v1/auth/me', requireAuth, (req, res) => {
  const user = (req as any).user as UserRow;
  res.json(user);
});

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

app.get('/api/v1/scenarios', (_req, res) => {
  const rows = db.prepare('SELECT * FROM scenarios').all();
  res.json(rows);
});

app.get('/api/v1/scenarios/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const scenario = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(id);
  if (!scenario) { res.status(404).json({ error: 'Not found' }); return; }
  const income = db.prepare('SELECT * FROM income_items WHERE scenario_id = ?').all(id);
  const assets = db.prepare('SELECT * FROM asset_items WHERE scenario_id = ?').all(id);
  const liabilities = db.prepare('SELECT * FROM liability_items WHERE scenario_id = ?').all(id);
  const fixed_expenses = db.prepare('SELECT * FROM fixed_expense_items WHERE scenario_id = ?').all(id);
  res.json({ scenario, income, assets, liabilities, fixed_expenses });
});

// ---------------------------------------------------------------------------
// Economy
// ---------------------------------------------------------------------------

app.get('/api/v1/economy', (_req, res) => {
  const rows = db.prepare('SELECT * FROM economy_metrics').all();
  res.json(rows);
});

// ---------------------------------------------------------------------------
// Tax Configs
// ---------------------------------------------------------------------------

app.get('/api/v1/tax-configs', (_req, res) => {
  const rows = db.prepare('SELECT * FROM tax_configs').all();
  res.json(rows);
});

app.get('/api/v1/tax-configs/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const config = db.prepare('SELECT * FROM tax_configs WHERE id = ?').get(id);
  if (!config) { res.status(404).json({ error: 'Not found' }); return; }
  const inputs = db.prepare('SELECT * FROM tax_inputs WHERE tax_config_id = ?').all(id);
  const rules = db.prepare('SELECT * FROM tax_rules WHERE tax_config_id = ? ORDER BY rule_order').all(id);
  const outputs = db.prepare('SELECT * FROM tax_outputs WHERE tax_config_id = ?').all(id);
  res.json({ config, inputs, rules, outputs });
});

// ---------------------------------------------------------------------------
// Legacy Graph Configs (monolithic — kept for backward-compat load path)
// ---------------------------------------------------------------------------

app.get('/api/v1/graphs', (_req, res) => {
  const rows = db.prepare('SELECT id, name, tax_config_id, created_at, updated_at FROM graph_configs').all();
  res.json(rows);
});

app.get('/api/v1/graphs/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM graph_configs WHERE id = ?').get(req.params.id) as SerializedDiagramState | undefined;
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(row);
});

app.post('/api/v1/graphs', requireAuth, (req, res) => {
  const { name, tax_config_id, diagram_json } = req.body as { name: string; tax_config_id: number; diagram_json: string };
  if (!name || !tax_config_id || !diagram_json) { res.status(400).json({ error: 'Missing fields' }); return; }
  const userId = (req as any).user.id;
  const id = uuidv4();
  db.prepare(
    'INSERT INTO graph_configs (id, name, tax_config_id, user_id, diagram_json) VALUES (?, ?, ?, ?, ?)',
  ).run(id, name, tax_config_id, userId, diagram_json);
  const row = db.prepare('SELECT * FROM graph_configs WHERE id = ?').get(id);
  res.status(201).json(row);
});

app.put('/api/v1/graphs/:id', requireAuth, (req, res) => {
  const { name, diagram_json } = req.body as { name?: string; diagram_json?: string };
  const existing = db.prepare('SELECT * FROM graph_configs WHERE id = ?').get(req.params.id) as { id: string; user_id: number | null } | undefined;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  const user = (req as any).user as UserRow;
  // Only owner or admin can update
  if (!checkOwnership(existing.user_id, req)) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }
  if (name) db.prepare('UPDATE graph_configs SET name = ?, updated_at = datetime(\'now\') WHERE id = ?').run(name, req.params.id);
  if (diagram_json) db.prepare('UPDATE graph_configs SET diagram_json = ?, updated_at = datetime(\'now\') WHERE id = ?').run(diagram_json, req.params.id);
  const row = db.prepare('SELECT * FROM graph_configs WHERE id = ?').get(req.params.id);
  res.json(row);
});

app.delete('/api/v1/graphs/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT user_id FROM graph_configs WHERE id = ?').get(req.params.id) as { user_id: number | null } | undefined;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  if (!checkOwnership(existing.user_id, req)) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }
  db.prepare('DELETE FROM graph_configs WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// Scenario Graphs (Source nodes — who the taxpayer is)
// ---------------------------------------------------------------------------

app.get('/api/v1/scenario-graphs', (_req, res) => {
  const rows = db.prepare(
    'SELECT id, name, tax_config_id, version, source_file, created_at, updated_at FROM scenario_graphs',
  ).all();
  res.json(rows);
});

app.get('/api/v1/scenario-graphs/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM scenario_graphs WHERE id = ?').get(req.params.id) as
    | { id: string; name: string; tax_config_id: number; nodes_json: string; version: number; source_file: string | null }
    | undefined;
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ ...row, nodes: JSON.parse(row.nodes_json) as ScenarioNodeEntry[] });
});

app.post('/api/v1/scenario-graphs', requireAuth, (req, res) => {
  const { name, tax_config_id, nodes } = req.body as {
    name: string;
    tax_config_id: number;
    nodes: ScenarioNodeEntry[];
  };
  if (!name || !tax_config_id || !nodes) { res.status(400).json({ error: 'Missing fields' }); return; }
  const userId = (req as any).user.id;
  const id = uuidv4();
  const source_file = `${id}.yaml`;
  const nodes_json = JSON.stringify(nodes);

  db.prepare(
    'INSERT INTO scenario_graphs (id, name, tax_config_id, user_id, nodes_json, source_file) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, name, tax_config_id, userId, nodes_json, source_file);

  const yamlContent = yaml.dump(
    { id, name, tax_config_id, version: 1, nodes },
    { lineWidth: -1 },
  );
  writeFileSync(join(SCENARIO_GRAPHS_DIR, source_file), yamlContent, 'utf8');

  const row = db.prepare('SELECT * FROM scenario_graphs WHERE id = ?').get(id);
  res.status(201).json(row);
});

app.put('/api/v1/scenario-graphs/:id', requireAuth, (req, res) => {
  const { name, nodes } = req.body as { name?: string; nodes?: ScenarioNodeEntry[] };
  const existing = db.prepare('SELECT * FROM scenario_graphs WHERE id = ?').get(req.params.id) as
    | { id: string; name: string; tax_config_id: number; user_id: number | null; nodes_json: string; version: number; source_file: string | null }
    | undefined;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  if (!checkOwnership(existing.user_id, req)) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  const newName = name ?? existing.name;
  const newNodes = nodes ?? (JSON.parse(existing.nodes_json) as ScenarioNodeEntry[]);
  const newVersion = existing.version + 1;

  db.prepare(
    'UPDATE scenario_graphs SET name = ?, nodes_json = ?, version = ?, updated_at = datetime(\'now\') WHERE id = ?',
  ).run(newName, JSON.stringify(newNodes), newVersion, req.params.id);

  if (existing.source_file) {
    const yamlContent = yaml.dump(
      { id: existing.id, name: newName, tax_config_id: existing.tax_config_id, version: newVersion, nodes: newNodes },
      { lineWidth: -1 },
    );
    writeFileSync(join(SCENARIO_GRAPHS_DIR, existing.source_file), yamlContent, 'utf8');
  }

  const row = db.prepare('SELECT * FROM scenario_graphs WHERE id = ?').get(req.params.id);
  res.json(row);
});

app.delete('/api/v1/scenario-graphs/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT user_id FROM scenario_graphs WHERE id = ?').get(req.params.id) as { user_id: number | null } | undefined;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  if (!checkOwnership(existing.user_id, req)) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }
  db.prepare('DELETE FROM scenario_graphs WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// Tax Law Graphs (Logic nodes — how the tax is computed)
// ---------------------------------------------------------------------------

app.get('/api/v1/taxlaw-graphs', (_req, res) => {
  const rows = db.prepare(
    'SELECT id, name, tax_config_id, version, source_file, created_at, updated_at FROM taxlaw_graphs',
  ).all();
  res.json(rows);
});

app.get('/api/v1/taxlaw-graphs/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM taxlaw_graphs WHERE id = ?').get(req.params.id) as
    | { id: string; name: string; tax_config_id: number; nodes_json: string; links_json: string; version: number; source_file: string | null }
    | undefined;
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({
    ...row,
    nodes: JSON.parse(row.nodes_json) as TaxLawNodeEntry[],
    links: JSON.parse(row.links_json) as GraphLinkEntry[],
  });
});

app.post('/api/v1/taxlaw-graphs', requireAuth, (req, res) => {
  const { name, tax_config_id, nodes, links } = req.body as {
    name: string;
    tax_config_id: number;
    nodes: TaxLawNodeEntry[];
    links: GraphLinkEntry[];
  };
  if (!name || !tax_config_id || !nodes || !links) { res.status(400).json({ error: 'Missing fields' }); return; }
  const userId = (req as any).user.id;
  const id = uuidv4();
  const source_file = `${id}.yaml`;

  db.prepare(
    'INSERT INTO taxlaw_graphs (id, name, tax_config_id, user_id, nodes_json, links_json, source_file) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, name, tax_config_id, userId, JSON.stringify(nodes), JSON.stringify(links), source_file);

  const yamlContent = yaml.dump(
    { id, name, tax_config_id, version: 1, nodes, links },
    { lineWidth: -1 },
  );
  writeFileSync(join(TAXLAW_GRAPHS_DIR, source_file), yamlContent, 'utf8');

  const row = db.prepare('SELECT * FROM taxlaw_graphs WHERE id = ?').get(id);
  res.status(201).json(row);
});

app.put('/api/v1/taxlaw-graphs/:id', requireAuth, (req, res) => {
  const { name, nodes, links } = req.body as {
    name?: string;
    nodes?: TaxLawNodeEntry[];
    links?: GraphLinkEntry[];
  };
  const existing = db.prepare('SELECT * FROM taxlaw_graphs WHERE id = ?').get(req.params.id) as
    | { id: string; name: string; tax_config_id: number; user_id: number | null; nodes_json: string; links_json: string; version: number; source_file: string | null }
    | undefined;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  if (!checkOwnership(existing.user_id, req)) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  const newName = name ?? existing.name;
  const newNodes = nodes ?? (JSON.parse(existing.nodes_json) as TaxLawNodeEntry[]);
  const newLinks = links ?? (JSON.parse(existing.links_json) as GraphLinkEntry[]);
  const newVersion = existing.version + 1;

  db.prepare(
    'UPDATE taxlaw_graphs SET name = ?, nodes_json = ?, links_json = ?, version = ?, updated_at = datetime(\'now\') WHERE id = ?',
  ).run(newName, JSON.stringify(newNodes), JSON.stringify(newLinks), newVersion, req.params.id);

  if (existing.source_file) {
    const yamlContent = yaml.dump(
      { id: existing.id, name: newName, tax_config_id: existing.tax_config_id, version: newVersion, nodes: newNodes, links: newLinks },
      { lineWidth: -1 },
    );
    writeFileSync(join(TAXLAW_GRAPHS_DIR, existing.source_file), yamlContent, 'utf8');
  }

  const row = db.prepare('SELECT * FROM taxlaw_graphs WHERE id = ?').get(req.params.id);
  res.json(row);
});

app.delete('/api/v1/taxlaw-graphs/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT user_id FROM taxlaw_graphs WHERE id = ?').get(req.params.id) as { user_id: number | null } | undefined;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  if (!checkOwnership(existing.user_id, req)) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }
  db.prepare('DELETE FROM taxlaw_graphs WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// Tax Config Management (Create new, Clone)
// ---------------------------------------------------------------------------

/**
 * Create a brand new tax config from scratch (user-owned)
 */
app.post('/api/v1/tax-configs', requireAuth, (req, res) => {
  const { region, schema_version, inputs, rules, outputs } = req.body as {
    region: string;
    schema_version?: string;
    inputs: Array<{ input_id: string; description: string; source?: string; static_value?: number }>;
    rules: Array<{ name: string; formula: string; description?: string; rule_order?: number }>;
    outputs: Array<{ output_id: string; reference_rule: string }>;
  };
  if (!region || !inputs || !rules) {
    res.status(400).json({ error: 'region, inputs, and rules are required' });
    return;
  }

  const userId = (req as any).user.id;
  const yamlId = uuidv4();
  const sourceFileName = `${yamlId}.yaml`;
  const id = db.prepare(
    'INSERT INTO tax_configs (schema_version, region, user_id, is_template, source_file) VALUES (?, ?, ?, 0, ?)',
    [schema_version ?? '1.0.0', region, userId, sourceFileName]
  ).run() as { lastInsertRowid: number };
  const configId = id.lastInsertRowid;

  // Generate YAML representation
  const taxConfigYaml: TaxRuleset = {
    metadata: {
      schema_version: schema_version ?? '1.0.0',
      region,
      user_id: userId,
      is_template: false,
    },
    inputs: inputs.map(inp => ({
      id: inp.input_id,
      description: inp.description,
      source: inp.source ?? undefined,
      value: inp.static_value ?? undefined,
    })),
    tax_rules: rules.map((r, idx) => ({
      name: r.name,
      formula: r.formula,
      description: r.description ?? undefined,
    })),
    outputs: outputs ?? [],
  };
  const yamlContent = yaml.dump(taxConfigYaml, { lineWidth: -1 });
  writeFileSync(join(DATA_ROOT, 'taxes', sourceFileName), yamlContent, 'utf8');

  // Insert inputs
  for (const input of inputs) {
    db.prepare(
      'INSERT INTO tax_inputs (tax_config_id, input_id, description, source, static_value) VALUES (?, ?, ?, ?, ?)'
    ).run(configId, input.input_id, input.description, input.source ?? null, input.static_value ?? null);
  }

  // Insert rules with order
  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    db.prepare(
      'INSERT INTO tax_rules (tax_config_id, name, formula, description, rule_order) VALUES (?, ?, ?, ?, ?)'
    ).run(configId, r.name, r.formula, r.description ?? null, r.rule_order ?? i);
  }

  // Insert outputs
  for (const out of outputs) {
    db.prepare(
      'INSERT INTO tax_outputs (tax_config_id, output_id, reference_rule) VALUES (?, ?, ?)'
    ).run(configId, out.output_id, out.reference_rule);
  }

  const createdConfig = db.prepare('SELECT * FROM tax_configs WHERE id = ?').get(configId);
  res.status(201).json(createdConfig);
});

/**
 * Clone an existing tax config (including all inputs/rules/outputs) as a new user-owned config.
 * Useful for users to customize admin templates.
 */
app.post('/api/v1/tax-configs/:id/clone', requireAuth, (req, res) => {
  const sourceId = parseInt(req.params.id, 10);
  const body = req.body as { name?: string };
  const source = db.prepare('SELECT * FROM tax_configs WHERE id = ?').get(sourceId) as
    | { id: number; schema_version: string; region: string; user_id: number | null; source_file: string | null }
    | undefined;
  if (!source) {
    res.status(404).json({ error: 'Source tax config not found' });
    return;
  }

  const userId = (req as any).user.id;
  const finalRegion = body.name ?? `${source.region} (Copy)`;
  const yamlId = uuidv4();
  const sourceFileName = `${yamlId}.yaml`;
  const newIdResult = db.prepare(
    'INSERT INTO tax_configs (schema_version, region, user_id, is_template, source_file) VALUES (?, ?, ?, 0, ?)',
    [source.schema_version, finalRegion, userId, sourceFileName]
  ).run() as { lastInsertRowid: number };
  const newConfigId = newIdResult.lastInsertRowid;

  // Copy inputs
  const inputRows = db.prepare('SELECT * FROM tax_inputs WHERE tax_config_id = ?').all(sourceId) as Array<{
    input_id: string;
    description: string;
    source: string | null;
    static_value: number | null;
  }>;
  for (const inp of inputRows) {
    db.prepare(
      'INSERT INTO tax_inputs (tax_config_id, input_id, description, source, static_value) VALUES (?, ?, ?, ?, ?)'
    ).run(newConfigId, inp.input_id, inp.description, inp.source, inp.static_value);
  }

  // Copy rules
  const ruleRows = db.prepare('SELECT * FROM tax_rules WHERE tax_config_id = ? ORDER BY rule_order').all(sourceId) as Array<{
    name: string;
    formula: string;
    description: string | null;
    rule_order: number;
  }>;
  for (const rule of ruleRows) {
    db.prepare(
      'INSERT INTO tax_rules (tax_config_id, name, formula, description, rule_order) VALUES (?, ?, ?, ?, ?)'
    ).run(newConfigId, rule.name, rule.formula, rule.description, rule.rule_order);
  }

  // Copy outputs
  const outputRows = db.prepare('SELECT * FROM tax_outputs WHERE tax_config_id = ?').all(sourceId) as Array<{
    output_id: string;
    reference_rule: string;
  }>;
  for (const out of outputRows) {
    db.prepare(
      'INSERT INTO tax_outputs (tax_config_id, output_id, reference_rule) VALUES (?, ?, ?)'
    ).run(newConfigId, out.output_id, out.reference_rule);
  }

  // Write YAML file
  const taxConfigYaml: TaxRuleset = {
    metadata: {
      schema_version: source.schema_version,
      region: newRegion,
      user_id: userId,
      is_template: false,
    },
    inputs: inputRows.map(inp => ({
      id: inp.input_id,
      description: inp.description,
      source: inp.source ?? undefined,
      value: inp.static_value ?? undefined,
    })),
    tax_rules: ruleRows.map(r => ({
      name: r.name,
      formula: r.formula,
      description: r.description ?? undefined,
    })),
    outputs: outputRows.map(out => ({
      output_id: out.output_id,
      reference_rule: out.reference_rule,
    })),
  };
  const yamlContent = yaml.dump(taxConfigYaml, { lineWidth: -1 });
  writeFileSync(join(DATA_ROOT, 'taxes', sourceFileName), yamlContent, 'utf8');

  const newConfig = db.prepare('SELECT * FROM tax_configs WHERE id = ?').get(newConfigId);
  res.status(201).json(newConfig);
});

// ---------------------------------------------------------------------------
// Tax Config Rules
// ---------------------------------------------------------------------------

app.post('/api/v1/tax-configs/:id/rules', requireAuth, (req, res) => {
  const taxConfigId = parseInt(req.params.id, 10);
  const { name, formula, description } = req.body as { name: string; formula: string; description?: string };
  if (!name || !formula) { res.status(400).json({ error: 'name and formula required' }); return; }

  const config = db.prepare('SELECT * FROM tax_configs WHERE id = ?').get(taxConfigId) as { id: number; source_file: string; user_id: number | null; is_template: number } | undefined;
  if (!config) { res.status(404).json({ error: 'Not found' }); return; }

  // Check if user can modify this tax config
  const user = (req as any).user as UserRow;
  // If config is a template (is_template=1), only admin can modify
  if (config.is_template === 1 && user.role !== 'admin') {
    res.status(403).json({ error: 'Cannot modify admin template. Clone the tax config to customize.' });
    return;
  }
  // If config is owned by someone else (user_id not null and not current user), only admin can modify
  if (config.user_id !== null && config.user_id !== user.id && user.role !== 'admin') {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  const maxRow = db.prepare('SELECT MAX(rule_order) as m FROM tax_rules WHERE tax_config_id = ?').get(taxConfigId) as { m: number | null };
  const rule_order = (maxRow.m ?? -1) + 1;

  const { lastInsertRowid } = db.prepare(
    'INSERT INTO tax_rules (tax_config_id, name, formula, description, rule_order) VALUES (?, ?, ?, ?, ?)',
  ).run(taxConfigId, name, formula, description ?? null, rule_order);
  const newRule = db.prepare('SELECT * FROM tax_rules WHERE id = ?').get(lastInsertRowid);

  // YAML write is best-effort — DB insert is the source of truth
  try {
    const yamlPath = join(DATA_ROOT, 'taxes', config.source_file);
    const parsed = yaml.load(readFileSync(yamlPath, 'utf8')) as TaxRuleset;
    parsed.tax_rules.push({ name, formula, ...(description ? { description } : {}) });
    writeFileSync(yamlPath, yaml.dump(parsed, { lineWidth: -1 }), 'utf8');
  } catch {
    // Non-fatal: YAML sync failed but the rule is persisted in the DB
  }

  res.status(201).json(newRule);
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

// Allow owners or admins to delete tax configs they own; templates (admin) can only be deleted by admin
app.delete('/api/v1/tax-configs/:id', requireAuth, (req, res) => {
  const config = db.prepare('SELECT * FROM tax_configs WHERE id = ?').get(req.params.id) as
    | { id: number; user_id: number | null; is_template: number; source_file: string | null }
    | undefined;
  if (!config) { res.status(404).json({ error: 'Not found' }); return; }

  const user = (req as any).user as UserRow;
  // Admin can delete any; otherwise must be owner and config must be non-template (user-owned)
  if (user.role !== 'admin') {
    if (config.is_template === 1) {
      res.status(403).json({ error: 'Cannot delete admin template' });
      return;
    }
    if (config.user_id !== user.id) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }
  }

  // Delete the YAML file if exists
  if (config.source_file) {
    try {
      unlinkSync(join(DATA_ROOT, 'taxes', config.source_file), 'utf8');
    } catch {
      // ignore if file doesn't exist
    }
  }

  // DB cascade will delete related inputs/rules/outputs and dependent graphs
  db.prepare('DELETE FROM tax_configs WHERE id = ?').run(config.id);
  res.status(204).send();
});

app.post('/api/v1/admin/reingest', requireAuth, requireAdmin, (req, res) => {
  ingestAll(db, DATA_ROOT);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Eval Graphs (Benchmark configuration - admin only)
// ---------------------------------------------------------------------------

app.get('/api/v1/eval-graphs', requireAuth, requireAdmin, (req, res) => {
  const rows = db.prepare(
    'SELECT id, name, tax_config_id, user_id, version, source_file, created_at, updated_at FROM eval_graphs',
  ).all();
  res.json(rows);
});

app.get('/api/v1/eval-graphs/:id', requireAuth, requireAdmin, (req, res) => {
  const row = db.prepare('SELECT * FROM eval_graphs WHERE id = ?').get(req.params.id) as
    | { id: string; name: string; tax_config_id: number; user_id: number | null; nodes_json: string; links_json: string; version: number; source_file: string | null }
    | undefined;
  if (!row) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({
    ...row,
    nodes: JSON.parse(row.nodes_json) as EvalNodeEntry[],
    links: JSON.parse(row.links_json) as GraphLinkEntry[],
  });
});

app.post('/api/v1/eval-graphs', requireAuth, requireAdmin, (req, res) => {
  const { name, tax_config_id, nodes, links } = req.body as {
    name: string;
    tax_config_id: number;
    nodes: EvalNodeEntry[];
    links: GraphLinkEntry[];
  };
  if (!name || !tax_config_id || !nodes || !links) { res.status(400).json({ error: 'Missing fields' }); return; }
  const userId = (req as any).user.id;
  const id = uuidv4();
  const source_file = `${id}.yaml`;

  db.prepare(
    'INSERT INTO eval_graphs (id, name, tax_config_id, user_id, nodes_json, links_json, source_file) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, name, tax_config_id, userId, JSON.stringify(nodes), JSON.stringify(links), source_file);

  const yamlContent = yaml.dump(
    { id, name, tax_config_id, version: 1, nodes, links },
    { lineWidth: -1 },
  );
  writeFileSync(join(EVAL_GRAPHS_DIR, source_file), yamlContent, 'utf8');

  const row = db.prepare('SELECT * FROM eval_graphs WHERE id = ?').get(id);
  res.status(201).json(row);
});

app.put('/api/v1/eval-graphs/:id', requireAuth, requireAdmin, (req, res) => {
  const { name, nodes, links } = req.body as {
    name?: string;
    nodes?: EvalNodeEntry[];
    links?: GraphLinkEntry[];
  };
  const existing = db.prepare('SELECT * FROM eval_graphs WHERE id = ?').get(req.params.id) as
    | { id: string; name: string; tax_config_id: number; user_id: number | null; nodes_json: string; links_json: string; version: number; source_file: string | null }
    | undefined;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const newName = name ?? existing.name;
  const newNodes = nodes ?? (JSON.parse(existing.nodes_json) as EvalNodeEntry[]);
  const newLinks = links ?? (JSON.parse(existing.links_json) as GraphLinkEntry[]);
  const newVersion = existing.version + 1;

  db.prepare(
    'UPDATE eval_graphs SET name = ?, nodes_json = ?, links_json = ?, version = ?, updated_at = datetime(\'now\') WHERE id = ?',
  ).run(newName, JSON.stringify(newNodes), JSON.stringify(newLinks), newVersion, req.params.id);

  if (existing.source_file) {
    const yamlContent = yaml.dump(
      { id: existing.id, name: newName, tax_config_id: existing.tax_config_id, version: newVersion, nodes: newNodes, links: newLinks },
      { lineWidth: -1 },
    );
    writeFileSync(join(EVAL_GRAPHS_DIR, existing.source_file), yamlContent, 'utf8');
  }

  const row = db.prepare('SELECT * FROM eval_graphs WHERE id = ?').get(req.params.id);
  res.json(row);
});

app.delete('/api/v1/eval-graphs/:id', requireAuth, requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT user_id FROM eval_graphs WHERE id = ?').get(req.params.id) as { user_id: number | null } | undefined;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  // Admin can delete any
  db.prepare('DELETE FROM eval_graphs WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

/**
 * Ensure there is at least one admin user in the database.
 * Creates default admin (username: admin, password: admin123) if no users exist.
 */
function ensureDefaultAdmin(database: any): void {
  const count = database.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
  if (count.c === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    database.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
  }
}

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  // Server started
});

export { app };
