/**
 * Storage service for managing the current user
 * Uses platform storage (AsyncStorage/localStorage) instead of database
 * This ensures the current user persists across database resets
 */

import { getPlatformStorage, setPlatformStorage, removePlatformStorage } from './platformStorage';

const CURRENT_USER_ID_KEY = '@gulfer_current_user_id';

/**
 * Get the current user ID
 */
export async function getCurrentUserId(): Promise<string | null> {
  return await getPlatformStorage(CURRENT_USER_ID_KEY);
}

/**
 * Set the current user ID
 */
export async function setCurrentUserId(playerId: string): Promise<void> {
  await setPlatformStorage(CURRENT_USER_ID_KEY, playerId);
}

/**
 * Clear the current user (set to null)
 */
export async function clearCurrentUserId(): Promise<void> {
  await removePlatformStorage(CURRENT_USER_ID_KEY);
}

