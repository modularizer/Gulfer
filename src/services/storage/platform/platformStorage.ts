/**
 * Platform-specific storage utility
 * Uses AsyncStorage on React Native, localStorage on web
 * For storing application-level settings that should persist across database resets
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

