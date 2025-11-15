/**
 * Setup Accounts Database Using CREATE Scripts and Migrations
 * 
 * 1. Runs CREATE IF NOT EXISTS scripts (for new databases)
 * 2. Runs migrations (for schema upgrades)
 */

import type { Database } from '../../../xp-deeby/adapters';
import { sql } from 'drizzle-orm';
import { getAdapter } from '../../../xp-deeby/adapters';
import { createScripts } from './create-scripts';
import { runMigrations } from './setup-migrations';

async function getCreateScript(db: Database): Promise<string> {
  const adapter = await getAdapter();
  const capabilities = adapter.getCapabilities();
  const dialect = capabilities.databaseType;
  
  if (dialect === 'postgres' && createScripts.postgres) {
    return createScripts.postgres.sql;
  }
  
  return createScripts.sqlite.sql;
}

export async function setupDatabase(db: Database): Promise<void> {
  // Step 1: Run CREATE scripts
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
    console.log('✅ Accounts schema created/verified');
  } catch (error) {
    console.error('❌ Error creating accounts schema:', error);
    throw error;
  }
  
  // Step 2: Run migrations (for schema upgrades on existing databases)
  // CREATE scripts handle initial setup, migrations handle schema changes
  await runMigrations(db);
}

