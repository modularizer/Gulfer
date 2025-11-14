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
 * e.g., "gulfer-test" -> "gulfer_db_gulfer-test"
 */
function getIndexedDbName(logicalName: string): string {
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

  // Get registry of known databases from IndexedDB (stores logical names)
  const knownDatabases = await getDatabaseRegistry();
  
  // Try to open each known database to verify it exists
  const existingDatabases: string[] = [];
  for (const logicalName of knownDatabases) {
    try {
      const indexedDbName = getIndexedDbName(logicalName);
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(indexedDbName, 1);
        request.onsuccess = () => {
          request.result.close();
          resolve();
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () => resolve(); // Database exists but is blocked
      });
      existingDatabases.push(logicalName);
    } catch {
      // Database doesn't exist, remove from registry
      await removeFromRegistry(logicalName);
    }
  }

  // Return all existing databases (don't filter empty ones - let user see them)
  return existingDatabases;
}

/**
 * Get database registry from IndexedDB
 */
async function getDatabaseRegistry(): Promise<string[]> {
  const indexedDB = typeof window !== 'undefined' ? window.indexedDB : null;
  if (!indexedDB) {
    return [];
  }

  try {
    return await new Promise<string[]>((resolve, reject) => {
      const request = indexedDB.open('gulfer_registry', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('databases')) {
          db.createObjectStore('databases');
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
          resolve(result ? (result as string[]) : []);
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
 * Add database to registry in IndexedDB
 */
async function addToRegistry(name: string): Promise<void> {
  const indexedDB = typeof window !== 'undefined' ? window.indexedDB : null;
  if (!indexedDB) {
    return;
  }

  try {
    const current = await getDatabaseRegistry();
    if (!current.includes(name)) {
      const updated = [...current, name];
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('gulfer_registry', 1);
        request.onupgradeneeded = () => {
          const db = request.result;
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
    }
  } catch (err) {
    console.warn('Could not update database registry:', err);
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
    const current = await getDatabaseRegistry();
    const updated = current.filter(n => n !== name);
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('gulfer_registry', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
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
 *               The registry stores logical names, not full IndexedDB names
 */
export async function registerDatabaseName(name: string): Promise<void> {
  // Store the logical name (without "gulfer_db_" prefix)
  await addToRegistry(name);
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

