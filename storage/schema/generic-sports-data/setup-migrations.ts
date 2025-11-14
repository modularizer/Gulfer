/**
 * Setup Database Migrations
 * 
 * Runs migrations to upgrade existing databases when schema changes.
 * Migrations are tracked per-database to ensure they're only run once.
 * 
 * Usage:
 * ```ts
 * import { runMigrations } from '@/storage/schema/generic-sports-data/setup-migrations';
 * 
 * const db = await getDatabase();
 * await runMigrations(db);
 * ```
 */

import type { Database } from '../../adapters';
import { sql } from 'drizzle-orm';
import migrations from './migrations';

/**
 * Run all pending migrations
 * Migrations are tracked per-database to ensure they're only run once
 */
const MIGRATIONS_TABLE = '__drizzle_migrations_generic_sports_data';

export async function runMigrations(db: Database): Promise<void> {
  // Create migrations tracking table (module-specific)
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL UNIQUE,
      created_at INTEGER
    )
  `));

  // Get list of applied migrations
  const appliedMigrations = await getAppliedMigrations(db);

  // Run all migrations in order
  for (const migration of migrations) {
    if (!appliedMigrations.has(migration.hash)) {
      try {
        // Execute migration SQL
        await db.execute(sql.raw(migration.sql));

        // Record that this migration was applied
        await db.execute(
          sql.raw(`INSERT INTO ${MIGRATIONS_TABLE} (hash, created_at) VALUES ('${migration.hash}', ${Date.now()})`)
        );

        console.log(`✅ Applied migration: ${migration.name}`);
      } catch (error) {
        console.error(`❌ Error applying migration ${migration.name}:`, error);
        throw error;
      }
    }
  }
}

/**
 * Get set of applied migration hashes
 */
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

