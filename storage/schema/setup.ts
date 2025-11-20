/**
 * Database Schema Setup
 * 
 * Provides functions to set up database schema using:
 * 1. Re-runnable CREATE scripts (for initial setup)
 * 2. Migrations (for schema upgrades)
 * 
 * The CREATE scripts are idempotent (CREATE IF NOT EXISTS) and work across all database dialects.
 * Migrations are tracked per-database to ensure they're only run once.
 * 
 * Usage:
 * ```ts
 * import { setupSchemaByName } from '@/storage/schema/setup';
 * 
 * const db = await setupSchemaByName('my-database');
 * // Database is ready with all tables created and migrations applied
 * ```
 */

import type {XPDatabaseConnectionPlus as Database} from '../../xp-deeby/xp-schema';
import { getDatabaseByName } from '../../storage/adapters';
import { setupDatabase } from './generic-sports-data/setup';
import { setupDatabase as setupAccountsDatabase } from './accounts/setup';

/**
 * Set up database schema by name
 * 
 * This function:
 * 1. Opens or creates a database with the given name
 * 2. Runs re-runnable CREATE IF NOT EXISTS scripts to create tables (for initial setup)
 * 3. Runs migrations to apply any schema changes (for upgrades)
 * 
 * The CREATE scripts are:
 * - Idempotent (safe to run multiple times)
 * - Dialect-aware (automatically selects SQLite or PostgreSQL)
 * 
 * Migrations are:
 * - Tracked per-database (only run once per database)
 * - Applied in order
 * - Module-specific (generic-sports-data and accounts tracked separately)
 * 
 * @param name - The name of the database (without .db extension)
 * @param adapterType - Optional adapter type ('pglite' | 'postgres' | 'sqlite-mobile'). If not provided, auto-selects based on platform
 * @returns The database instance with all tables created and migrations applied
 * 
 * @example
 * ```ts
 * // Auto-select adapter
 * const db = await setupSchemaByName('my-app');
 * 
 * // Explicitly specify adapter
 * const db = await setupSchemaByName('my-app', 'pglite');
 * ```
 */
export async function setupSchemaByName(
  name: string,
  adapterType?: 'pglite' | 'postgres' | 'sqlite-mobile'
): Promise<Database> {

  // Step 1: Get or create database by name
  const db = await getDatabaseByName(name, adapterType);
  
  // Step 2: Run CREATE scripts and migrations from both modules
  // Run generic-sports-data first (accounts may depend on participants)
  // This runs both CREATE scripts and migrations
  await setupDatabase(db);
  
  // Run accounts CREATE scripts and migrations
  await setupAccountsDatabase(db);
  
  // Note: Auto-save is handled automatically by the adapter
  // No need to call save() explicitly
  
  return db;
}

