// ============================================================================
// Schema Adapters (SQLite-specific helpers)
// ============================================================================
// These are SQLite-specific schema building helpers
// They can be used regardless of which adapter driver is selected
// Use varchar when length is specified (works with both SQLite and PostgreSQL)
export {
    table, text, varchar, integer, real, timestamp, jsonb, unique, index, bool, uuid, uuidPK, uuidDefault
} from './sqlite';

// ============================================================================
// Adapter Types and Interface
// ============================================================================
export type { Database, DatabaseAdapter, Adapter, AdapterCapabilities } from './types';

// ============================================================================
// Adapter Factory
// ============================================================================
export { getAdapter, setAdapter, createAdapter, createAdapterByType, getAdapterByType, type AdapterType } from './factory';

// ============================================================================
// Adapter Implementations
// ============================================================================
// Note: Adapter classes are NOT exported directly to avoid loading
// unnecessary dependencies. Use the factory functions instead:
// - getAdapter() - auto-selects based on platform
// - getAdapterByType(type) - explicitly select adapter type
// - createAdapterByType(type) - create adapter without setting as current
//
// If you need direct access to adapter classes, import them explicitly:
// import { PgliteAdapter } from './adapters/pglite';

// ============================================================================
// Database Listing Functions
// ============================================================================
export { listDatabases, listDatabasesWeb, registerDatabaseName, getDatabaseRegistryEntries, type DatabaseRegistryEntry } from './list-databases';

// ============================================================================
// Database Metadata Functions
// ============================================================================
export { getDatabaseMetadata, type DatabaseMetadata } from './database-metadata';

// ============================================================================
// Generic Adapter Functions
// ============================================================================
// These functions work with any adapter and can be imported before
// the adapter driver is selected

import type { Database } from './types';
import { getAdapter } from './factory';

/**
 * Get or create a database by name
 * 
 * This is a generic function that works with any adapter.
 * The adapter is automatically selected based on platform, or can be set explicitly.
 * 
 * @param name - The logical name of the database (e.g., "gulfer-test")
 *               For web, this is converted to "gulfer_db_{name}" for IndexedDB
 * @returns A database instance
 */
export async function getDatabaseByName(name: string): Promise<Database> {
  const adapter = await getAdapter();
  
  if (!adapter.getDatabaseByName) {
    throw new Error(`Adapter does not support named databases: ${adapter.getCapabilities().databaseType}`);
  }
  
  return await adapter.getDatabaseByName(name);
}

/**
 * Delete a database by name
 * 
 * This is a generic function that works with any adapter.
 * For web adapters, this deletes the IndexedDB database.
 * 
 * @param name - The logical name of the database (e.g., "gulfer-test")
 *               For web, this is converted to "gulfer_db_{name}" for IndexedDB
 */
export async function deleteDatabaseByName(name: string): Promise<void> {
  const adapter = await getAdapter();
  const capabilities = adapter.getCapabilities();
  
  if (capabilities.platform === 'web') {
    // For web, delete from IndexedDB
    // Convert logical name to IndexedDB name: "gulfer-test" -> "gulfer_db_gulfer-test"
    const indexedDB = typeof window !== 'undefined' ? window.indexedDB : null;
    if (indexedDB) {
      return new Promise<void>((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase(`gulfer_db_${name}`);
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(deleteRequest.error);
        deleteRequest.onblocked = () => {
          // Database is blocked, wait a bit and try again
          setTimeout(() => {
            const retryRequest = indexedDB.deleteDatabase(`gulfer_db_${name}`);
            retryRequest.onsuccess = () => resolve();
            retryRequest.onerror = () => reject(retryRequest.error);
          }, 100);
        };
      });
    }
  } else if (capabilities.platform === 'mobile') {
    // For mobile, delete the SQLite file
    const { SqliteMobileAdapter } = await import('./sqlite-mobile');
    if (adapter instanceof SqliteMobileAdapter) {
      const dbName = `${name}.db`;
      const SQLite = await import('expo-sqlite');
      await SQLite.deleteDatabaseAsync(dbName);
    }
  } else {
    throw new Error(`Database deletion not supported for platform: ${capabilities.platform}`);
  }
}

/**
 * Get all table names in the database
 * 
 * This is a generic function that works with any adapter that supports it.
 * 
 * @param db - The database instance
 * @returns Array of table names (excluding system tables and migration tables)
 */
export async function getTableNames(db: Database): Promise<string[]> {
  const adapter = await getAdapter();
  
  if (!adapter.getTableNames) {
    throw new Error(`Adapter does not support getTableNames: ${adapter.getCapabilities().databaseType}`);
  }
  
  return await adapter.getTableNames(db);
}