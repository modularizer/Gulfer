/**
 * Storage service for managing Photo entities
 * Photos can reference any entity via refId (rounds, courses, users, etc.)
 * Uses GenericStorageService for common operations
 */

import { setItem } from './drivers';
import { Photo, photoSchema } from '@/types';
import { generateUniqueUUID } from '../../utils/uuid';
import { GenericStorageService } from './GenericStorageService';

const PHOTOS_STORAGE_KEY = '@gulfer_photos';

// Create generic storage service instance for photos
// Note: Photos don't have a name field, so we disable name uniqueness checking
const photoStorage = new GenericStorageService<Photo>({
  storageKey: PHOTOS_STORAGE_KEY,
  schema: photoSchema,
  entityName: 'Photo',
  checkNameUniqueness: false, // Photos don't have names
  generatedFields: [
    { field: 'id' },
  ],
  uniqueFields: ['id'],
  uniqueFieldCombos: [['refId', 'hash']],
});

/**
 * Get all photos
 */
export async function getAllPhotos(): Promise<Photo[]> {
  return photoStorage.getAll();
}

/**
 * Get photos by refId (for any entity)
 */
export async function getPhotosByRefId(refId: string): Promise<Photo[]> {
  return photoStorage.filter(photo => photo.refId === refId);
}

/**
 * Get photo hashes by refId (convenience method)
 */
export async function getPhotoHashesByRefId(refId: string): Promise<string[]> {
  const photos = await getPhotosByRefId(refId);
  return photos.map(photo => photo.hash);
}

/**
 * Get a photo by ID
 */
export async function getPhotoById(photoId: string): Promise<Photo | null> {
  return photoStorage.getById(photoId);
}

/**
 * Save a photo to storage
 * Validates the photo against schema before saving
 */
export async function savePhoto(photo: Photo): Promise<void> {
  return photoStorage.save(photo);
}

/**
 * Save multiple photos at once
 */
export async function savePhotos(photos: Photo[]): Promise<void> {
  try {
    const allPhotos = await getAllPhotos();
    const existingIds = new Set(allPhotos.map(p => p.id));
    
    for (const photo of photos) {
      // Validate each photo
      const validation = photoSchema.safeParse(photo);
      if (!validation.success) {
        const errorMessage = validation.error.errors
          .map(err => `${err.path.join('.')}: ${err.message}`)
          .join('; ');
        throw new Error(`Invalid photo data: ${errorMessage}`);
      }
      
      const existingIndex = allPhotos.findIndex((p) => p.id === validation.data.id);
      if (existingIndex >= 0) {
        allPhotos[existingIndex] = validation.data;
      } else {
        allPhotos.push(validation.data);
      }
    }
    
    await setItem(PHOTOS_STORAGE_KEY, JSON.stringify(allPhotos));
  } catch (error: any) {
    console.error('Error saving photos:', error);
    
    // Check if it's a quota exceeded error
    if (error?.name === 'QuotaExceededError' || error?.message?.includes('quota') || error?.message?.includes('QuotaExceeded')) {
      const quotaError = new Error('Storage quota exceeded. Please delete some old data to free up space.');
      (quotaError as any).name = 'QuotaExceededError';
      throw quotaError;
    }
    
    throw error;
  }
}

/**
 * Delete a photo by ID
 */
export async function deletePhoto(photoId: string): Promise<void> {
  return photoStorage.delete(photoId);
}

/**
 * Delete all photos for a specific refId
 */
export async function deletePhotosByRefId(refId: string): Promise<void> {
  const photos = await getAllPhotos();
  const idsToDelete = photos.filter(p => p.refId === refId).map(p => p.id);
  return photoStorage.deleteMany(idsToDelete);
}

/**
 * Generate a new unique photo ID (8 hex characters)
 */
export async function generatePhotoId(): Promise<string> {
  return photoStorage.generateId();
}

/**
 * Add a photo to an entity (creates a new Photo record)
 */
export async function addPhotoToEntity(refId: string, hash: string): Promise<Photo> {
  try {
    const photoId = await generatePhotoId();
    const photo: Photo = {
      id: photoId,
      refId,
      hash,
    };
    await savePhoto(photo);
    return photo;
  } catch (error) {
    console.error('Error adding photo to entity:', error);
    throw error;
  }
}

/**
 * Add multiple photos to an entity
 */
export async function addPhotosToEntity(refId: string, hashes: string[]): Promise<Photo[]> {
  try {
    const photos: Photo[] = [];
    const photoId = await generatePhotoId();
    const existingIds = new Set((await getAllPhotos()).map(p => p.id));
    
    for (const hash of hashes) {
      const id = await generateUniqueUUID(existingIds);
      existingIds.add(id);
      photos.push({
        id,
        refId,
        hash,
      });
    }
    
    await savePhotos(photos);
    return photos;
  } catch (error) {
    console.error('Error adding photos to entity:', error);
    throw error;
  }
}

