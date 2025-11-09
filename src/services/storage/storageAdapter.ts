/**
 * Cross-platform storage adapter
 * Uses localforage which provides IndexedDB on web (much larger quota) and native storage on mobile
 */

import localforage from 'localforage';

// Configure localforage
localforage.config({
  name: 'Gulfer',
  storeName: 'gulfer_storage',
  description: 'Gulfer app storage',
});

/**
 * Get an item from storage
 */
export async function getItem(key: string): Promise<string | null> {
  try {
    const value = await localforage.getItem<string>(key);
    return value || null;
  } catch (error) {
    console.error(`Error getting item ${key}:`, error);
    return null;
  }
}

/**
 * Set an item in storage
 */
export async function setItem(key: string, value: string): Promise<void> {
  try {
    await localforage.setItem(key, value);
  } catch (error) {
    console.error(`Error setting item ${key}:`, error);
    throw error;
  }
}

/**
 * Remove an item from storage
 */
export async function removeItem(key: string): Promise<void> {
  try {
    await localforage.removeItem(key);
  } catch (error) {
    console.error(`Error removing item ${key}:`, error);
    throw error;
  }
}

/**
 * Clear all items from storage
 */
export async function clear(): Promise<void> {
  try {
    await localforage.clear();
  } catch (error) {
    console.error('Error clearing storage:', error);
    throw error;
  }
}

/**
 * Get all keys from storage
 */
export async function getAllKeys(): Promise<string[]> {
  try {
    return await localforage.keys();
  } catch (error) {
    console.error('Error getting all keys:', error);
    return [];
  }
}

