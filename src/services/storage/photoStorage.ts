/**
 * Photo storage service
 * Handles both image storage (with file system) and photo entity management
 * Uses Drizzle ORM to store photo data
 * On mobile: Stores file path in database, actual file in file system
 * On web: Stores base64 data in database
 */

import { schema, getDatabase } from './db';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { eq } from 'drizzle-orm';
import { generateUUID } from '@/utils/uuid';

const IMAGE_DIR = `${FileSystem.documentDirectory}images/`;

// Ensure images directory exists
async function ensureImageDir(): Promise<void> {
  if (Platform.OS !== 'web') {
    const dirInfo = await FileSystem.getInfoAsync(IMAGE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
    }
  }
}

/**
 * Hash an image file and return the hash
 */
async function hashImage(uri: string): Promise<string> {
  let base64: string;
  
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    
    base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64Data = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    
    if (base64.startsWith('data:')) {
      base64 = base64.split(',')[1];
    }
  } else {
    base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }
  
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    base64
  );
  
  return hash;
}

/**
 * Store an image by its hash
 * Returns the hash and file URI if successful, or null if there was an error
 */
export async function storeImage(uri: string): Promise<{ hash: string; fileUri: string } | null> {
  const hash = await hashImage(uri);
  const db = await getDatabase();
  
  // Check if already stored in photos table
  const existing = await db.select()
    .from(schema.photos)
    .where(eq(schema.photos.hash, hash))
    .limit(1);
  
  if (existing.length > 0 && existing[0].data) {
    // Already stored
    if (Platform.OS === 'web') {
      const dataUri = `data:image/jpeg;base64,${existing[0].data}`;
      return { hash, fileUri: dataUri };
    } else {
      return { hash, fileUri: existing[0].data }; // data is file path on mobile
    }
  }
  
  if (Platform.OS === 'web') {
    // On web, store base64 in database
    const response = await fetch(uri);
    const blob = await response.blob();
    
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64Data = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    
    const cleanBase64 = base64.startsWith('data:') ? base64.split(',')[1] : base64;
    
    // Store in photos table (create or update)
    if (existing.length > 0) {
      // Update existing photo record with data
      await db.update(schema.photos)
        .set({ data: cleanBase64 })
        .where(eq(schema.photos.hash, hash));
    } else {
      // Create new photo record with data (refId can be a placeholder)
      await db.insert(schema.photos).values({
        id: generateUUID(),
        refId: generateUUID(), // Placeholder, will be updated when photo is linked to entity
        refTable: null,
        refSchema: null,
        hash,
        data: cleanBase64,
        createdAt: Date.now(),
      });
    }
    
    const dataUri = `data:image/jpeg;base64,${cleanBase64}`;
    return { hash, fileUri: dataUri };
  } else {
    // On mobile, store file path in database, actual file in file system
    await ensureImageDir();
    const fileUri = `${IMAGE_DIR}${hash}.jpg`;
    
    // Copy file to permanent location
    await FileSystem.copyAsync({
      from: uri,
      to: fileUri,
    });
    
    // Store file path in photos table
    if (existing.length > 0) {
      // Update existing photo record with data
      await db.update(schema.photos)
        .set({ data: fileUri })
        .where(eq(schema.photos.hash, hash));
    } else {
      // Create new photo record with data
      await db.insert(schema.photos).values({
        id: generateUUID(),
        refId: generateUUID(), // Placeholder
        refTable: null,
        refSchema: null,
        hash,
        data: fileUri,
        createdAt: Date.now(),
      });
    }
    
    return { hash, fileUri };
  }
}

/**
 * Get image URI by hash
 */
export async function getImageByHash(hash: string): Promise<string | null> {
  const db = await getDatabase();
  const results = await db.select()
    .from(schema.photos)
    .where(eq(schema.photos.hash, hash))
    .limit(1);
  
  if (results.length === 0 || !results[0].data) return null;
  
  const photo = results[0];
  
  if (Platform.OS === 'web') {
    return `data:image/jpeg;base64,${photo.data}`;
  } else {
    // On mobile, check if file still exists
    const fileInfo = await FileSystem.getInfoAsync(photo.data);
    if (fileInfo.exists) {
      return photo.data;
    }
    // File missing, clear data from database
    await db.update(schema.photos)
      .set({ data: null })
      .where(eq(schema.photos.hash, hash));
    return null;
  }
}
