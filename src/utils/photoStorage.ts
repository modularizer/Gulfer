/**
 * Utility functions for loading and saving photos from storage by storage key
 */

import { getItem, setItem } from '../services/storage/storageAdapter';

const PHOTOS_STORAGE_PREFIX = '@gulfer_photos_';

/**
 * Load photos (image hashes) for a given storage key
 */
export async function loadPhotosByStorageKey(storageKey: string): Promise<string[]> {
  try {
    const data = await getItem(`${PHOTOS_STORAGE_PREFIX}${storageKey}`);
    if (data) {
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error(`Error loading photos for storage key ${storageKey}:`, error);
    return [];
  }
}

/**
 * Save photos (image hashes) for a given storage key
 */
export async function savePhotosByStorageKey(storageKey: string, photos: string[]): Promise<void> {
  try {
    await setItem(`${PHOTOS_STORAGE_PREFIX}${storageKey}`, JSON.stringify(photos));
  } catch (error) {
    console.error(`Error saving photos for storage key ${storageKey}:`, error);
    throw error;
  }
}

