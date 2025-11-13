/**
 * Storage ID Management
 * Each storage instance has a permanent 16-hex ID that never changes
 * Uses platform storage (AsyncStorage/localStorage) instead of database
 * This ensures the storage ID persists across database resets
 */

import { getPlatformStorage, setPlatformStorage } from './platform/platformStorage';
import { generateUUID } from '../../utils/uuid';

const STORAGE_ID_KEY = '@gulfer_storage_id';

/**
 * Get or create the storage ID (16 hex characters)
 * This ID is permanent and never changes for this storage instance
 */
export async function getStorageId(): Promise<string> {
  const existing = await getPlatformStorage(STORAGE_ID_KEY);
  
  if (existing) {
    return existing;
  }
  
  // Generate new storage ID
  const storageId = await generateUUID();
  
  // Store in platform storage
  await setPlatformStorage(STORAGE_ID_KEY, storageId);
  
  return storageId;
}
