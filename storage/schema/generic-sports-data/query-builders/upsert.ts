/**
 * Upsert Utilities
 * 
 * Helper functions for upserting denormalized structures.
 * These handle the complexity of upserting main entities and all their nested children.
 */

import type { Database } from '../../../adapters';
import { eq, and, isNull, notInArray, SQL } from 'drizzle-orm';

/**
 * Result of an upsert operation
 */
export type UpsertResult = 'insert' | 'update' | 'unchanged';

/**
 * Helper to check if two values are different (handling null/undefined)
 */
function hasValueChanged(existing: any, newValue: any): boolean {
  if (existing === null || existing === undefined) {
    return newValue !== null && newValue !== undefined;
  }
  if (newValue === null || newValue === undefined) {
    return existing !== null && existing !== undefined;
  }
  return existing !== newValue;
}

/**
 * Check if entity has changes compared to existing record
 */
function hasChanges<T extends { id: string }>(
  existing: any,
  entity: Partial<T>
): boolean {
  return Object.keys(entity).some(key => {
    if (key === 'id') return false;
    return hasValueChanged((existing as any)[key], (entity as any)[key]);
  });
}

/**
 * Build a WHERE condition from a condition object
 * e.g., {name: 'Golf', sportId: '123'} -> WHERE name = 'Golf' AND sportId = '123'
 */
function buildCondition(table: any, condition: Record<string, any>): SQL {
  const conditions = Object.entries(condition).map(([key, value]) => {
    const column = table[key];
    if (!column) {
      throw new Error(`Column "${key}" not found in table`);
    }
    if (value === null || value === undefined) {
      return isNull(column);
    }
    return eq(column, value);
  });
  return and(...conditions) as SQL;
}

/**
 * Upsert a single entity
 * 
 * @param db - Database instance
 * @param table - Table to upsert into
 * @param record - Record to upsert (must have an id)
 * @param condition - Condition object to check for existing records (e.g., {name: record.name})
 *                    If a record matches this condition, it will be updated; otherwise, a new record is inserted
 * @returns Whether the operation was an insert, update, or unchanged
 * 
 * @example
 * ```ts
 * // Upsert by name - if a sport with name 'Golf' exists, update it; otherwise insert
 * await upsertEntity(db, schema.sports, sport, {name: sport.name});
 * 
 * // Upsert by composite condition
 * await upsertEntity(db, schema.eventFormats, eventFormat, {
 *   name: eventFormat.name,
 *   sportId: eventFormat.sportId
 * });
 * ```
 */
export async function upsertEntity<T extends { id: string }>(
  db: Database,
  table: any,
  record: Partial<T>,
  condition?: Record<string, any>
): Promise<UpsertResult> {
  if (!record.id) {
    throw new Error('Record must have an id for upsert');
  }
  
  // First, check if record exists by id
  const existingById = await db
    .select()
    .from(table)
    .where(eq(table.id, record.id))
    .limit(1);
  
  if (existingById.length > 0) {
    // Check if anything actually changed
    if (hasChanges(existingById[0], record)) {
      // Update existing record by id
      await db.update(table)
        .set(record)
        .where(eq(table.id, record.id));
      return 'update';
    } else {
      return 'unchanged';
    }
  }
  
  // Check if record exists matching the condition (only if condition is provided and not empty)
  if (condition && Object.keys(condition).length > 0) {
    const whereCondition = buildCondition(table, condition);
    const existing = await db
      .select()
      .from(table)
      .where(whereCondition)
      .limit(1);
    
    if (existing.length > 0) {
      // Found existing record - merge with record and update
      const existingRecord = existing[0];
      const mergedRecord = { ...record, id: existingRecord.id };
      
      if (hasChanges(existingRecord, mergedRecord)) {
        // Update existing record
        await db.update(table)
          .set(mergedRecord)
          .where(eq(table.id, existingRecord.id));
        return 'update';
      } else {
        return 'unchanged';
      }
    }
  }
  
  // No existing record found - insert new record
  await db.insert(table).values(record);
  return 'insert';
}

/**
 * Upsert multiple entities
 * 
 * @param db - Database instance
 * @param table - Table to upsert into
 * @param records - Records to upsert
 * @param conditionBuilder - Function that builds a condition object for each record
 * 
 * @example
 * ```ts
 * await upsertEntities(db, schema.sports, sports, (sport) => ({name: sport.name}));
 * ```
 */
export async function upsertEntities<T extends { id: string }>(
  db: Database,
  table: any,
  records: Partial<T>[],
  conditionBuilder: (record: Partial<T>) => Record<string, any>
): Promise<void> {
  if (records.length === 0) return;
  
  // Filter out records without IDs
  const validRecords = records.filter(e => e.id) as T[];
  if (validRecords.length === 0) return;
  
  // For each record, upsert individually
  for (const record of validRecords) {
    const condition = conditionBuilder(record);
    await upsertEntity(db, table, record, condition);
  }
}

/**
 * Delete entities that are not in the provided list
 * Useful for syncing arrays of children
 */
export async function deleteMissingChildren(
  db: Database,
  table: any,
  parentIdColumn: any,
  parentId: string,
  keepIds: string[]
): Promise<void> {
  if (keepIds.length === 0) {
    // Delete all children if none are provided
    await db.delete(table).where(eq(parentIdColumn, parentId));
    return;
  }
  
  // Delete children not in the keep list
  await db.delete(table)
    .where(
      and(
        eq(parentIdColumn, parentId),
        notInArray(table.id, keepIds)
      )
    );
}

