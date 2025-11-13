/**
 * Platform-specific storage utility
 * Uses AsyncStorage on React Native, localStorage on web
 * For storing application-level settings that should persist across database resets
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateUUID } from '@/utils/uuid';

/**
 * Get a value from platform storage
 */
export async function getPlatformStorage(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage.getItem(key);
  } else {
    return await AsyncStorage.getItem(key);
  }
}

/**
 * Set a value in platform storage
 */
export async function setPlatformStorage(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(key, value);
  } else {
    await AsyncStorage.setItem(key, value);
  }
}

/**
 * Remove a value from platform storage
 */
export async function removePlatformStorage(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }
    localStorage.removeItem(key);
  } else {
    await AsyncStorage.removeItem(key);
  }
}

/**
 * Storage ID Management
 * Each storage instance has a permanent 16-hex ID that never changes
 * Uses platform storage (AsyncStorage/localStorage) instead of database
 * This ensures the storage ID persists across database resets
 */

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
  const storageId = generateUUID();
  
  // Store in platform storage
  await setPlatformStorage(STORAGE_ID_KEY, storageId);
  
  return storageId;
}

