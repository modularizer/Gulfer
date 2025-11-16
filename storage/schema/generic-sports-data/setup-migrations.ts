/**
 * Setup Database Migrations
 * 
 * Runs migrations to upgrade existing databases when schema changes.
 * Migrations are tracked per-database to ensure they're only run once.
 * 
 * Migrations are generated with correct dialect-specific SQL at build time,
 * not converted at runtime.
 * 
 * Usage:
 * ```ts
 * import { runMigrations } from '@/storage/schema/generic-sports-data/setup-migrations';
 * 
 * const db = await getDatabase();
 * await runMigrations(db);
 * ```
 */

import type { Database } from '../../../xp-deeby/adapters';
import { sql } from 'drizzle-orm';
import { getAdapter } from '../../../xp-deeby/adapters';
import migrations from './migrations';

/**
 * Run all pending migrations
 * Migrations are tracked per-database to ensure they're only run once
 */
const MIGRATIONS_TABLE = '__drizzle_migrations_generic_sports_data';

export async function runMigrations(db: Database): Promise<void> {
  // Get adapter to determine dialect
  const adapter = await getAdapter();
  const capabilities = adapter.getCapabilities();
  const dialect = capabilities.dialect === 'postgres' ? 'postgres' : 'sqlite';
  
  // Create migrations tracking table (module-specific)
  // Use dialect-appropriate syntax
  const idColumn = dialect === 'postgres' 
    ? 'id SERIAL PRIMARY KEY'
    : 'id INTEGER PRIMARY KEY AUTOINCREMENT';
  
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      ${idColumn},
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
        // Use pre-generated dialect-specific SQL (generated at build time, not converted at runtime)
        const migrationSQL = dialect === 'postgres' && migration.postgres
          ? migration.postgres
          : migration.sql;
        
        // Split migration SQL into individual statements
        // Replace statement-breakpoint comments with semicolons to help with splitting
        let normalizedSQL = migrationSQL.replace(/--> statement-breakpoint/gi, ';');
        
        // Make migration idempotent by adding IF NOT EXISTS to CREATE TABLE and CREATE INDEX
        // This allows migrations to be safely re-run if partially applied
        // Handle both SQLite backticks and PostgreSQL double quotes (preserve existing quote style)
        normalizedSQL = normalizedSQL.replace(/CREATE TABLE\s+(?!IF NOT EXISTS\s+)([`"]?)([^`"\s]+)\1/gi, (match, quote, name) => {
          return `CREATE TABLE IF NOT EXISTS ${quote}${name}${quote}`;
        });
        normalizedSQL = normalizedSQL.replace(/CREATE (UNIQUE )?INDEX\s+(?!IF NOT EXISTS\s+)([`"]?)([^`"\s]+)\2/gi, (match, unique, quote, name) => {
          return `CREATE ${unique || ''}INDEX IF NOT EXISTS ${quote}${name}${quote}`;
        });
        
        // Split by semicolon and filter
        const statements = normalizedSQL
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));
        
        // Execute each statement individually (PGlite prepared statements can only handle one at a time)
        for (const statement of statements) {
          if (statement) {
            await db.execute(sql.raw(statement + ';'));
          }
        }

        // Record that this migration was applied
        // Use seconds (Unix timestamp) instead of milliseconds for INTEGER compatibility
        const timestamp = Math.floor(Date.now() / 1000);
        await db.execute(
          sql.raw(`INSERT INTO ${MIGRATIONS_TABLE} (hash, created_at) VALUES ('${migration.hash}', ${timestamp})`)
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

