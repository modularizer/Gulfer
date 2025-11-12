/**
 * Storage service for managing the current user
 * Stores the current user ID in a separate table
 */

import { defaultStorageDriver } from './drivers';
import { CurrentUser, currentUserSchema } from '@/types';
import { generateUniqueUUID } from '../../utils/uuid';

const CURRENT_USER_STORAGE_KEY = '@gulfer_current_user';
const CURRENT_USER_NAME_KEY = '@gulfer_current_user_name'; // Legacy: keep for backward compatibility

/**
 * Get the current user ID
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const data = await defaultStorageDriver.getItem(CURRENT_USER_STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      const validation = currentUserSchema.safeParse(parsed);
      if (validation.success) {
        return validation.data.playerId;
      }
    }
    return null;
  } catch (error) {
    console.error('Error loading current user ID:', error);
    return null;
  }
}

/**
 * Set the current user ID
 */
export async function setCurrentUserId(playerId: string): Promise<void> {
  try {
    // Get existing current user record if it exists
    const data = await defaultStorageDriver.getItem(CURRENT_USER_STORAGE_KEY);
    let currentUser: CurrentUser;
    
    if (data) {
      const parsed = JSON.parse(data);
      const validation = currentUserSchema.safeParse(parsed);
      if (validation.success) {
        // Update existing record
        currentUser = {
          ...validation.data,
          playerId,
        };
      } else {
        // Invalid data, create new
        const id = await generateUniqueUUID();
        currentUser = {
          id,
          playerId,
        };
      }
    } else {
      // No existing record, create new
      const id = await generateUniqueUUID(new Set());
      currentUser = {
        id,
        playerId,
      };
    }
    
    // Validate before saving
    const validation = currentUserSchema.safeParse(currentUser);
    if (!validation.success) {
      const errorMessage = validation.error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join('; ');
      throw new Error(`Invalid current user data: ${errorMessage}`);
    }
    
    await defaultStorageDriver.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(validation.data));
  } catch (error) {
    console.error('Error saving current user ID:', error);
    throw error;
  }
}

/**
 * Clear the current user (set to null)
 */
export async function clearCurrentUserId(): Promise<void> {
  try {
    await defaultStorageDriver.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(null));
  } catch (error) {
    console.error('Error clearing current user ID:', error);
    throw error;
  }
}

/**
 * Get current user name (legacy support - reads from separate key)
 * This is kept for backward compatibility
 */
export async function getCurrentUserName(): Promise<string | null> {
  try {
    const name = await defaultStorageDriver.getItem(CURRENT_USER_NAME_KEY);
    return name;
  } catch (error) {
    console.error('Error loading current user name:', error);
    return null;
  }
}

/**
 * Save current user name (legacy support - saves to separate key)
 * This is kept for backward compatibility
 */
export async function saveCurrentUserName(name: string): Promise<void> {
  try {
    await defaultStorageDriver.setItem(CURRENT_USER_NAME_KEY, name);
  } catch (error) {
    console.error('Error saving current user name:', error);
    throw error;
  }
}

