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

import type { Database } from '../../../xp-deeby/adapters';
import { sql } from 'drizzle-orm';
import { getAdapter } from '../../../xp-deeby/adapters';
import { createScripts } from './create-scripts';
import { runMigrations } from './setup-migrations';

/**
 * Get the appropriate CREATE script for the current database dialect
 */
async function getCreateScript(db: Database): Promise<string> {
  // Get the current adapter to determine dialect
  const adapter = await getAdapter();
  const capabilities = adapter.getCapabilities();
  const dialect = capabilities.dialect === 'postgres' ? 'postgres' : 'sqlite';
  
  // Map database type to script dialect
  if (dialect === 'postgres' && createScripts.postgres) {
    return createScripts.postgres.sql;
  }
  
  // Default to SQLite (works for pglite, sqlite-mobile, and as fallback)
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
  
  // Get dialect for PostgreSQL-specific handling
  const adapter = await getAdapter();
  const capabilities = adapter.getCapabilities();
  const dialect = capabilities.dialect === 'postgres' ? 'postgres' : 'sqlite';
  
  if (createSQL.includes('-- Run npm run db:generate')) {
    throw new Error(
      'CREATE scripts have not been generated. Run `npm run db:generate` first.'
    );
  }
  
  // Split statements more carefully - handle cases where multiple statements are on one line
  // First, replace statement-breakpoint comments with semicolons to help with splitting
  let normalizedSQL = createSQL.replace(/--> statement-breakpoint/gi, ';');
  
  // Split by semicolon and filter
  let statements = normalizedSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
  
  // For PostgreSQL, we need to ensure tables are created in dependency order
  // Extract CREATE TABLE statements and reorder them
  if (dialect === 'postgres') {
    const createTableStatements: string[] = [];
    const otherStatements: string[] = [];
    
    // Dependency order (tables without foreign keys first)
    const tableOrder = [
      'sports',
      'score_formats',
      'event_formats',
      'event_format_stages',
      'venues',
      'venue_event_formats',
      'venue_event_format_stages',
      'participants',
      'team_members',
      'events',
      'event_participants',
      'event_stages',
      'participant_event_stage_scores',
      'named_scores',
      'photos',
      'merge_entries',
    ];
    
    // Separate CREATE TABLE from other statements
    for (const statement of statements) {
      if (statement.match(/^CREATE TABLE/i)) {
        createTableStatements.push(statement);
      } else {
        otherStatements.push(statement);
      }
    }
    
    // Reorder CREATE TABLE statements by dependency
    const orderedCreateTables: string[] = [];
    for (const tableName of tableOrder) {
      const tableStatement = createTableStatements.find(s => 
        s.match(new RegExp(`CREATE TABLE[^"]*"${tableName}"`, 'i'))
      );
      if (tableStatement) {
        orderedCreateTables.push(tableStatement);
      }
    }
    
    // Add any remaining CREATE TABLE statements that weren't in our order list
    for (const statement of createTableStatements) {
      if (!orderedCreateTables.includes(statement)) {
        orderedCreateTables.push(statement);
      }
    }
    
    // Combine: CREATE TABLE statements first (in order), then other statements
    statements = [...orderedCreateTables, ...otherStatements];
  }
  
  try {
    console.log(`[setupDatabase] Executing ${statements.length} CREATE statements...`);
    let executedCount = 0;
    for (const statement of statements) {
      if (statement) {
        const statementPreview = statement.substring(0, 100).replace(/\s+/g, ' ');
        console.log(`[setupDatabase] Executing statement ${executedCount + 1}/${statements.length}: ${statementPreview}...`);
        await db.execute(sql.raw(statement + ';'));
        executedCount++;
      }
    }
    console.log(`[setupDatabase] ✅ Executed ${executedCount} CREATE statements`);
    
    // Verify tables were created
    console.log('[setupDatabase] Verifying tables were created...');
    const adapter = await getAdapter();
    if (adapter.getTableNames) {
      const tableNames = await adapter.getTableNames();
      console.log(`[setupDatabase] Found ${tableNames.length} tables after CREATE:`, tableNames);
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
  
  // Step 2: Run migrations (for schema upgrades on existing databases)
  // CREATE scripts handle initial setup, migrations handle schema changes
  await runMigrations(db);
}


