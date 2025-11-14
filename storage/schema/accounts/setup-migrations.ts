/**
 * Setup Accounts Database Migrations
 * 
 * Runs migrations to upgrade existing accounts databases when schema changes.
 */

import type { Database } from '../../adapters';
import { sql } from 'drizzle-orm';
import migrations from './migrations';

const MIGRATIONS_TABLE = '__drizzle_migrations_accounts';

export async function runMigrations(db: Database): Promise<void> {
  // Create migrations tracking table (module-specific)
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL UNIQUE,
      created_at INTEGER
    )
  `));

  const appliedMigrations = await getAppliedMigrations(db);

  for (const migration of migrations) {
    if (!appliedMigrations.has(migration.hash)) {
      try {
        await db.execute(sql.raw(migration.sql));
        await db.execute(
          sql.raw(`INSERT INTO ${MIGRATIONS_TABLE} (hash, created_at) VALUES ('${migration.hash}', ${Date.now()})`)
        );
        console.log(`✅ Applied accounts migration: ${migration.name}`);
      } catch (error) {
        console.error(`❌ Error applying accounts migration ${migration.name}:`, error);
        throw error;
      }
    }
  }
}

async function getAppliedMigrations(db: Database): Promise<Set<string>> {
  try {
    const result = await db.execute(
      sql.raw(`SELECT hash FROM ${MIGRATIONS_TABLE}`)
    ) as any[];
    return new Set(result.map((row: any) => row.hash));
  } catch (error) {
    return new Set();
  }
}

