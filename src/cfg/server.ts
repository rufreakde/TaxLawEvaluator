import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { getDatabase } from '../lib/db/DatabaseService.js';
import { ingestAll } from '../lib/ingestion/YamlIngestionService.js';
import { v4 as uuidv4 } from 'uuid';
import yaml from 'js-yaml';
import type { SerializedDiagramState } from '../types/graph.js';
import type { ScenarioNodeEntry, TaxLawNodeEntry, GraphLinkEntry, EvalNodeEntry } from '../types/graph.js';
import type { TaxRuleset } from '../../types/tax.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
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
ingestAll(db, DATA_ROOT);

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

app.post('/api/v1/graphs', (req, res) => {
  const { name, tax_config_id, diagram_json } = req.body as { name: string; tax_config_id: number; diagram_json: string };
  if (!name || !tax_config_id || !diagram_json) { res.status(400).json({ error: 'Missing fields' }); return; }
  const id = uuidv4();
  db.prepare(
    'INSERT INTO graph_configs (id, name, tax_config_id, diagram_json) VALUES (?, ?, ?, ?)',
  ).run(id, name, tax_config_id, diagram_json);
  const row = db.prepare('SELECT * FROM graph_configs WHERE id = ?').get(id);
  res.status(201).json(row);
});

app.put('/api/v1/graphs/:id', (req, res) => {
  const { name, diagram_json } = req.body as { name?: string; diagram_json?: string };
  const existing = db.prepare('SELECT id FROM graph_configs WHERE id = ?').get(req.params.id);
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  if (name) db.prepare('UPDATE graph_configs SET name = ?, updated_at = datetime(\'now\') WHERE id = ?').run(name, req.params.id);
  if (diagram_json) db.prepare('UPDATE graph_configs SET diagram_json = ?, updated_at = datetime(\'now\') WHERE id = ?').run(diagram_json, req.params.id);
  const row = db.prepare('SELECT * FROM graph_configs WHERE id = ?').get(req.params.id);
  res.json(row);
});

app.delete('/api/v1/graphs/:id', (req, res) => {
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

app.post('/api/v1/scenario-graphs', (req, res) => {
  const { name, tax_config_id, nodes } = req.body as {
    name: string;
    tax_config_id: number;
    nodes: ScenarioNodeEntry[];
  };
  if (!name || !tax_config_id || !nodes) { res.status(400).json({ error: 'Missing fields' }); return; }
  const id = uuidv4();
  const source_file = `${id}.yaml`;
  const nodes_json = JSON.stringify(nodes);

  db.prepare(
    'INSERT INTO scenario_graphs (id, name, tax_config_id, nodes_json, source_file) VALUES (?, ?, ?, ?, ?)',
  ).run(id, name, tax_config_id, nodes_json, source_file);

  const yamlContent = yaml.dump(
    { id, name, tax_config_id, version: 1, nodes },
    { lineWidth: -1 },
  );
  writeFileSync(join(SCENARIO_GRAPHS_DIR, source_file), yamlContent, 'utf8');

  const row = db.prepare('SELECT * FROM scenario_graphs WHERE id = ?').get(id);
  res.status(201).json(row);
});

app.put('/api/v1/scenario-graphs/:id', (req, res) => {
  const { name, nodes } = req.body as { name?: string; nodes?: ScenarioNodeEntry[] };
  const existing = db.prepare('SELECT * FROM scenario_graphs WHERE id = ?').get(req.params.id) as
    | { id: string; name: string; tax_config_id: number; nodes_json: string; version: number; source_file: string | null }
    | undefined;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

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

app.post('/api/v1/taxlaw-graphs', (req, res) => {
  const { name, tax_config_id, nodes, links } = req.body as {
    name: string;
    tax_config_id: number;
    nodes: TaxLawNodeEntry[];
    links: GraphLinkEntry[];
  };
  if (!name || !tax_config_id || !nodes || !links) { res.status(400).json({ error: 'Missing fields' }); return; }
  const id = uuidv4();
  const source_file = `${id}.yaml`;

  db.prepare(
    'INSERT INTO taxlaw_graphs (id, name, tax_config_id, nodes_json, links_json, source_file) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, name, tax_config_id, JSON.stringify(nodes), JSON.stringify(links), source_file);

  const yamlContent = yaml.dump(
    { id, name, tax_config_id, version: 1, nodes, links },
    { lineWidth: -1 },
  );
  writeFileSync(join(TAXLAW_GRAPHS_DIR, source_file), yamlContent, 'utf8');

  const row = db.prepare('SELECT * FROM taxlaw_graphs WHERE id = ?').get(id);
  res.status(201).json(row);
});

app.put('/api/v1/taxlaw-graphs/:id', (req, res) => {
  const { name, nodes, links } = req.body as {
    name?: string;
    nodes?: TaxLawNodeEntry[];
    links?: GraphLinkEntry[];
  };
  const existing = db.prepare('SELECT * FROM taxlaw_graphs WHERE id = ?').get(req.params.id) as
    | { id: string; name: string; tax_config_id: number; nodes_json: string; links_json: string; version: number; source_file: string | null }
    | undefined;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

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

// ---------------------------------------------------------------------------
// Tax Config Rules
// ---------------------------------------------------------------------------

app.post('/api/v1/tax-configs/:id/rules', (req, res) => {
  const taxConfigId = parseInt(req.params.id, 10);
  const { name, formula, description } = req.body as { name: string; formula: string; description?: string };
  if (!name || !formula) { res.status(400).json({ error: 'name and formula required' }); return; }

  const config = db.prepare('SELECT * FROM tax_configs WHERE id = ?').get(taxConfigId) as { id: number; source_file: string } | undefined;
  if (!config) { res.status(404).json({ error: 'Not found' }); return; }

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

app.post('/api/v1/admin/reingest', (_req, res) => {
  ingestAll(db, DATA_ROOT);
  res.json({ ok: true });
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  // Server started
});

export { app };
