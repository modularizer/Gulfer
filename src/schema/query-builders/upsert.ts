/**
 * Upsert Utilities
 * 
 * Helper functions for upserting denormalized structures.
 * These handle the complexity of upserting main entities and all their nested children.
 */

import type { Database } from '@services/storage/db';
import * as schema from '../tables';
import { eq, and, sql, inArray } from 'drizzle-orm';

/**
 * Upsert a single entity with conflict handling
 */
export async function upsertEntity<T extends { id: string }>(
  db: Database,
  table: any,
  entity: Partial<T>,
  targetColumn: any = table.id
): Promise<void> {
  if (!entity.id) {
    throw new Error('Entity must have an id for upsert');
  }
  
  await db.insert(table).values(entity as any).onConflictDoUpdate({
    target: targetColumn,
    set: entity as any,
  });
}

/**
 * Upsert multiple entities
 */
export async function upsertEntities<T extends { id: string }>(
  db: Database,
  table: any,
  entities: Partial<T>[],
  targetColumn: any = table.id
): Promise<void> {
  if (entities.length === 0) return;
  
  // Filter out entities without IDs
  const validEntities = entities.filter(e => e.id) as T[];
  if (validEntities.length === 0) return;
  
  await db.insert(table).values(validEntities as any).onConflictDoUpdate({
    target: targetColumn,
    set: (excluded: any) => excluded,
  });
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
        sql`${table.id} NOT IN (${sql.join(keepIds.map(id => sql`${id}`), sql`, `)})`
      )
    );
}

