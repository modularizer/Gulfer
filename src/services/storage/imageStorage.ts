/**
 * Image storage service with deduplication
 * Stores images in permanent file system location, using hash for deduplication
 * On mobile: Uses file:// URIs to permanent directory
 * On web: Uses blob URLs (stored in IndexedDB for persistence)
 */

import { getItem, setItem, removeItem } from './storageAdapter';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

const IMAGE_STORAGE_PREFIX = '@gulfer_image_';
const IMAGE_DIR = `${FileSystem.documentDirectory}images/`;

// Ensure images directory exists
async function ensureImageDir(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(IMAGE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
  }
}

/**
 * Hash an image file and return the hash
 * Platform-aware: uses FileSystem on mobile, fetch/File API on web
 */
async function hashImage(uri: string): Promise<string> {
  try {
    let base64: string;
    
    if (Platform.OS === 'web') {
      // On web, fetch the blob and convert to base64
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Convert blob to base64
      base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // Remove data URL prefix if present
          const base64Data = result.includes(',') ? result.split(',')[1] : result;
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      // Remove data URL prefix (data:image/jpeg;base64,)
      if (base64.startsWith('data:')) {
        base64 = base64.split(',')[1];
      }
    } else {
      // On mobile, use FileSystem
      base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
    
    // Hash the base64 string
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      base64
    );
    
    return hash;
  } catch (error) {
    console.error('Error hashing image:', error);
    throw error;
  }
}

/**
 * Store an image by its hash
 * Returns the hash and file URI if successful, or null if there was an error
 * On mobile: Copies to permanent directory, returns file:// URI
 * On web: Stores in IndexedDB, returns blob URL
 */
export async function storeImage(uri: string): Promise<{ hash: string; fileUri: string } | null> {
  try {
    // Hash the image
    const hash = await hashImage(uri);
    
    if (Platform.OS === 'web') {
      // On web, check if already stored in IndexedDB
      const existing = await getItem(`${IMAGE_STORAGE_PREFIX}${hash}`);
      if (existing) {
        // Return existing data URI
        const dataUri = `data:image/jpeg;base64,${existing}`;
        return { hash, fileUri: dataUri };
      }
      
      // Fetch the blob and convert to base64 for storage
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Convert blob to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // Remove data URL prefix if present
          const base64Data = result.includes(',') ? result.split(',')[1] : result;
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      // Remove data URL prefix if present
      const cleanBase64 = base64.startsWith('data:') ? base64.split(',')[1] : base64;
      
      // Store in IndexedDB
      await setItem(`${IMAGE_STORAGE_PREFIX}${hash}`, cleanBase64);
      const dataUri = `data:image/jpeg;base64,${cleanBase64}`;
      return { hash, fileUri: dataUri };
    } else {
      // On mobile, use permanent file system
      await ensureImageDir();
      const fileUri = `${IMAGE_DIR}${hash}.jpg`;
      
      // Check if file already exists
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        // File already exists, return hash and URI
        return { hash, fileUri };
      }
      
      // Copy file to permanent location
      await FileSystem.copyAsync({
        from: uri,
        to: fileUri,
      });
      
      return { hash, fileUri };
    }
  } catch (error) {
    console.error('Error storing image:', error);
    return null;
  }
}

/**
 * Get image URI by hash
 * On mobile: Returns file:// URI
 * On web: Returns data URI from IndexedDB
 */
export async function getImageByHash(hash: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      const base64 = await getItem(`${IMAGE_STORAGE_PREFIX}${hash}`);
      if (!base64) {
        return null;
      }
      return `data:image/jpeg;base64,${base64}`;
    } else {
      // On mobile, construct file path
      const fileUri = `${IMAGE_DIR}${hash}.jpg`;
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        return fileUri;
      }
      return null;
    }
  } catch (error) {
    console.error('Error retrieving image:', error);
    return null;
  }
}

/**
 * Delete an image by its hash
 */
export async function deleteImageByHash(hash: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      await removeItem(`${IMAGE_STORAGE_PREFIX}${hash}`);
    } else {
      const fileUri = `${IMAGE_DIR}${hash}.jpg`;
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(fileUri);
      }
    }
  } catch (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
}

/**
 * Check if an image exists by hash
 */
export async function imageExists(hash: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      const data = await getItem(`${IMAGE_STORAGE_PREFIX}${hash}`);
      return data !== null;
    } else {
      const fileUri = `${IMAGE_DIR}${hash}.jpg`;
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      return fileInfo.exists;
    }
  } catch (error) {
    console.error('Error checking image existence:', error);
    return false;
  }
}
