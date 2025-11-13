/**
 * Storage service for managing Photo entities
 * Uses Drizzle ORM directly
 */

import { Photo, photoSchema } from '@/types';
import { schema, getDatabase } from './db';
import { eq, and } from 'drizzle-orm';
import { generateUUID } from '@/utils/uuid';

/**
 * Get all photos
 */
export async function getAllPhotos(): Promise<Photo[]> {
  const db = await getDatabase();
  const photos = await db.select().from(schema.photos);
  
  return photos.map(photo => ({
    id: photo.id,
    refId: photo.refId,
    hash: photo.hash,
  }));
}

/**
 * Get photos by refId (for any entity)
 */
export async function getPhotosByRefId(refId: string): Promise<Photo[]> {
  const db = await getDatabase();
  const photos = await db.select()
    .from(schema.photos)
    .where(eq(schema.photos.refId, refId));
  
  return photos.map(photo => ({
    id: photo.id,
    refId: photo.refId,
    hash: photo.hash,
  }));
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
  const db = await getDatabase();
  const results = await db.select()
    .from(schema.photos)
    .where(eq(schema.photos.id, photoId))
    .limit(1);
  
  if (results.length === 0) return null;
  
  const photo = results[0];
  return {
    id: photo.id,
    refId: photo.refId,
    hash: photo.hash,
  };
}

/**
 * Save a photo to storage
 */
export async function savePhoto(photo: Photo): Promise<void> {
  const validated = photoSchema.parse(photo);
  const db = await getDatabase();
  
  await db.insert(schema.photos).values({
    id: validated.id,
    refId: validated.refId,
    refTable: null,
    refSchema: null,
    hash: validated.hash,
  }).onConflictDoUpdate({
    target: schema.photos.id,
    set: {
      refId: validated.refId,
      hash: validated.hash,
    },
  });
}

/**
 * Save multiple photos at once
 */
export async function savePhotos(photos: Photo[]): Promise<void> {
  const db = await getDatabase();
  
  for (const photo of photos) {
    const validated = photoSchema.parse(photo);
    await db.insert(schema.photos).values({
      id: validated.id,
      refId: validated.refId,
      refTable: null,
      refSchema: null,
      hash: validated.hash,
    }).onConflictDoUpdate({
      target: schema.photos.id,
      set: {
        refId: validated.refId,
        hash: validated.hash,
      },
    });
  }
}

/**
 * Delete a photo by ID
 */
export async function deletePhoto(photoId: string): Promise<void> {
  const db = await getDatabase();
  await db.delete(schema.photos).where(eq(schema.photos.id, photoId));
}

/**
 * Delete all photos for a specific refId
 */
export async function deletePhotosByRefId(refId: string): Promise<void> {
  const db = await getDatabase();
  await db.delete(schema.photos).where(eq(schema.photos.refId, refId));
}

/**
 * Generate a new unique photo ID (16 hex characters)
 */
export async function generatePhotoId(): Promise<string> {
  return generateUUID();
}

/**
 * Add a photo to an entity (creates a new Photo record)
 */
export async function addPhotoToEntity(refId: string, hash: string): Promise<Photo> {
  const photoId = await generatePhotoId();
  const photo: Photo = {
    id: photoId,
    refId,
    hash,
  };
  await savePhoto(photo);
  return photo;
}

/**
 * Add multiple photos to an entity
 */
export async function addPhotosToEntity(refId: string, hashes: string[]): Promise<Photo[]> {
  const photos: Photo[] = [];
  
  for (const hash of hashes) {
    const id = await generateUUID();
    photos.push({
      id,
      refId,
      hash,
    });
  }
  
  await savePhotos(photos);
  return photos;
}
