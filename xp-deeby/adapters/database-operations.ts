/**
 * Generic Database Operations
 * 
 * These functions work with any adapter and can be imported before
 * the adapter driver is selected. They delegate to the appropriate adapter.
 */

import type { Database } from './types';
import { getAdapter, getAdapterByType, PlatformName } from './factory';
import { getRegistryEntries, removeFromRegistry } from './registry-storage';

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
 * This function:
 * 1. Looks up the database in the registry to find its adapter type
 * 2. Uses the appropriate adapter to delete the database
 * 3. Removes the database from the registry
 * 
 * @param name - The logical name of the database (e.g., "gulfer-test")
 */
export async function deleteDatabaseByName(name: string): Promise<void> {
  // Look up the database in the registry to get its adapter type
  const registry = await getRegistryEntries();
  const entry = registry.find(e => e.name === name);
  
  if (!entry) {
    throw new Error(`Database ${name} not found in registry`);
  }
  
  // Get the adapter that was used to create this database
  const adapter = await getAdapterByType(entry.adapterType);
  const capabilities = adapter.getCapabilities();
  
  // Delete the database using platform-specific logic
  if (capabilities.platform === PlatformName.WEB) {
    // For web (PGlite), delete from IndexedDB
    // PGlite uses idb:// protocol which creates IndexedDB databases with /pglite/ prefix
    const indexedDB = typeof window !== 'undefined' ? window.indexedDB : null;
    if (indexedDB) {
      // PGlite stores databases as idb://{name}, which creates IndexedDB DBs at /pglite/{name}
      const indexedDbName = `/pglite/${name}`;
      await new Promise<void>((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase(indexedDbName);
        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(deleteRequest.error);
        deleteRequest.onblocked = () => {
          // Database is blocked, wait a bit and try again
          setTimeout(() => {
            const retryRequest = indexedDB.deleteDatabase(indexedDbName);
            retryRequest.onsuccess = () => resolve();
            retryRequest.onerror = () => reject(retryRequest.error);
          }, 100);
        };
      });
    }
  } else if (capabilities.platform === PlatformName.MOBILE) {
    // For mobile, delete the SQLite file
    const dbName = `${name}.db`;
    const SQLite = await import('expo-sqlite');
    await SQLite.deleteDatabaseAsync(dbName);
  } else {
    throw new Error(`Database deletion not supported for platform: ${capabilities.platform}`);
  }
  
  // Remove from registry after successful deletion
  await removeFromRegistry(name);
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

