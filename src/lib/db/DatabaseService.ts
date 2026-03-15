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
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
