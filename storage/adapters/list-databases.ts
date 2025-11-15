/**
 * List Available Databases
 * 
 * Platform-specific functions to list available databases.
 */

/**
 * Check if a database is empty (has no tables or data)
 */
async function isDatabaseEmpty(name: string): Promise<boolean> {
  try {
    const { getDatabaseMetadata } = await import('./database-metadata');
    const metadata = await getDatabaseMetadata(name);
    return metadata.tableCount === 0 && metadata.totalRowCount === 0;
  } catch {
    // If we can't check, don't assume empty - might be in use
    return false;
  }
}

/**
 * Extract logical database name from IndexedDB database name
 * e.g., "gulfer_db_gulfer-test" -> "gulfer-test"
 */
function extractLogicalName(indexedDbName: string): string {
  if (indexedDbName.startsWith('gulfer_db_')) {
    return indexedDbName.substring('gulfer_db_'.length);
  }
  return indexedDbName;
}

/**
 * Get IndexedDB database name from logical name
 * 
 * Different adapters use different IndexedDB naming:
 * - SQLite: "gulfer_db_{logicalName}"
 * - PGLite: "/pglite/{logicalName}" (PGLite uses idb:// protocol)
 * 
 * @param logicalName - Logical database name (e.g., "gulfer-test")
 * @param adapterType - Optional adapter type to determine naming scheme
 * @returns IndexedDB database name
 */
function getIndexedDbName(logicalName: string, adapterType?: string): string {
  // PGLite uses idb:// protocol which creates IndexedDB databases with /pglite/ prefix
  if (adapterType === 'pglite' || adapterType === 'postgres') {
    return `/pglite/${logicalName}`;
  }
  // Default to SQLite naming
  return `gulfer_db_${logicalName}`;
}

/**
 * List all available database names for web (IndexedDB)
 * Filters out empty databases.
 * 
 * Note: IndexedDB doesn't have a direct API to list all databases.
 * This function attempts to detect databases by trying to open them.
 * We maintain a registry in IndexedDB itself to track known databases.
 * The registry stores logical names (e.g., "gulfer-test"), not full IndexedDB names.
 */
export async function listDatabasesWeb(): Promise<string[]> {
  const indexedDB = typeof window !== 'undefined' ? window.indexedDB : null;
  if (!indexedDB) {
    return [];
  }

  // Get registry of known databases with their adapter types
  const knownDatabases = await getDatabaseRegistryEntries();
  
  // Verify each known database exists using its stored adapter type
  const existingDatabases: string[] = [];
  for (const entry of knownDatabases) {
    try {
      // Use the exact adapter type that was used to create the database
      const { getAdapterByType } = await import('./factory');
      const adapter = await getAdapterByType(entry.adapterType);
      if (!adapter.getDatabaseByName) {
        console.warn(`[listDatabasesWeb] Adapter ${entry.adapterType} does not support getDatabaseByName`);
        await removeFromRegistry(entry.name);
        continue;
      }
      const db = await adapter.getDatabaseByName(entry.name);
      if (db) {
        existingDatabases.push(entry.name);
        console.log(`[listDatabasesWeb] Found database ${entry.name} using ${entry.adapterType} adapter`);
      } else {
        console.warn(`[listDatabasesWeb] Database ${entry.name} returned null from ${entry.adapterType} adapter`);
        await removeFromRegistry(entry.name);
      }
    } catch (error) {
      // Database doesn't exist or can't be opened with its stored adapter type
      console.warn(`[listDatabasesWeb] Database ${entry.name} (${entry.adapterType}) no longer exists, removing from registry:`, error);
      await removeFromRegistry(entry.name);
    }
  }

  // Return all existing databases (don't filter empty ones - let user see them)
  return existingDatabases;
}

/**
 * Database registry entry - stores both name and adapter type
 */
export interface DatabaseRegistryEntry {
  name: string;
  adapterType: 'pglite' | 'sqlite-web' | 'sqlite-mobile' | 'postgres';
}

/**
 * Get database registry from IndexedDB
 * Returns array of database names (for backward compatibility)
 */
async function getDatabaseRegistry(): Promise<string[]> {
  const entries = await getDatabaseRegistryEntries();
  return entries.map(e => e.name);
}

/**
 * Get database registry entries with adapter types
 */
export async function getDatabaseRegistryEntries(): Promise<DatabaseRegistryEntry[]> {
  const indexedDB = typeof window !== 'undefined' ? window.indexedDB : null;
  if (!indexedDB) {
    return [];
  }

  try {
    return await new Promise<DatabaseRegistryEntry[]>((resolve, reject) => {
      const request = indexedDB.open('gulfer_registry', 2);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;
        if (!db.objectStoreNames.contains('databases')) {
          db.createObjectStore('databases');
        }
        // Migrate old format (array of strings) to new format (array of objects)
        if (oldVersion < 2) {
          const transaction = (event.target as IDBOpenDBRequest).transaction!;
          const store = transaction.objectStore('databases');
          const getRequest = store.get('list');
          getRequest.onsuccess = () => {
            const oldList = getRequest.result;
            if (Array.isArray(oldList) && oldList.length > 0 && typeof oldList[0] === 'string') {
              // Migrate: convert string array to entry array
              const migrated: DatabaseRegistryEntry[] = (oldList as string[]).map(name => ({
                name,
                adapterType: 'pglite' // Default to pglite for existing entries
              }));
              store.put(migrated, 'list');
            }
          };
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('databases')) {
          resolve([]);
          return;
        }
        const transaction = db.transaction(['databases'], 'readonly');
        const store = transaction.objectStore('databases');
        const getRequest = store.get('list');
        getRequest.onsuccess = () => {
          const result = getRequest.result;
          if (!result) {
            resolve([]);
            return;
          }
          // Handle both old format (string[]) and new format (DatabaseRegistryEntry[])
          if (Array.isArray(result)) {
            if (result.length > 0 && typeof result[0] === 'string') {
              // Old format - migrate on the fly
              resolve((result as string[]).map(name => ({
                name,
                adapterType: 'pglite' as const
              })));
            } else {
              // New format
              resolve(result as DatabaseRegistryEntry[]);
            }
          } else {
            resolve([]);
          }
        };
        getRequest.onerror = () => resolve([]);
      };
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Add database to registry in IndexedDB with adapter type
 */
async function addToRegistry(name: string, adapterType: 'pglite' | 'sqlite-web' | 'sqlite-mobile' | 'postgres' = 'pglite'): Promise<void> {
  const indexedDB = typeof window !== 'undefined' ? window.indexedDB : null;
  if (!indexedDB) {
    console.warn('[registry] IndexedDB not available, cannot register database');
    return;
  }

  try {
    const current = await getDatabaseRegistryEntries();
    console.log(`[registry] Current registry:`, current);
    
    const existing = current.find(e => e.name === name);
    if (!existing || existing.adapterType !== adapterType) {
      // Remove old entry if name exists but adapter type is different
      const filtered = current.filter(e => e.name !== name);
      const updated: DatabaseRegistryEntry[] = [...filtered, { name, adapterType }];
      console.log(`[registry] Adding ${name} (${adapterType}) to registry. Updated list:`, updated);
      
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('gulfer_registry', 2);
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('databases')) {
            db.createObjectStore('databases');
            console.log('[registry] Created databases object store');
          }
        };
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('databases')) {
            reject(new Error('databases object store does not exist'));
            return;
          }
          const transaction = db.transaction(['databases'], 'readwrite');
          const store = transaction.objectStore('databases');
          const putRequest = store.put(updated, 'list');
          putRequest.onsuccess = () => {
            console.log(`[registry] ✅ Successfully registered ${name} in registry`);
            resolve();
          };
          putRequest.onerror = () => {
            console.error('[registry] ❌ Error putting to store:', putRequest.error);
            reject(putRequest.error);
          };
          transaction.oncomplete = () => {
            // Already resolved in putRequest.onsuccess
          };
          transaction.onerror = () => {
            console.error('[registry] ❌ Transaction error:', transaction.error);
            reject(transaction.error);
          };
        };
        request.onerror = () => {
          console.error('[registry] ❌ Error opening registry:', request.error);
          reject(request.error);
        };
      });
      
      // Verify it was added
      const verify = await getDatabaseRegistryEntries();
      const verified = verify.find(e => e.name === name && e.adapterType === adapterType);
      if (!verified) {
        throw new Error(`Failed to verify registration: ${name} (${adapterType}) not found in registry after adding`);
      }
      console.log(`[registry] ✅ Verified ${name} (${adapterType}) is in registry`);
    } else {
      console.log(`[registry] ${name} (${adapterType}) already in registry, skipping`);
    }
  } catch (err) {
    console.error('[registry] ❌ Could not update database registry:', err);
    throw err; // Re-throw so caller knows it failed
  }
}

/**
 * Remove database from registry in IndexedDB
 */
async function removeFromRegistry(name: string): Promise<void> {
  const indexedDB = typeof window !== 'undefined' ? window.indexedDB : null;
  if (!indexedDB) {
    return;
  }

  try {
    const current = await getDatabaseRegistryEntries();
    const updated = current.filter(e => e.name !== name);
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('gulfer_registry', 2);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('databases')) {
          db.createObjectStore('databases');
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['databases'], 'readwrite');
        const store = transaction.objectStore('databases');
        store.put(updated, 'list');
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Could not update database registry:', err);
  }
}

/**
 * Register a database name (store in IndexedDB registry)
 * 
 * @param name - Logical database name (e.g., "gulfer-test")
 * @param adapterType - Adapter type used to create the database
 */
export async function registerDatabaseName(name: string, adapterType: 'pglite' | 'sqlite-web' | 'sqlite-mobile' | 'postgres' = 'pglite'): Promise<void> {
  // Store the logical name with adapter type
  await addToRegistry(name, adapterType);
}

/**
 * List all available database names
 * Platform-aware wrapper
 */
export async function listDatabases(platform: 'web' | 'mobile' | 'node'): Promise<string[]> {
  if (platform === 'web') {
    return await listDatabasesWeb();
  }
  // For mobile/node, we'd need platform-specific implementations
  return [];
}

