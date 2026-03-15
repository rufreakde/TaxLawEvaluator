import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

let db: Database.Database | null = null;

export function getDatabase(dbPath?: string): Database.Database {
  if (!db) {
    const resolvedPath = dbPath ?? join(process.cwd(), 'data/db/taxlaw.db');
    db = new Database(resolvedPath);
    applySchema(db);
  }
  return db;
}

export function createInMemoryDatabase(): Database.Database {
  const memDb = new Database(':memory:');
  applySchema(memDb);
  return memDb;
}

function applySchema(database: Database.Database): void {
  const schemaPath = join(process.cwd(), 'src/data/db/schema.sql');
  const schemaContent = readFileSync(schemaPath, 'utf-8');
  database.exec(schemaContent);
  runMigrations(database);
}

/**
 * Idempotent migrations that fix existing databases.
 * Each migration checks whether the change is needed before applying it.
 */
function runMigrations(database: Database.Database): void {
  // Migration 001: remove UNIQUE(tax_config_id, name) from tax_rules so that
  // duplicate rule names are allowed across the same tax config (id is the key).
  const row = database
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tax_rules'")
    .get() as { sql: string } | undefined;

  if (row?.sql.includes('UNIQUE (tax_config_id, name)')) {
    database.exec(`
      PRAGMA foreign_keys = OFF;
      CREATE TABLE tax_rules_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tax_config_id INTEGER NOT NULL REFERENCES tax_configs(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        formula TEXT NOT NULL,
        description TEXT,
        rule_order INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO tax_rules_new SELECT * FROM tax_rules;
      DROP TABLE tax_rules;
      ALTER TABLE tax_rules_new RENAME TO tax_rules;
      PRAGMA foreign_keys = ON;
    `);
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
