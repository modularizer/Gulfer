/**
 * Service for bulk exporting and importing all app data
 * Exports: rounds, players, courses, and photos
 */

import { getAllRounds, saveRound, getRoundById } from './storage/roundStorage';
import { getAllUsers, saveUser, getUserByName, getUserIdForPlayerName } from './storage/userStorage';
import { getAllCourses, saveCourse, getCourseByName, getCourseById } from './storage/courseStorage';
import { getAllKeys, getItem, setItem } from './storage/drivers';
import { getImageByHash } from './storage/imageStorage';
import { loadPhotosByStorageKey, savePhotosByStorageKey } from '../utils/photoStorage';
import { getStorageId } from './storage/storageId';
import { getLocalUuidForForeign, mapForeignToLocal } from './storage/uuidMerge';
import { setCurrentUserId } from './storage/currentUserStorage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

const PHOTOS_STORAGE_PREFIX = '@gulfer_photos_';
const IMAGE_STORAGE_PREFIX = '@gulfer_image_';

export interface BulkExportData {
  version: string;
  exportDate: number;
  storageId: string;
  rounds: any[];
  players: any[];
  courses: any[];
  photos: Record<string, string[]>; // storageKey -> photo hashes
  images: Record<string, string>; // hash -> base64 image data
}

/**
 * Export all app data to a JSON structure
 */
export async function exportAllData(): Promise<BulkExportData> {
  try {
    // Get all data
    const rounds = await getAllRounds();
    const players = await getAllUsers();
    const courses = await getAllCourses();
    const storageId = await getStorageId();

    // Get all storage keys to find photos
    const allKeys = await getAllKeys();
    const photoKeys = allKeys.filter(key => key.startsWith(PHOTOS_STORAGE_PREFIX));
    
    // Load all photos by storage key
    const photos: Record<string, string[]> = {};
    for (const key of photoKeys) {
      const storageKey = key.replace(PHOTOS_STORAGE_PREFIX, '');
      const photoHashes = await loadPhotosByStorageKey(storageKey);
      if (photoHashes.length > 0) {
        photos[storageKey] = photoHashes;
      }
    }

    // Get all unique image hashes from photos
    const allImageHashes = new Set<string>();
    Object.values(photos).forEach(hashes => {
      hashes.forEach(hash => allImageHashes.add(hash));
    });
    
    // Also check rounds for photos
    rounds.forEach(round => {
      if (round.photos) {
        round.photos.forEach((hash: string) => allImageHashes.add(hash));
      }
    });

    // Load all image data
    const images: Record<string, string> = {};
    for (const hash of allImageHashes) {
      try {
        if (Platform.OS === 'web') {
          // On web, get base64 data from storage
          const imageData = await getItem(`${IMAGE_STORAGE_PREFIX}${hash}`);
          if (imageData) {
            images[hash] = imageData;
          }
        } else {
          // On mobile, read the file and convert to base64
          const imageUri = await getImageByHash(hash);
          if (imageUri && imageUri.startsWith('file://')) {
            try {
              const base64 = await FileSystem.readAsStringAsync(imageUri, {
                encoding: FileSystem.EncodingType.Base64,
              });
              images[hash] = base64;
            } catch (error) {
              console.error(`Error reading image file ${hash}:`, error);
            }
          } else if (imageUri && imageUri.startsWith('data:')) {
            // If it's already a data URI, extract base64
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
      photos,
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

/**
 * Import all data from a JSON structure
 * Returns summary of what was imported
 */
export interface ImportSummary {
  rounds: { imported: number; skipped: number };
  players: { imported: number; skipped: number };
  courses: { imported: number; skipped: number };
  photos: { imported: number; skipped: number };
  images: { imported: number; skipped: number };
}

export async function importAllData(
  exportData: BulkExportData,
  options?: {
    overwriteExisting?: boolean; // If true, overwrite existing items with same ID
    skipDuplicates?: boolean; // If true, skip items that already exist
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
    console.log('[BulkImport] Starting import...');
    console.log('[BulkImport] Export data structure:', {
      hasRounds: Array.isArray(exportData.rounds),
      hasPlayers: Array.isArray(exportData.players),
      hasCourses: Array.isArray(exportData.courses),
      hasPhotos: typeof exportData.photos === 'object',
      hasImages: typeof exportData.images === 'object',
    });
    console.log('[BulkImport] Images to import:', Object.keys(exportData.images || {}).length);
    console.log('[BulkImport] Courses to import:', exportData.courses?.length || 0);
    console.log('[BulkImport] Players to import:', exportData.players?.length || 0);
    console.log('[BulkImport] Rounds to import:', exportData.rounds?.length || 0);
    console.log('[BulkImport] Photo collections to import:', Object.keys(exportData.photos || {}).length);

    // Import images first (photos depend on them)
    // Process in batches to avoid blocking
    const imageEntries = Object.entries(exportData.images);
    const batchSize = 10;
    for (let i = 0; i < imageEntries.length; i += batchSize) {
      const batch = imageEntries.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async ([hash, base64Data]) => {
          try {
            if (Platform.OS === 'web') {
              // On web, store in IndexedDB
              const existing = await getItem(`${IMAGE_STORAGE_PREFIX}${hash}`);
              if (existing && opts.skipDuplicates) {
                summary.images.skipped++;
                return;
              }
              await setItem(`${IMAGE_STORAGE_PREFIX}${hash}`, base64Data);
              summary.images.imported++;
            } else {
              // On mobile, write to file system
              const IMAGE_DIR = `${FileSystem.documentDirectory}images/`;
              const fileUri = `${IMAGE_DIR}${hash}.jpg`;
              
              // Check if file already exists
              const fileInfo = await FileSystem.getInfoAsync(fileUri);
              if (fileInfo.exists && opts.skipDuplicates) {
                summary.images.skipped++;
                return;
              }
              
              // Ensure directory exists
              const dirInfo = await FileSystem.getInfoAsync(IMAGE_DIR);
              if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
              }
              
              // Write base64 data to file
              await FileSystem.writeAsStringAsync(fileUri, base64Data, {
                encoding: FileSystem.EncodingType.Base64,
              });
              summary.images.imported++;
            }
          } catch (error) {
            console.error(`Error importing image ${hash}:`, error);
            summary.images.skipped++;
          }
        })
      );
      // Allow UI to update between batches
      if (i + batchSize < imageEntries.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    console.log('[BulkImport] Images import complete:', summary.images);

    // Import courses with foreign ID merging
    console.log('[BulkImport] Importing courses...');
    const localStorageId = await getStorageId();
    const foreignStorageId = exportData.storageId;
    const localCourses = await getAllCourses();
    const localCourseIds = new Set(localCourses.map(c => c.id));
    
    for (const course of exportData.courses) {
      try {
        let localCourseId: string | undefined;
        
        // Check if this is from a different storage (foreign import)
        if (foreignStorageId && foreignStorageId !== localStorageId && course.id) {
          // Check if this foreign course is already mapped
          const mappedCourseId = await getLocalUuidForForeign(foreignStorageId, course.id, 'course');
          
          if (mappedCourseId) {
            // Use existing mapping - skip importing this course
            localCourseId = mappedCourseId;
            summary.courses.skipped++;
            continue;
          } else {
            // Check if a course with this name exists locally
            const existingCourse = await getCourseByName(course.name);
            
            if (existingCourse) {
              // Map foreign course to existing local course
              localCourseId = existingCourse.id;
              await mapForeignToLocal(foreignStorageId, course.id, existingCourse.id, 'course');
              summary.courses.skipped++; // Skipped because we're using existing
              continue;
            }
          }
        }
        
        // Check if course already exists locally (same storage or no foreign ID)
        const exists = localCourseIds.has(course.id);
        if (exists && opts.skipDuplicates && !opts.overwriteExisting) {
          summary.courses.skipped++;
          continue;
        }
        
        // Create new course or update existing
        await saveCourse(course);
        
        // If this was a foreign course, map it
        if (foreignStorageId && foreignStorageId !== localStorageId && course.id && !localCourseId) {
          await mapForeignToLocal(foreignStorageId, course.id, course.id, 'course');
        }
        
        summary.courses.imported++;
      } catch (error) {
        console.error(`Error importing course ${course.id}:`, error);
        summary.courses.skipped++;
      }
    }
    console.log('[BulkImport] Courses import complete:', summary.courses);

    // Import players with foreign ID merging
    // ALWAYS check by name first to enforce uniqueness and force merging
    console.log('[BulkImport] Importing players...');
    const localUsers = await getAllUsers();
    const localUserIds = new Set(localUsers.map(u => u.id));
    
    for (const player of exportData.players) {
      try {
        // STEP 1: ALWAYS check if a player with this name exists locally (case-insensitive)
        // This enforces name uniqueness and forces merging
        const existingUserByName = localUsers.find(u => 
          u.name.trim().toLowerCase() === player.name.trim().toLowerCase()
        );
        
        if (existingUserByName) {
          // Player with same name exists - FORCE MERGE
          console.log(`[BulkImport] FORCING MERGE: Foreign player ${player.id} (${player.name}) -> Local player ${existingUserByName.id} (${existingUserByName.name})`);
          
          // Create mapping if this is a foreign import
          if (foreignStorageId && foreignStorageId !== localStorageId && player.id) {
            await mapForeignToLocal(foreignStorageId, player.id, existingUserByName.id, 'player');
          }
          
          // Merge data but preserve local name
          const mergedPlayer = {
            ...existingUserByName,
            name: existingUserByName.name, // Always keep local name
            notes: existingUserByName.notes || player.notes, // Merge notes
          };
          await saveUser(mergedPlayer);
          summary.players.skipped++; // Skipped because we're using existing
          continue;
        }
        
        // STEP 2: Check if this is from a different storage (foreign import)
        if (foreignStorageId && foreignStorageId !== localStorageId && player.id) {
          // Check if this foreign player is already mapped
          const mappedPlayerId = await getLocalUuidForForeign(foreignStorageId, player.id, 'player');
          
          if (mappedPlayerId) {
            // Use existing mapping - update the player data but keep local ID
            const existingUser = localUsers.find(u => u.id === mappedPlayerId);
            if (existingUser) {
              // Merge data but preserve local name
              const mergedPlayer = {
                ...existingUser,
                name: existingUser.name, // Keep local name
                notes: existingUser.notes || player.notes, // Merge notes
              };
              await saveUser(mergedPlayer);
              summary.players.skipped++; // Skipped because we're using existing
              continue;
            }
          }
        }
        
        // STEP 3: Check if player already exists locally by ID (same storage)
        const exists = localUserIds.has(player.id);
        if (exists && opts.skipDuplicates && !opts.overwriteExisting) {
          summary.players.skipped++;
          continue;
        }
        
        // STEP 4: Create new player
        // Remove isCurrentUser if present (now handled by separate table)
        const cleanedPlayer = { ...player };
        delete (cleanedPlayer as any).isCurrentUser;
        
        await saveUser(cleanedPlayer);
        
        // If this was marked as current user, set it in the current user table
        if ((player as any).isCurrentUser) {
          await setCurrentUserId(player.id);
        }
        
        // If this was a foreign player, map it
        if (foreignStorageId && foreignStorageId !== localStorageId && player.id) {
          await mapForeignToLocal(foreignStorageId, player.id, player.id, 'player');
        }
        
        summary.players.imported++;
      } catch (error) {
        console.error(`Error importing player ${player.id}:`, error);
        // If it's a name conflict error, try to find and merge
        if (error instanceof Error && error.message.includes('already exists')) {
          const existingUser = localUsers.find(u => 
            u.name.trim().toLowerCase() === player.name.trim().toLowerCase()
          );
          if (existingUser && foreignStorageId && foreignStorageId !== localStorageId && player.id) {
            console.log(`[BulkImport] Handling name conflict: Mapping ${player.id} to ${existingUser.id}`);
            await mapForeignToLocal(foreignStorageId, player.id, existingUser.id, 'player');
            summary.players.skipped++;
            continue;
          }
        }
        summary.players.skipped++;
      }
    }
    console.log('[BulkImport] Players import complete:', summary.players);

    // Import rounds with foreign ID merging for players and courses
    console.log('[BulkImport] Importing rounds...');
    // Refresh localUsers to get any newly imported players AND any merged players
    const refreshedLocalUsers = await getAllUsers();
    console.log(`[BulkImport] Refreshed local users count: ${refreshedLocalUsers.length}`);
    console.log(`[BulkImport] Local users:`, refreshedLocalUsers.map(u => ({ id: u.id, name: u.name, isCurrent: u.isCurrentUser })));
    const localRounds = await getAllRounds();
    const localRoundIds = new Set(localRounds.map(r => r.id));
    
    for (const round of exportData.rounds) {
      try {
        // Check if round already exists (rounds are typically not merged, but check anyway)
        const exists = localRoundIds.has(round.id);
        if (exists && opts.skipDuplicates && !opts.overwriteExisting) {
          summary.rounds.skipped++;
          continue;
        }
        
        // Resolve foreign IDs in the round to local IDs
        const resolvedRound = { ...round };
        
        // Resolve course ID if present
        if (round.courseId && foreignStorageId && foreignStorageId !== localStorageId) {
          const localCourseId = await getLocalUuidForForeign(foreignStorageId, round.courseId, 'course');
          if (localCourseId) {
            const localCourse = await getCourseById(localCourseId);
            resolvedRound.courseId = localCourseId;
            resolvedRound.courseName = localCourse?.name || round.courseName;
          }
        }
        
        // Resolve player IDs in the round
        // ALWAYS resolve by name first to enforce uniqueness, regardless of storage ID
        // Create a map of original player ID -> local player ID for score resolution
        const playerIdMap = new Map<string, string>();
        
        if (resolvedRound.players) {
          resolvedRound.players = await Promise.all(
            resolvedRound.players.map(async (player: any) => {
              const originalPlayerId = player.id;
              
              // STEP 1: ALWAYS check by name first (enforces uniqueness)
              // This ensures players with the same name always use the same local ID
              const existingUserByName = refreshedLocalUsers.find(u => 
                u.name.trim().toLowerCase() === player.name.trim().toLowerCase()
              );
              
              if (existingUserByName) {
                // Found by name - FORCE USE LOCAL ID
                console.log(`[BulkImport] Round import: Resolving player "${player.name}" (ID: ${originalPlayerId}) by name -> ${existingUserByName.id} (${existingUserByName.name})`);
                if (originalPlayerId && originalPlayerId !== existingUserByName.id) {
                  playerIdMap.set(originalPlayerId, existingUserByName.id);
                  // Create mapping if this is a foreign import
                  if (foreignStorageId && foreignStorageId !== localStorageId) {
                    const existingMapping = await getLocalUuidForForeign(foreignStorageId, originalPlayerId, 'player');
                    if (!existingMapping) {
                      await mapForeignToLocal(foreignStorageId, originalPlayerId, existingUserByName.id, 'player');
                    }
                  }
                }
                return {
                  id: existingUserByName.id,
                  name: existingUserByName.name,
                };
              }
              
              // STEP 2: Check merge table if we have a foreign ID and different storage
              if (originalPlayerId && foreignStorageId && foreignStorageId !== localStorageId) {
                const mappedId = await getLocalUuidForForeign(foreignStorageId, originalPlayerId, 'player');
                
                if (mappedId) {
                  const localUser = refreshedLocalUsers.find(u => u.id === mappedId);
                  // Map foreign ID to local ID for score resolution
                  playerIdMap.set(originalPlayerId, mappedId);
                  console.log(`[BulkImport] Round import: Resolving player ${player.name} by mapping -> ${mappedId}`);
                  return {
                    id: mappedId,
                    name: localUser?.name || player.name,
                  };
                }
              }
              
              // STEP 3: Check if player ID already exists locally (same storage)
              const existingUserById = refreshedLocalUsers.find(u => u.id === originalPlayerId);
              if (existingUserById) {
                // Player ID already exists locally, use it
                return {
                  id: existingUserById.id,
                  name: existingUserById.name,
                };
              }
              
              // STEP 4: No match found - keep original but log warning
              console.warn(`[BulkImport] Round import: Could not resolve player "${player.name}" (ID: ${originalPlayerId}), keeping original`);
              if (originalPlayerId) {
                playerIdMap.set(originalPlayerId, originalPlayerId);
              }
              return player;
            })
          );
        }
        
        // Resolve player IDs in scores using the mapping
        if (resolvedRound.scores) {
          resolvedRound.scores = await Promise.all(
            resolvedRound.scores.map(async (score: any) => {
              // Try to find mapped player ID from the playerIdMap we built
              const mappedPlayerId = playerIdMap.get(score.playerId);
              if (mappedPlayerId) {
                return { ...score, playerId: mappedPlayerId };
              }
              
              // Fallback: try to find by matching with resolved players
              if (resolvedRound.players) {
                const player = resolvedRound.players.find((p: any) => p.id === score.playerId);
                if (player) {
                  return { ...score, playerId: player.id };
                }
              }
              
              // If still no match and we have foreign storage, try merge table lookup directly
              if (foreignStorageId && foreignStorageId !== localStorageId && score.playerId) {
                const directMappedId = await getLocalUuidForForeign(foreignStorageId, score.playerId, 'player');
                if (directMappedId) {
                  console.log(`[BulkImport] Resolved score player ID ${score.playerId} -> ${directMappedId} via merge table`);
                  return { ...score, playerId: directMappedId };
                }
                console.warn(`[BulkImport] Could not resolve player ID ${score.playerId} for score in round ${round.id}`);
              }
              
              return score;
            })
          );
        }
        
        // Log the resolved round to verify player IDs are correct
        console.log(`[BulkImport] Saving round ${resolvedRound.id} with players:`, 
          resolvedRound.players?.map((p: any) => ({ id: p.id, name: p.name }))
        );
        console.log(`[BulkImport] Round scores player IDs:`, 
          resolvedRound.scores?.map((s: any) => s.playerId)
        );
        
        await saveRound(resolvedRound);
        
        // Verify the round was saved correctly
        const savedRound = await getAllRounds();
        const verifyRound = savedRound.find(r => r.id === resolvedRound.id);
        if (verifyRound) {
          console.log(`[BulkImport] Verified saved round ${verifyRound.id} players:`, 
            verifyRound.players.map(p => ({ id: p.id, name: p.name }))
          );
        } else {
          console.error(`[BulkImport] ERROR: Round ${resolvedRound.id} was not saved!`);
        }
        
        summary.rounds.imported++;
      } catch (error) {
        console.error(`Error importing round ${round.id}:`, error);
        summary.rounds.skipped++;
      }
    }
    console.log('[BulkImport] Rounds import complete:', summary.rounds);

    // Import photos
    console.log('[BulkImport] Importing photos...');
    for (const [storageKey, photoHashes] of Object.entries(exportData.photos)) {
      try {
        const existingPhotos = await loadPhotosByStorageKey(storageKey);
        const existingSet = new Set(existingPhotos);
        const newHashes = photoHashes.filter(hash => !existingSet.has(hash));
        
        if (newHashes.length === 0 && opts.skipDuplicates) {
          summary.photos.skipped++;
          continue;
        }
        
        const mergedPhotos = opts.overwriteExisting 
          ? photoHashes 
          : [...existingPhotos, ...newHashes];
        
        await savePhotosByStorageKey(storageKey, mergedPhotos);
        summary.photos.imported += newHashes.length;
        if (newHashes.length === 0) {
          summary.photos.skipped++;
        }
      } catch (error) {
        console.error(`Error importing photos for ${storageKey}:`, error);
        summary.photos.skipped++;
      }
    }
    console.log('[BulkImport] Photos import complete:', summary.photos);

    console.log('[BulkImport] Import complete:', summary);
    return summary;
  } catch (error) {
    console.error('Error importing all data:', error);
    throw error;
  }
}

/**
 * Parse JSON export data
 */
export function parseExportJson(jsonString: string): BulkExportData {
  try {
    const data = JSON.parse(jsonString);
    
    // Validate structure
    if (!data.version || !data.exportDate) {
      throw new Error('Invalid export format: missing version or exportDate');
    }
    
    return data as BulkExportData;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid JSON format');
    }
    throw error;
  }
}

