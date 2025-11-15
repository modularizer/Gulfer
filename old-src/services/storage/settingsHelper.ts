/**
 * Helper for getting the settings userId and working with settings
 * Uses the current user ID from platform storage
 */

import { schema, getDatabase, Database } from './db';
import { eq } from 'drizzle-orm';
import { getCurrentUserId } from './platform/currentUserStorage';

/**
 * Get the userId for settings
 * Returns the current user ID from platform storage
 * Throws an error if no current user is set (should be handled by AppLayout)
 */
export async function getSettingsUserId(): Promise<string> {
  const currentUserId = await getCurrentUserId();
  
  if (!currentUserId) {
    throw new Error('No current user set. The app should ensure a current user exists before accessing settings.');
  }
  
  return currentUserId;
}

/**
 * Get database, ensure settings exists, and return both db and userId
 */
export async function getSettingsContext(): Promise<{ db: Database; userId: string }> {
  const db = await getDatabase();
  const userId = await getSettingsUserId();
  await ensureSettingsExists(db, userId);
  return { db, userId };
}

/**
 * Get the settings record (creates if it doesn't exist)
 */
export async function getSettings(): Promise<typeof schema.settings.$inferSelect> {
  const { db, userId } = await getSettingsContext();
  
  const results = await db.select()
    .from(schema.settings)
    .where(eq(schema.settings.userId, userId))
    .limit(1);
  
  if (results.length > 0) {
    return results[0];
  }
  
  // Should not happen if ensureSettingsExists worked, but handle it
  await ensureSettingsExists(db, userId);
  const retry = await db.select()
    .from(schema.settings)
    .where(eq(schema.settings.userId, userId))
    .limit(1);
  
  return retry[0];
}

/**
 * Update settings with partial storage
 */
export async function updateSettings(updates: Partial<typeof schema.settings.$inferInsert>): Promise<void> {
  const { db, userId } = await getSettingsContext();
  
  await db.insert(schema.settings).values({
    userId,
    ...updates,
    updatedAt: Date.now(),
  } as any).onConflictDoUpdate({
    target: schema.settings.userId,
    set: {
      ...updates,
      updatedAt: Date.now(),
    } as any,
  });
}

/**
 * Ensure settings record exists for the user
 */
export async function ensureSettingsExists(db?: Database, userId?: string): Promise<void> {
  const database = db || await getDatabase();
  const id = userId || await getSettingsUserId();
  
  const existing = await database.select()
    .from(schema.settings)
    .where(eq(schema.settings.userId, id))
    .limit(1);
  
  if (existing.length === 0) {
    await database.insert(schema.settings).values({
      userId: id,
      cardModes: null,
      columnVisibility: null,
      cornerConfig: null,
      navigationState: null,
      modalStates: null,
      other: null,
      updatedAt: Date.now(),
    });
  }
}
