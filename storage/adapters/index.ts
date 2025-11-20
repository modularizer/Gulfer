// ============================================================================
// Schema Adapters (Database-agnostic helpers)
// ============================================================================
// These are database-agnostic schema building helpers
// They can be used regardless of which adapter driver is selected
// Use varchar when length is specified (works with both SQLite and PostgreSQL)
export {
    table, text, varchar, integer, real, timestamp, jsonb, unique, index, bool, 
    generateUUID, uuid, uuidDefault, uuidPK
} from '../../xp-deeby/xp-schema';

// ============================================================================
// Database Types and Interface
// ============================================================================
// Re-export types from xp-deeby/xp-schema
export type { XPDatabaseConnectionPlus as Database } from '../../xp-deeby/xp-schema';
export type { XPDatabaseConnectionPlus as DatabaseAdapter } from '../../xp-deeby/xp-schema';

// ============================================================================
// Connection Functions
// ============================================================================
export { connect, createOrRetrieveRegistryEntry, getRegistryEntries, getRegistryEntry } from '../../xp-deeby/xp-schema';

// ============================================================================
// Generic Adapter Functions
// ============================================================================
// These functions work with any adapter and can be imported before
// the adapter driver is selected

import type { XPDatabaseConnectionPlus as Database } from '../../xp-deeby/xp-schema';
import { connect, createOrRetrieveRegistryEntry, getRegistryEntry } from '../../xp-deeby/xp-schema';
import type { DbConnectionInfo } from '../../xp-deeby/xp-schema/xp-sql/drivers/types';

/**
 * Get or create a database by name using the registry
 * 
 * This function uses the xp-deeby registry system to get or create a database connection.
 * 
 * @param name - The logical name of the database (e.g., "gulfer-test")
 * @param adapterType - Optional adapter type ('pglite' | 'postgres' | 'sqlite-mobile')
 * @returns A database instance (XPDatabaseConnectionPlus)
 */
export async function getDatabaseByName(name: string, adapterType?: 'pglite' | 'postgres' | 'sqlite-mobile'): Promise<Database> {
  // Try to get existing registry entry
  let entry = await getRegistryEntry(name);
  
  // If not found, create a new entry based on adapter type or platform
  if (!entry) {
    // Determine driver and dialect based on adapterType or platform
    let driverName: 'pglite' | 'postgres' | 'sqlite-mobile' = 'pglite';
    let dialectName: 'pg' | 'sqlite' = 'pg';
    
    if (adapterType) {
      driverName = adapterType;
      dialectName = adapterType === 'postgres' || adapterType === 'pglite' ? 'pg' : 'sqlite';
    } else {
      // Auto-detect platform
      if (typeof window !== 'undefined') {
        // Web platform - use pglite
        driverName = 'pglite';
        dialectName = 'pg';
      } else {
        // Mobile/Node - use sqlite-mobile for mobile, pglite for node
        // For now, default to pglite
        driverName = 'pglite';
        dialectName = 'pg';
      }
    }
    
    const newEntry: DbConnectionInfo = {
      name,
      driverName,
      dialectName,
    };
    
    entry = await createOrRetrieveRegistryEntry(newEntry);
  }
  
  if (!entry) {
    throw new Error(`Failed to create or retrieve registry entry for database: ${name}`);
  }
  
  // Connect to the database
  return await connect(entry);
}

/**
 * Delete a database by name
 * 
 * This function deletes a database based on the platform.
 * For web, it deletes from IndexedDB. For mobile, it deletes the SQLite file.
 * 
 * @param name - The logical name of the database (e.g., "gulfer-test")
 *               For web, this is converted to "gulfer_db_{name}" for IndexedDB
 */
export async function deleteDatabaseByName(name: string): Promise<void> {
  // Detect platform
  const isWeb = typeof window !== 'undefined';
  const isMobile = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
  
  if (isWeb) {
    // For web, delete from IndexedDB
    // Convert logical name to IndexedDB name: "gulfer-test" -> "gulfer_db_gulfer-test"
    const indexedDB = window.indexedDB;
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
  } else if (isMobile) {
    // For mobile, delete the SQLite file
    const dbName = `${name}.db`;
    const SQLite = await import('expo-sqlite');
    await SQLite.deleteDatabaseAsync(dbName);
  } else {
    throw new Error(`Database deletion not supported for this platform`);
  }
}

/**
 * Get all table names in the database
 * 
 * This function requires a database connection to be passed in.
 * 
 * @param db - The database connection (XPDatabaseConnectionPlus)
 * @returns Array of table names (excluding system tables and migration tables)
 */
export async function getTableNames(db: Database): Promise<string[]> {
  return await db.getTableNames();
}