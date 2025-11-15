/**
 * Service for bulk exporting and importing all app storage
 * Uses Drizzle ORM directly
 */

import { schema, getDatabase, EntityType } from './storage/db';
import { eq } from 'drizzle-orm';
import { getImageByHash } from './storage/photoStorage';
import { getStorageId } from './storage/platform/platformStorage';
import { getLocalUuidForForeign, mapForeignToLocal } from './storage/uuidMerge';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { generateUUID } from '@/utils/uuid';



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
 * Export all app storage to a JSON structure
 */
export async function exportAllData(): Promise<BulkExportData> {
  try {
    const db = await getDatabase();
    const storageId = await getStorageId();

    // Get all storage using Drizzle
    const rounds = await db.select().from(schema.rounds);
    const players = await db.select().from(schema.players);
    const courses = await db.select().from(schema.courses);
    const photosData = await db.select().from(schema.photos);

    // Get photos by refId
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

    // Load all image storage
    const images: Record<string, string> = {};
    for (const hash of allImageHashes) {
      try {
        if (Platform.OS === 'web') {
          const imageUri = await getImageByHash(hash);
          if (imageUri && imageUri.startsWith('storage:')) {
            images[hash] = imageUri.split(',')[1];
          }
        } else {
          const imageUri = await getImageByHash(hash);
          if (imageUri && imageUri.startsWith('file://')) {
            images[hash] = await FileSystem.readAsStringAsync(imageUri, {
                encoding: FileSystem.EncodingType.Base64,
            });
          } else if (imageUri && imageUri.startsWith('storage:')) {
            images[hash] = imageUri.split(',')[1];
          }
        }
      } catch (error) {
        console.error(`Error loading image ${hash}:`, error);
      }
    }

    return {
      version: '1.0',
      exportDate: Date.now(),
      storageId,
      rounds,
      players,
      courses,
      photos: Object.fromEntries(photoHashesByRefId),
      images,
    };
  } catch (error) {
    console.error('Error exporting all storage:', error);
    throw error;
  }
}

/**
 * Export all storage to a JSON string
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
 * Import all storage from exported JSON structure
 */
export async function importAllData(
  exportData: BulkExportData,
  options?: {
    overwriteExisting?: boolean;
    skipDuplicates?: boolean;
  }
): Promise<ImportSummary> {
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
              id: generateUUID(),
              refId: generateUUID(), // Placeholder
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
              id: generateUUID(),
              refId: generateUUID(), // Placeholder
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
          const mappedId = await getLocalUuidForForeign(foreignStorageId, course.id, EntityType.Courses);
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
            await mapForeignToLocal(foreignStorageId, course.id, existing[0].id, EntityType.Courses);
            summary.courses.skipped++;
            continue;
          }
        }

        await db.insert(schema.courses).values({
          id: course.id,
          name: course.name,
          notes: course.notes || null,
          latitude: course.latitude ?? null,
          longitude: course.longitude ?? null,
        }).onConflictDoUpdate({
          target: schema.courses.id,
          set: {
            name: course.name,
            notes: course.notes || null,
            latitude: course.latitude ?? null,
            longitude: course.longitude ?? null,
          },
        });

        if (foreignStorageId && foreignStorageId !== localStorageId && course.id && !localCourseId) {
          await mapForeignToLocal(foreignStorageId, course.id, course.id, EntityType.Courses);
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
          const mappedId = await getLocalUuidForForeign(foreignStorageId, player.id, EntityType.Players);
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
            await mapForeignToLocal(foreignStorageId, player.id, existing[0].id, EntityType.Players);
            summary.players.skipped++;
            continue;
          }
        }

        await db.insert(schema.players).values({
          id: player.id,
          name: player.name,
          notes: player.notes || null,
          latitude: player.latitude ?? null,
          longitude: player.longitude ?? null,
          isTeam: false,
        }).onConflictDoUpdate({
          target: schema.players.id,
          set: {
            name: player.name,
            notes: player.notes || null,
            latitude: player.latitude ?? null,
            longitude: player.longitude ?? null,
          },
        });

        if (foreignStorageId && foreignStorageId !== localStorageId && player.id && !localPlayerId) {
          await mapForeignToLocal(foreignStorageId, player.id, player.id, EntityType.Players);
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

        await db.insert(schema.rounds).values({
          id: round.id,
          name: round.name,
          notes: round.notes || null,
          latitude: round.latitude ?? null,
          longitude: round.longitude ?? null,
          courseId: round.courseId || null,
          date: round.date,
        }).onConflictDoUpdate({
          target: schema.rounds.id,
          set: {
            name: round.name,
            notes: round.notes || null,
            latitude: round.latitude ?? null,
            longitude: round.longitude ?? null,
            courseId: round.courseId || null,
            date: round.date,
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
            id: generateUUID(),
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
    console.error('Error importing all storage:', error);
    throw error;
  }
}
