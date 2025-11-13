/**
 * Service for bulk exporting and importing all app data
 * Uses Drizzle ORM directly
 */

import { schema, getDatabase } from './storage/db';
import { eq } from 'drizzle-orm';
import { getImageByHash } from './storage/imageStorage';
import { getStorageId } from './storage/storageId';
import { getLocalUuidForForeign, mapForeignToLocal } from './storage/uuidMerge';
import { setCurrentUserId } from './storage/platform/currentUserStorage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { generateUUID } from '@/utils/uuid';
import { roundSchema, userSchema, courseSchema, holeSchema } from '@/types';

const PHOTOS_STORAGE_PREFIX = '@gulfer_photos_';
const IMAGE_STORAGE_PREFIX = '@gulfer_image_';
const LOCATION_PRECISION = 1e6;

// Helper to convert database format to application format
function locationFromDb(lat: number | null, lng: number | null) {
  if (lat === null || lng === null) return undefined;
  return { latitude: lat / LOCATION_PRECISION, longitude: lng / LOCATION_PRECISION };
}

export interface BulkExportData {
  version: string;
  exportDate: number;
  storageId: string;
  rounds: any[];
  players: any[];
  courses: any[];
  photos: Record<string, string[]>;
  images: Record<string, string>;
}

/**
 * Export all app data to a JSON structure
 */
export async function exportAllData(): Promise<BulkExportData> {
  try {
    const db = await getDatabase();
    const storageId = await getStorageId();

    // Get all data using Drizzle
    const roundsData = await db.select().from(schema.rounds);
    const playersData = await db.select().from(schema.players);
    const coursesData = await db.select().from(schema.courses);
    const photosData = await db.select().from(schema.photos);

    // Convert to application format
    const rounds = roundsData.map(r => ({
      id: r.id,
      name: r.name,
      notes: r.notes,
      location: locationFromDb(r.latitude, r.longitude),
      courseId: r.courseId,
      date: r.date,
    }));

    const players = playersData.map(p => ({
      id: p.id,
      name: p.name,
      notes: p.notes,
      location: locationFromDb(p.latitude, p.longitude),
    }));

    const courses = coursesData.map(c => ({
      id: c.id,
      name: c.name,
      notes: c.notes,
      location: locationFromDb(c.latitude, c.longitude),
    }));

    // Get photos by refId
    const photos: Record<string, string[]> = {};
    const photoHashesByRefId = new Map<string, string[]>();
    for (const photo of photosData) {
      if (!photoHashesByRefId.has(photo.refId)) {
        photoHashesByRefId.set(photo.refId, []);
      }
      photoHashesByRefId.get(photo.refId)!.push(photo.hash);
    }

    // Get all unique image hashes
    const allImageHashes = new Set<string>();
    photoHashesByRefId.forEach(hashes => hashes.forEach(h => allImageHashes.add(h)));
    rounds.forEach(round => {
      // Photos are stored separately now, but check if any legacy data exists
    });

    // Load all image data
    const images: Record<string, string> = {};
    for (const hash of allImageHashes) {
      try {
        if (Platform.OS === 'web') {
          const imageUri = await getImageByHash(hash);
          if (imageUri && imageUri.startsWith('data:')) {
            const base64 = imageUri.split(',')[1];
            images[hash] = base64;
          }
        } else {
          const imageUri = await getImageByHash(hash);
          if (imageUri && imageUri.startsWith('file://')) {
            const base64 = await FileSystem.readAsStringAsync(imageUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            images[hash] = base64;
          } else if (imageUri && imageUri.startsWith('data:')) {
            const base64 = imageUri.split(',')[1];
            images[hash] = base64;
          }
        }
      } catch (error) {
        console.error(`Error loading image ${hash}:`, error);
      }
    }

    const exportData: BulkExportData = {
      version: '1.0',
      exportDate: Date.now(),
      storageId,
      rounds,
      players,
      courses,
      photos: Object.fromEntries(photoHashesByRefId),
      images,
    };

    return exportData;
  } catch (error) {
    console.error('Error exporting all data:', error);
    throw error;
  }
}

/**
 * Export all data to a JSON string
 */
export async function exportAllDataAsJson(): Promise<string> {
  const data = await exportAllData();
  return JSON.stringify(data, null, 2);
}

export interface ImportSummary {
  rounds: { imported: number; skipped: number };
  players: { imported: number; skipped: number };
  courses: { imported: number; skipped: number };
  photos: { imported: number; skipped: number };
  images: { imported: number; skipped: number };
}

/**
 * Import all data from exported JSON structure
 */
export async function importAllData(
  exportData: BulkExportData,
  options?: {
    overwriteExisting?: boolean;
    skipDuplicates?: boolean;
  }
): Promise<ImportSummary> {
  const opts = {
    overwriteExisting: false,
    skipDuplicates: true,
    ...options,
  };

  const summary: ImportSummary = {
    rounds: { imported: 0, skipped: 0 },
    players: { imported: 0, skipped: 0 },
    courses: { imported: 0, skipped: 0 },
    photos: { imported: 0, skipped: 0 },
    images: { imported: 0, skipped: 0 },
  };

  try {
    const db = await getDatabase();
    const localStorageId = await getStorageId();
    const foreignStorageId = exportData.storageId;

    // Helper to convert location to DB format
    const locationToDb = (loc: any) => {
      if (!loc) return { latitude: null, longitude: null };
      return {
        latitude: Math.round(loc.latitude * LOCATION_PRECISION),
        longitude: Math.round(loc.longitude * LOCATION_PRECISION),
      };
    };

    // Import images first
    for (const [hash, base64] of Object.entries(exportData.images || {})) {
      try {
        if (Platform.OS === 'web') {
          // Check if photo with this hash exists
          const existing = await db.select()
            .from(schema.photos)
            .where(eq(schema.photos.hash, hash))
            .limit(1);
          
          if (existing.length > 0) {
            await db.update(schema.photos)
              .set({ data: base64 })
              .where(eq(schema.photos.hash, hash));
          } else {
            await db.insert(schema.photos).values({
              id: await generateUUID(),
              refId: await generateUUID(), // Placeholder
              refTable: null,
              refSchema: null,
              hash,
              data: base64,
              createdAt: Date.now(),
            });
          }
        } else {
          const IMAGE_DIR = `${FileSystem.documentDirectory}images/`;
          const fileUri = `${IMAGE_DIR}${hash}.jpg`;
          await FileSystem.writeAsStringAsync(fileUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          const existing = await db.select()
            .from(schema.photos)
            .where(eq(schema.photos.hash, hash))
            .limit(1);
          
          if (existing.length > 0) {
            await db.update(schema.photos)
              .set({ data: fileUri })
              .where(eq(schema.photos.hash, hash));
          } else {
            await db.insert(schema.photos).values({
              id: await generateUUID(),
              refId: await generateUUID(), // Placeholder
              refTable: null,
              refSchema: null,
              hash,
              data: fileUri,
              createdAt: Date.now(),
            });
          }
        }
        summary.images.imported++;
      } catch (error) {
        console.error(`Error importing image ${hash}:`, error);
        summary.images.skipped++;
      }
    }

    // Import courses
    for (const course of exportData.courses || []) {
      try {
        let localCourseId: string | undefined;

        if (foreignStorageId && foreignStorageId !== localStorageId && course.id) {
          const mappedId = await getLocalUuidForForeign(foreignStorageId, course.id, 'course');
          if (mappedId) {
            localCourseId = mappedId;
            summary.courses.skipped++;
            continue;
          }

          // Check by name
          const existing = await db.select()
            .from(schema.courses)
            .where(eq(schema.courses.name, course.name))
            .limit(1);
          
          if (existing.length > 0) {
            localCourseId = existing[0].id;
            await mapForeignToLocal(foreignStorageId, course.id, existing[0].id, 'course');
            summary.courses.skipped++;
            continue;
          }
        }

        const validated = courseSchema.parse(course);
        const dbLoc = locationToDb(validated.location);

        await db.insert(schema.courses).values({
          id: validated.id,
          name: validated.name,
          notes: validated.notes || null,
          latitude: dbLoc.latitude,
          longitude: dbLoc.longitude,
        }).onConflictDoUpdate({
          target: schema.courses.id,
          set: {
            name: validated.name,
            notes: validated.notes || null,
            latitude: dbLoc.latitude,
            longitude: dbLoc.longitude,
          },
        });

        if (foreignStorageId && foreignStorageId !== localStorageId && course.id && !localCourseId) {
          await mapForeignToLocal(foreignStorageId, course.id, course.id, 'course');
        }

        summary.courses.imported++;
      } catch (error) {
        console.error(`Error importing course ${course.id}:`, error);
        summary.courses.skipped++;
      }
    }

    // Import players
    for (const player of exportData.players || []) {
      try {
        let localPlayerId: string | undefined;

        if (foreignStorageId && foreignStorageId !== localStorageId && player.id) {
          const mappedId = await getLocalUuidForForeign(foreignStorageId, player.id, 'player');
          if (mappedId) {
            localPlayerId = mappedId;
            summary.players.skipped++;
            continue;
          }

          // Check by name
          const existing = await db.select()
            .from(schema.players)
            .where(eq(schema.players.name, player.name))
            .limit(1);
          
          if (existing.length > 0) {
            localPlayerId = existing[0].id;
            await mapForeignToLocal(foreignStorageId, player.id, existing[0].id, 'player');
            summary.players.skipped++;
            continue;
          }
        }

        const validated = userSchema.parse(player);
        const dbLoc = locationToDb(validated.location);

        await db.insert(schema.players).values({
          id: validated.id,
          name: validated.name,
          notes: validated.notes || null,
          latitude: dbLoc.latitude,
          longitude: dbLoc.longitude,
          isTeam: false,
        }).onConflictDoUpdate({
          target: schema.players.id,
          set: {
            name: validated.name,
            notes: validated.notes || null,
            latitude: dbLoc.latitude,
            longitude: dbLoc.longitude,
          },
        });

        if (foreignStorageId && foreignStorageId !== localStorageId && player.id && !localPlayerId) {
          await mapForeignToLocal(foreignStorageId, player.id, player.id, 'player');
        }

        summary.players.imported++;
      } catch (error) {
        console.error(`Error importing player ${player.id}:`, error);
        summary.players.skipped++;
      }
    }

    // Import rounds
    for (const round of exportData.rounds || []) {
      try {
        const validated = roundSchema.parse(round);
        const dbLoc = locationToDb(validated.location);

        await db.insert(schema.rounds).values({
          id: validated.id,
          name: validated.name,
          notes: validated.notes || null,
          latitude: dbLoc.latitude,
          longitude: dbLoc.longitude,
          courseId: validated.courseId || null,
          date: validated.date,
        }).onConflictDoUpdate({
          target: schema.rounds.id,
          set: {
            name: validated.name,
            notes: validated.notes || null,
            latitude: dbLoc.latitude,
            longitude: dbLoc.longitude,
            courseId: validated.courseId || null,
            date: validated.date,
          },
        });

        summary.rounds.imported++;
      } catch (error) {
        console.error(`Error importing round ${round.id}:`, error);
        summary.rounds.skipped++;
      }
    }

    // Import photos
    for (const [refId, hashes] of Object.entries(exportData.photos || {})) {
      try {
        for (const hash of hashes) {
          await db.insert(schema.photos).values({
            id: await generateUUID(),
            refId,
            refTable: null,
            refSchema: null,
            hash,
          }).onConflictDoUpdate({
            target: schema.photos.hash,
            set: { refId },
          });
        }
        summary.photos.imported += hashes.length;
      } catch (error) {
        console.error(`Error importing photos for ${refId}:`, error);
        summary.photos.skipped += hashes.length;
      }
    }

    return summary;
  } catch (error) {
    console.error('Error importing all data:', error);
    throw error;
  }
}
