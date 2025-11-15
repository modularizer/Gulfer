/**
 * Cross-platform registry storage
 * 
 * Provides a unified interface for storing database registry entries
 * across different platforms:
 * - Web: IndexedDB
 * - Mobile: AsyncStorage
 * - Node: File system (JSON file)
 */

import { detectPlatform, AdapterType, PlatformName } from './factory';

export interface DatabaseRegistryEntry {
  name: string;
  adapterType: AdapterType;
}

const prefix = 'xp-deeby-';
const registryName = `${prefix}registry`;
const registryKey = 'databases';

/**
 * Get registry entries from platform-specific storage
 */
export async function getRegistryEntries(): Promise<DatabaseRegistryEntry[]> {
  const platform = await detectPlatform();
  
  if (platform === PlatformName.WEB) {
    return await getRegistryEntriesWeb();
  } else if (platform === PlatformName.MOBILE) {
    return await getRegistryEntriesMobile();
  } else {
    return await getRegistryEntriesNode();
  }
}

/**
 * Save registry entries to platform-specific storage
 */
export async function saveRegistryEntries(entries: DatabaseRegistryEntry[]): Promise<void> {
  const platform = await detectPlatform();
  
  if (platform === PlatformName.WEB) {
    return await saveRegistryEntriesWeb(entries);
  } else if (platform === PlatformName.MOBILE) {
    return await saveRegistryEntriesMobile(entries);
  } else {
    return await saveRegistryEntriesNode(entries);
  }
}

/**
 * Add a database to the registry
 */
export async function addToRegistry(name: string, adapterType: AdapterType): Promise<void> {
  const current = await getRegistryEntries();
  const existing = current.find((e: DatabaseRegistryEntry) => e.name === name);
  
  if (!existing || existing.adapterType !== adapterType) {
    // Remove old entry if name exists but adapter type is different
    const filtered = current.filter((e: DatabaseRegistryEntry) => e.name !== name);
    const updated: DatabaseRegistryEntry[] = [...filtered, { name, adapterType }];
    await saveRegistryEntries(updated);
    
    // Verify it was added
    const verify = await getRegistryEntries();
    const verified = verify.find((e: DatabaseRegistryEntry) => e.name === name && e.adapterType === adapterType);
    if (!verified) {
      throw new Error(`Failed to verify registration: ${name} (${adapterType}) not found in registry after adding`);
    }
  }
}

/**
 * Register a database name (alias for addToRegistry)
 */
export async function registerDatabaseName(name: string, adapterType: AdapterType = AdapterType.PGLITE): Promise<void> {
  await addToRegistry(name, adapterType);
}

/**
 * Remove a database from the registry
 */
export async function removeFromRegistry(name: string): Promise<void> {
  try {
    const current = await getRegistryEntries();
    const updated = current.filter((e: DatabaseRegistryEntry) => e.name !== name);
    await saveRegistryEntries(updated);
  } catch (err) {
    console.warn('[registry] Could not remove from registry:', err);
    throw err;
  }
}

/**
 * Get database registry entries (alias for getRegistryEntries for backward compatibility)
 */
export const getDatabaseRegistryEntries = getRegistryEntries;

// ============================================================================
// Web Implementation (IndexedDB)
// ============================================================================

async function getRegistryEntriesWeb(): Promise<DatabaseRegistryEntry[]> {
  const indexedDB = typeof window !== 'undefined' ? window.indexedDB : null;
  if (!indexedDB) {
    return [];
  }

  try {
    return await new Promise<DatabaseRegistryEntry[]>((resolve, reject) => {
      const request = indexedDB.open(registryName, 2);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;
        if (!db.objectStoreNames.contains(registryKey)) {
          db.createObjectStore(registryKey);
        }
        // Migrate old format (array of strings) to new format (array of objects)
        if (oldVersion < 2) {
          const transaction = (event.target as IDBOpenDBRequest).transaction!;
          const store = transaction.objectStore(registryKey);
          const getRequest = store.get('list');
          getRequest.onsuccess = () => {
            const oldList = getRequest.result;
            if (Array.isArray(oldList) && oldList.length > 0 && typeof oldList[0] === 'string') {
              // Migrate: convert string array to entry array
              const migrated: DatabaseRegistryEntry[] = (oldList as string[]).map(name => ({
                name,
                adapterType: AdapterType.PGLITE
              }));
              store.put(migrated, 'list');
            }
          };
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(registryKey)) {
          resolve([]);
          return;
        }
        const transaction = db.transaction([registryKey], 'readonly');
        const store = transaction.objectStore(registryKey);
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
                adapterType: AdapterType.PGLITE
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

async function saveRegistryEntriesWeb(entries: DatabaseRegistryEntry[]): Promise<void> {
  const indexedDB = typeof window !== 'undefined' ? window.indexedDB : null;
  if (!indexedDB) {
    console.warn('[registry] IndexedDB not available, cannot save registry');
    return;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(registryName, 2);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(registryKey)) {
          db.createObjectStore(registryKey);
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(registryKey)) {
          reject(new Error('databases object store does not exist'));
          return;
        }
        const transaction = db.transaction([registryKey], 'readwrite');
        const store = transaction.objectStore(registryKey);
        const putRequest = store.put(entries, 'list');
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('[registry] ❌ Could not save registry:', err);
    throw err;
  }
}

// ============================================================================
// Mobile Implementation (AsyncStorage)
// ============================================================================

async function getRegistryEntriesMobile(): Promise<DatabaseRegistryEntry[]> {
  try {
    const AsyncStorage = await import('@react-native-async-storage/async-storage');
    const data = await AsyncStorage.default.getItem(registryName);
    if (!data) {
      return [];
    }
    
    const parsed = JSON.parse(data);
    // Handle both old format (string[]) and new format (DatabaseRegistryEntry[])
    if (Array.isArray(parsed)) {
      if (parsed.length > 0 && typeof parsed[0] === 'string') {
        // Old format - migrate on the fly
        return (parsed as string[]).map(name => ({
          name,
          adapterType: AdapterType.PGLITE
        }));
      } else {
        // New format
        return parsed as DatabaseRegistryEntry[];
      }
    }
    return [];
  } catch (err) {
    console.warn('[registry] Could not read from AsyncStorage:', err);
    return [];
  }
}

async function saveRegistryEntriesMobile(entries: DatabaseRegistryEntry[]): Promise<void> {
  try {
    const AsyncStorage = await import('@react-native-async-storage/async-storage');
    await AsyncStorage.default.setItem(registryName, JSON.stringify(entries));
  } catch (err) {
    console.error('[registry] ❌ Could not save to AsyncStorage:', err);
    throw err;
  }
}

// ============================================================================
// Node Implementation (File System)
// ============================================================================

async function getRegistryEntriesNode(): Promise<DatabaseRegistryEntry[]> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');
    
    // Store registry in user's home directory under .xp-deeby/
    const registryDir = path.join(os.homedir(), '.xp-deeby');
    const registryFile = path.join(registryDir, 'registry.json');
    
    try {
      const data = await fs.readFile(registryFile, 'utf-8');
      const parsed = JSON.parse(data);
      // Handle both old format (string[]) and new format (DatabaseRegistryEntry[])
      if (Array.isArray(parsed)) {
        if (parsed.length > 0 && typeof parsed[0] === 'string') {
          // Old format - migrate on the fly
          return (parsed as string[]).map(name => ({
            name,
            adapterType: AdapterType.PGLITE
          }));
        } else {
          // New format
          return parsed as DatabaseRegistryEntry[];
        }
      }
      return [];
    } catch (readErr: any) {
      // File doesn't exist yet, return empty array
      if (readErr.code === 'ENOENT') {
        return [];
      }
      throw readErr;
    }
  } catch (err) {
    console.warn('[registry] Could not read from file system:', err);
    return [];
  }
}

async function saveRegistryEntriesNode(entries: DatabaseRegistryEntry[]): Promise<void> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');
    
    // Store registry in user's home directory under .xp-deeby/
    const registryDir = path.join(os.homedir(), '.xp-deeby');
    const registryFile = path.join(registryDir, 'registry.json');
    
    // Ensure directory exists
    try {
      await fs.mkdir(registryDir, { recursive: true });
    } catch (mkdirErr: any) {
      // Directory might already exist, ignore EEXIST
      if (mkdirErr.code !== 'EEXIST') {
        throw mkdirErr;
      }
    }
    
    // Write registry file
    await fs.writeFile(registryFile, JSON.stringify(entries, null, 2), 'utf-8');
  } catch (err) {
    console.error('[registry] ❌ Could not save to file system:', err);
    throw err;
  }
}

