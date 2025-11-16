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
import { runMigrations as runMigrationsGeneric } from '../../../xp-deeby/utils';
import migrations from './migrations';

/**
 * Run all pending migrations for generic-sports-data
 * Migrations are tracked per-database to ensure they're only run once
 */
const MIGRATIONS_TABLE = '__drizzle_migrations_generic_sports_data';

export async function runMigrations(db: Database): Promise<void> {
  await runMigrationsGeneric(db, {
    migrationsTableName: MIGRATIONS_TABLE,
    migrations,
  });
}

