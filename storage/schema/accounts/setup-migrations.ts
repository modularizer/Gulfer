/**
 * Setup Accounts Database Migrations
 * 
 * Runs migrations to upgrade existing accounts databases when schema changes.
 * Migrations are generated with correct dialect-specific SQL at build time,
 * not converted at runtime.
 */

import type { Database } from '../../../xp-deeby/adapters';
import { runMigrations as runMigrationsGeneric } from '../../../xp-deeby/utils';
import migrations from './migrations';

const MIGRATIONS_TABLE = '__drizzle_migrations_accounts';

/**
 * Run all pending migrations for accounts
 * Migrations are tracked per-database to ensure they're only run once
 */
export async function runMigrations(db: Database): Promise<void> {
  await runMigrationsGeneric(db, {
    migrationsTableName: MIGRATIONS_TABLE,
    migrations,
    onMigrationApplied: (migration) => {
      console.log(`✅ Applied accounts migration: ${migration.name}`);
    },
  });
}

