/**
 * UUID Merge/Mapping System
 * Maps foreign UUIDs (from other storage instances) to local UUIDs
 * Uses Drizzle ORM with mergeEntries table
 */

import { schema, getDatabase, EntityType } from './db';
import { getStorageId } from './platform/platformStorage';
import { eq, and } from 'drizzle-orm';
import { generateUUID } from '@/utils/uuid';

/**
 * Get the local UUID for a foreign entity
 */
export async function getLocalUuidForForeign(
  foreignStorageId: string,
  foreignEntityUuid: string,
  entityType: EntityType
): Promise<string | null> {
  const db = await getDatabase();
  const results = await db.select()
    .from(schema.mergeEntries)
    .where(and(
      eq(schema.mergeEntries.foreignStorageId, foreignStorageId),
      eq(schema.mergeEntries.foreignId, foreignEntityUuid),
      eq(schema.mergeEntries.refTable, entityType)
    ))
    .limit(1);
  
  if (results.length > 0) {
    return results[0].localId;
  }
  
  return null;
}

/**
 * Map a foreign entity to a local entity
 */
export async function mapForeignToLocal(
  foreignStorageId: string,
  foreignEntityUuid: string,
  localEntityUuid: string,
  entityType: EntityType
): Promise<void> {
  const db = await getDatabase();
  
  // Prevent mapping to itself
  const currentStorageId = await getStorageId();
  if (foreignEntityUuid === localEntityUuid && foreignStorageId === currentStorageId) {
    return;
  }
  
  // Check if mapping already exists
  const existing = await db.select()
    .from(schema.mergeEntries)
    .where(and(
      eq(schema.mergeEntries.foreignStorageId, foreignStorageId),
      eq(schema.mergeEntries.foreignId, foreignEntityUuid),
      eq(schema.mergeEntries.refTable, entityType)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    // Update existing
    await db.update(schema.mergeEntries)
      .set({
        localId: localEntityUuid,
        mergedAt: Date.now(),
      })
      .where(eq(schema.mergeEntries.id, existing[0].id));
  } else {
    // Create new
    await db.insert(schema.mergeEntries).values({
      id: generateUUID(),
      foreignStorageId,
      foreignId: foreignEntityUuid,
      refTable: entityType,
      refSchema: null,
      localId: localEntityUuid,
      mergedAt: Date.now(),
    });
  }
}

