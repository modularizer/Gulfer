/**
 * Setup Database Using CREATE Scripts and Migrations
 * 
 * 1. First runs CREATE IF NOT EXISTS scripts (for new databases)
 * 2. Then runs migrations (for schema upgrades on existing databases)
 * 
 * Usage:
 * ```ts
 * import { setupDatabase } from '@/storage/schema/generic-sports-data/setup';
 * 
 * const db = await getDatabase();
 * await setupDatabase(db);
 * ```
 */

import type { Database } from '../../adapters';
import { sql } from 'drizzle-orm';
import { getAdapter } from '../../adapters';
import { createScripts } from './create-scripts';
import { runMigrations } from './setup-migrations';

/**
 * Get the appropriate CREATE script for the current database dialect
 */
async function getCreateScript(db: Database): Promise<string> {
  // Get the current adapter to determine dialect
  const adapter = await getAdapter();
  const capabilities = adapter.getCapabilities();
  const dialect = capabilities.databaseType;
  
  // Map database type to script dialect
  if (dialect === 'postgres' && createScripts.postgres) {
    return createScripts.postgres.sql;
  }
  
  // Default to SQLite (works for sqlite-opfs, sqlite-mobile, and as fallback)
  return createScripts.sqlite.sql;
}

/**
 * Setup the database by running CREATE scripts and migrations
 * 
 * 1. Runs CREATE IF NOT EXISTS scripts (for initial setup)
 * 2. Runs migrations (for schema upgrades)
 * 
 * This is safe to call multiple times - CREATE scripts are idempotent,
 * and migrations are tracked per-database.
 */
export async function setupDatabase(db: Database): Promise<void> {
  // Step 1: Run CREATE scripts (for new databases or missing tables)
  const createSQL = await getCreateScript(db);
  
  if (createSQL.includes('-- Run npm run db:generate')) {
    throw new Error(
      'CREATE scripts have not been generated. Run `npm run db:generate` first.'
    );
  }
  
  const statements = createSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  try {
    for (const statement of statements) {
      if (statement) {
        await db.execute(sql.raw(statement + ';'));
      }
    }
    console.log('✅ Database schema created/verified');
  } catch (error) {
    console.error('❌ Error creating database schema:', error);
    const failedStatement = statements.find(s => s.length > 0);
    if (failedStatement) {
      console.error('Failed statement (first 200 chars):', failedStatement.substring(0, 200));
    }
    throw error;
  }
  
  // Step 2: Run migrations (for schema upgrades)
  await runMigrations(db);
}

