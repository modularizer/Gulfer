/**
 * UUID Merge/Mapping System
 * Maps foreign UUIDs (from other storage instances) to local UUIDs
 * Tracks: (foreignStorageId + foreignEntityUuid) -> localEntityUuid
 * Used for merging imported data with existing data
 */

import { getItem, setItem } from './storageAdapter';

const MERGE_TABLE_KEY = '@gulfer_uuid_merges';

interface MergeEntry {
  foreignStorageId: string; // Storage UUID where the entity came from
  foreignEntityUuid: string; // Entity UUID in the foreign storage
  localEntityUuid: string; // Local UUID that "wins"
  entityType: 'course' | 'round' | 'player'; // Type of entity
  mergedAt: number; // Timestamp when merge was created
}

interface MergeTable {
  [key: string]: MergeEntry; // Key: `${foreignStorageId}:${foreignEntityUuid}:${entityType}`
}

/**
 * Get the local UUID for a foreign entity
 * Looks up merge table to find if this foreign entity has been mapped to a local entity
 * 
 * @param foreignStorageId - Storage UUID where the entity came from
 * @param foreignEntityUuid - Entity UUID in the foreign storage
 * @param entityType - Type of entity
 * @returns Local UUID if mapped, null if not mapped
 */
export async function getLocalUuidForForeign(
  foreignStorageId: string,
  foreignEntityUuid: string,
  entityType: 'course' | 'round' | 'player'
): Promise<string | null> {
  try {
    const mergeTable = await getMergeTable();
    const key = `${foreignStorageId}:${foreignEntityUuid}:${entityType}`;
    const entry = mergeTable[key];
    
    if (entry && entry.entityType === entityType) {
      return entry.localEntityUuid;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting local UUID for foreign entity:', error);
    return null;
  }
}

/**
 * Map a foreign entity to a local entity
 * Creates a merge entry: (foreignStorageId + foreignEntityUuid) -> localEntityUuid
 * 
 * @param foreignStorageId - Storage UUID where the entity came from
 * @param foreignEntityUuid - Entity UUID in the foreign storage
 * @param localEntityUuid - Local UUID that this foreign entity maps to
 * @param entityType - Type of entity
 */
export async function mapForeignToLocal(
  foreignStorageId: string,
  foreignEntityUuid: string,
  localEntityUuid: string,
  entityType: 'course' | 'round' | 'player'
): Promise<void> {
  try {
    const mergeTable = await getMergeTable();
    const key = `${foreignStorageId}:${foreignEntityUuid}:${entityType}`;
    
    // Prevent mapping to itself (shouldn't happen, but check anyway)
    if (foreignEntityUuid === localEntityUuid && foreignStorageId === await getStorageId()) {
      // This is the same storage, no merge needed
      return;
    }
    
    // Create or update merge entry
    mergeTable[key] = {
      foreignStorageId,
      foreignEntityUuid,
      localEntityUuid,
      entityType,
      mergedAt: Date.now(),
    };
    
    await setItem(MERGE_TABLE_KEY, JSON.stringify(mergeTable));
  } catch (error) {
    console.error('Error mapping foreign to local UUID:', error);
    throw error;
  }
}

/**
 * Get storage ID (imported to avoid circular dependency)
 */
async function getStorageId(): Promise<string> {
  const { getStorageId: getStorageIdFn } = await import('./storageId');
  return getStorageIdFn();
}

/**
 * Get all foreign entities that map to a given local UUID
 */
export async function getForeignEntitiesForLocal(
  localEntityUuid: string,
  entityType: 'course' | 'round' | 'player'
): Promise<Array<{ foreignStorageId: string; foreignEntityUuid: string }>> {
  try {
    const mergeTable = await getMergeTable();
    const foreignEntities: Array<{ foreignStorageId: string; foreignEntityUuid: string }> = [];
    
    for (const entry of Object.values(mergeTable)) {
      if (entry.entityType === entityType && entry.localEntityUuid === localEntityUuid) {
        foreignEntities.push({
          foreignStorageId: entry.foreignStorageId,
          foreignEntityUuid: entry.foreignEntityUuid,
        });
      }
    }
    
    return foreignEntities;
  } catch (error) {
    console.error('Error getting foreign entities for local UUID:', error);
    return [];
  }
}

/**
 * Get the merge table
 */
async function getMergeTable(): Promise<MergeTable> {
  try {
    const data = await getItem(MERGE_TABLE_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return {};
  } catch (error) {
    console.error('Error loading merge table:', error);
    return {};
  }
}

/**
 * Get all merge entries for a specific entity type
 */
export async function getMergeEntries(entityType: 'course' | 'round' | 'player'): Promise<MergeEntry[]> {
  try {
    const mergeTable = await getMergeTable();
    return Object.values(mergeTable).filter(entry => entry.entityType === entityType);
  } catch (error) {
    console.error('Error getting merge entries:', error);
    return [];
  }
}

