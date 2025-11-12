/**
 * Local storage driver implementation
 * Uses localforage on web (IndexedDB) and AsyncStorage on React Native
 * This is the default driver for the current storage implementation
 */

import { Platform } from 'react-native';
import { StorageDriver } from './StorageDriver';
import localforage from 'localforage';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Platform-specific storage interface
 */
interface PlatformStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  clear: () => Promise<void>;
  getAllKeys: () => Promise<string[]>;
}

/**
 * Initialize platform-specific storage
 */
function initializeStorage(): PlatformStorage {
  if (Platform.OS === 'web') {
    // Use localforage on web
    localforage.config({
      name: 'Gulfer',
      storeName: 'gulfer_storage',
      description: 'Gulfer app storage',
    });
    return {
      getItem: async (key: string) => {
        try {
          const value = await localforage.getItem<string>(key);
          return value || null;
        } catch (error) {
          console.error(`Error getting item ${key}:`, error);
          return null;
        }
      },
      setItem: async (key: string, value: string) => {
        try {
          await localforage.setItem(key, value);
        } catch (error) {
          console.error(`Error setting item ${key}:`, error);
          throw error;
        }
      },
      removeItem: async (key: string) => {
        try {
          await localforage.removeItem(key);
        } catch (error) {
          console.error(`Error removing item ${key}:`, error);
          throw error;
        }
      },
      clear: async () => {
        try {
          await localforage.clear();
        } catch (error) {
          console.error('Error clearing storage:', error);
          throw error;
        }
      },
      getAllKeys: async () => {
        try {
          return await localforage.keys();
        } catch (error) {
          console.error('Error getting all keys:', error);
          return [];
        }
      },
    };
  } else {
    // Use AsyncStorage on React Native
    return {
      getItem: async (key: string) => {
        try {
          return await AsyncStorage.getItem(key);
        } catch (error) {
          console.error(`Error getting item ${key}:`, error);
          return null;
        }
      },
      setItem: async (key: string, value: string) => {
        try {
          await AsyncStorage.setItem(key, value);
        } catch (error) {
          console.error(`Error setting item ${key}:`, error);
          throw error;
        }
      },
      removeItem: async (key: string) => {
        try {
          await AsyncStorage.removeItem(key);
        } catch (error) {
          console.error(`Error removing item ${key}:`, error);
          throw error;
        }
      },
      clear: async () => {
        try {
          await AsyncStorage.clear();
        } catch (error) {
          console.error('Error clearing storage:', error);
          throw error;
        }
      },
      getAllKeys: async () => {
        try {
          return await AsyncStorage.getAllKeys();
        } catch (error) {
          console.error('Error getting all keys:', error);
          return [];
        }
      },
    };
  }
}

// Initialize storage once
const platformStorage = initializeStorage();

/**
 * Local storage driver
 * Implements StorageDriver using platform-specific storage (localforage/AsyncStorage)
 */
export class LocalStorageDriver extends StorageDriver {
  /**
   * Get a value from storage by key
   */
  protected async getRaw(key: string): Promise<string | null> {
    return platformStorage.getItem(key);
  }
  
  /**
   * Set a value in storage by key
   */
  protected async setRaw(key: string, value: string): Promise<void> {
    return platformStorage.setItem(key, value);
  }
  
  /**
   * Remove a value from storage by key
   */
  protected async removeRaw(key: string): Promise<void> {
    return platformStorage.removeItem(key);
  }
  
  /**
   * Get all keys from storage
   */
  protected async getAllKeys(): Promise<string[]> {
    return platformStorage.getAllKeys();
  }
  
  /**
   * Clear all storage
   */
  protected async clearAll(): Promise<void> {
    return platformStorage.clear();
  }
}

/**
 * Default storage driver instance
 * This is the driver used throughout the application
 * Can be swapped out for other drivers (e.g., SQLite, IndexedDB wrapper, etc.)
 */
export const defaultStorageDriver = new LocalStorageDriver();

/**
 * Convenience functions that use the default storage driver
 * These maintain backward compatibility with code that imported from storageAdapter
 */
export async function getItem(key: string): Promise<string | null> {
  return defaultStorageDriver.getItem(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  return defaultStorageDriver.setItem(key, value);
}

export async function removeItem(key: string): Promise<void> {
  return defaultStorageDriver.removeItem(key);
}

export async function clear(): Promise<void> {
  return defaultStorageDriver.clear();
}

export async function getAllKeys(): Promise<string[]> {
  return defaultStorageDriver.getAllStorageKeys();
}

