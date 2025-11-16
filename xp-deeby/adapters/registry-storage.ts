/**
 * Cross-platform registry storage
 * 
 * Provides a unified interface for storing database registry entries
 * across different platforms using the generic key-value storage system.
 */

import { AdapterType } from './types';
import { getStorage } from '../kv';
import type { RegistryEntry } from './types';

const registryKey = 'databases';

/**
 * Get registry entries from storage
 */
export async function getRegistryEntries(): Promise<RegistryEntry[]> {
  const storage = await getStorage();
  const result = await storage.get<RegistryEntry[]>(registryKey);
  return result ?? [];
}

/**
 * Save registry entries to storage
 */
export async function saveRegistryEntries(entries: RegistryEntry[]): Promise<void> {
  const storage = await getStorage();
  await storage.set(registryKey, entries);
}

/**
 * Register a database entry
 */
export async function registerDatabaseEntry(entry: RegistryEntry): Promise<void> {
    const current = await getRegistryEntries();
    const existing = current.find(e => e.name === entry.name);

    if (!existing || existing.adapterType !== entry.adapterType) {
        // Remove old entry if name exists but adapter type is different
        const filtered = current.filter(e => e.name !== entry.name);
        const updated = [...filtered, entry];
        await saveRegistryEntries(updated);
    }
}

