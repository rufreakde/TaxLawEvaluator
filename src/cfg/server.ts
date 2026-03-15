import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDatabase } from '../lib/db/DatabaseService.js';
import { ingestAll } from '../lib/ingestion/YamlIngestionService.js';
import { v4 as uuidv4 } from 'uuid';
import type { SerializedDiagramState } from '../types/graph.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

const DATA_ROOT = join(__dirname, '../../data');
const db = getDatabase();
ingestAll(db, DATA_ROOT);

// Scenarios
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

// Economy
app.get('/api/v1/economy', (_req, res) => {
  const rows = db.prepare('SELECT * FROM economy_metrics').all();
  res.json(rows);
});

// Tax Configs
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

// Graphs
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

app.post('/api/v1/admin/reingest', (_req, res) => {
  ingestAll(db, DATA_ROOT);
  res.json({ ok: true });
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  // Server started
});

export { app };
