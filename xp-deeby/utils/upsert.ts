/**
 * Upsert Utilities
 * 
 * Generic helper functions for upserting entities in any database schema.
 * These handle the complexity of upserting entities with change detection.
 */

import { eq, and, isNull, notInArray, SQL } from 'drizzle-orm';
import type { Database } from '../adapters';

/**
 * Extract detailed error information from a database error
 */
function extractSqlError(error: any): string {
  if (!error) return 'Unknown error';
  
  const parts: string[] = [];
  
  // PostgreSQL error properties
  if (error.message) parts.push(`Message: ${error.message}`);
  if (error.code) parts.push(`Code: ${error.code}`);
  if (error.detail) parts.push(`Detail: ${error.detail}`);
  if (error.hint) parts.push(`Hint: ${error.hint}`);
  if (error.position) parts.push(`Position: ${error.position}`);
  if (error.severity) parts.push(`Severity: ${error.severity}`);
  
  // If it's a standard Error, include the message
  if (error instanceof Error) {
    if (!parts.length) {
      parts.push(error.message);
    }
    if (error.stack && parts.length === 1) {
      // Only include stack if we don't have detailed SQL error info
      parts.push(`\nStack: ${error.stack}`);
    }
  }
  
  // If we still don't have anything, stringify the error
  if (parts.length === 0) {
    try {
      parts.push(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    } catch {
      parts.push(String(error));
    }
  }
  
  return parts.join('\n');
}

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
    return true;
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
    return hasValueChanged((existing as any)[key], (entity as any)[key]);
  });
}




/**
 * Delete entities that are not in the provided list
 * Useful for syncing arrays of children
 * 
 * @param db - Database instance
 * @param table - Table to delete from
 * @param parentIdColumn - Column reference for the parent ID
 * @param parentId - Parent ID to filter by
 * @param keepIds - Array of child IDs to keep (all others will be deleted)
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
      //@ts-ignore
      and(
        eq(parentIdColumn, parentId),
        notInArray(table.id, keepIds)
      )
    );
}

