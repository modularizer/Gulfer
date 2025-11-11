/**
 * Cross-platform storage adapter
 * Uses localforage on web (IndexedDB) and AsyncStorage on React Native
 */

import { Platform } from 'react-native';

let storage: {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  clear: () => Promise<void>;
  getAllKeys: () => Promise<string[]>;
};

// Initialize storage based on platform
if (Platform.OS === 'web') {
  // Use localforage on web
  const localforage = require('localforage');
  localforage.config({
    name: 'Gulfer',
    storeName: 'gulfer_storage',
    description: 'Gulfer app storage',
  });
  storage = {
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
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  storage = {
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

/**
 * Get an item from storage
 */
export async function getItem(key: string): Promise<string | null> {
  return storage.getItem(key);
}

/**
 * Set an item in storage
 */
export async function setItem(key: string, value: string): Promise<void> {
  return storage.setItem(key, value);
}

/**
 * Remove an item from storage
 */
export async function removeItem(key: string): Promise<void> {
  return storage.removeItem(key);
}

/**
 * Clear all items from storage
 */
export async function clear(): Promise<void> {
  return storage.clear();
}

/**
 * Get all keys from storage
 */
export async function getAllKeys(): Promise<string[]> {
  return storage.getAllKeys();
}

