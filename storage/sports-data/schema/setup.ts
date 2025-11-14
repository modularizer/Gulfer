/**
 * Database Setup Utility
 * 
 * Automatically creates all database tables at runtime for each client's local database.
 * Reads migration SQL files and executes them in order.
 * 
 * Usage:
 * ```ts
 * import { getDatabase } from '@services/storage/db';
 * import { setupDatabase } from '@/sports-storage/schema/setup';
 * 
 * const db = await getDatabase();
 * await setupDatabase(db);
 * ```
 * 
 * This automatically runs all migrations from storage/sports-data/migrations/
 * No manual steps required - just run `npm run db:generate` when schema changes.
 */

import type { Database } from '../../adapters';
import { sql } from 'drizzle-orm';

// Import all migration SQL files
// These are generated automatically by drizzle-kit
import migrations from './migrations/index';

/**
 * Setup the database by running all migrations
 * This is idempotent and safe to call multiple times
 */
export async function setupDatabase(db: Database): Promise<void> {
  // Create migrations tracking table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL UNIQUE,
      created_at INTEGER
    )
  `);
  
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
          sql`INSERT INTO __drizzle_migrations (hash, created_at) VALUES (${migration.hash}, ${Date.now()})`
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
      sql`SELECT hash FROM __drizzle_migrations`
    ) as any[];
    
    return new Set(result.map((row: any) => row.hash));
  } catch (error) {
    return new Set();
  }
}

/**
 * Get all table names in the database
 */
export async function getTableNames(db: Database): Promise<string[]> {
  try {
    const result = await db.execute(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__%'`
    ) as any[];
    return result.map((row: any) => row.name);
  } catch (error) {
    console.error('Error getting table names:', error);
    return [];
  }
}
