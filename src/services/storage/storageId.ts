/**
 * Storage ID Management
 * Each storage instance has a permanent 8-hex ID that never changes
 * This allows tracking which storage instance data came from during imports
 */

import { getItem, setItem } from './drivers';
import { generateUUID } from '../../utils/uuid';

const STORAGE_ID_KEY = '@gulfer_storage_id';

/**
 * Get or create the storage ID (8 hex characters)
 * This ID is permanent and never changes for this storage instance
 */
export async function getStorageId(): Promise<string> {
  try {
    let storageId = await getItem(STORAGE_ID_KEY);
    
    if (!storageId) {
      // Generate new storage ID (8 hex characters)
      storageId = await generateUUID();
      await setItem(STORAGE_ID_KEY, storageId);
    }
    
    return storageId;
  } catch (error) {
    console.error('Error getting storage ID:', error);
    // Fallback: generate a new one (shouldn't happen in normal operation)
    return await generateUUID();
  }
}

/**
 * Get storage ID synchronously (for use in exports)
 * Returns cached value or generates new one
 */
let cachedStorageId: string | null = null;

export async function getStorageIdSync(): Promise<string> {
  if (cachedStorageId) {
    return cachedStorageId;
  }
  
  cachedStorageId = await getStorageId();
  return cachedStorageId;
}

