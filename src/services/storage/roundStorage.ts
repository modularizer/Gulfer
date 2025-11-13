/**
 * Storage service for managing rounds locally
 * Uses GenericStorageService for common operations
 */

import { defaultStorageDriver } from './drivers';
import { Round, roundSchema, Score, Player } from '@/types';
import { generateUniqueUUID } from '../../utils/uuid';
import { getAllCourses, getCourseById, getCourseByName } from './courseStorage';
import { saveUserRoundByUserAndRound, getUserRoundsByRoundId } from './userRoundStorage';
import { saveScores } from './scoreStorage';
import { getAllUsers } from './userStorage';
import { addPhotosToEntity } from './photoStorage';
import { TableDriver } from '@services/storage/orm/TableDriver';

const ROUNDS_STORAGE_KEY = '@gulfer_rounds';
const ROUNDS_MIGRATION_VERSION_KEY = '@gulfer_rounds_migration_version';
const CURRENT_MIGRATION_VERSION = 5; // Increment when adding new migrations (2 = courseName removal, 3 = scores removal, 4 = players removal, 5 = photos removal)

// Create generic storage service instance for rounds
const roundStorage = new TableDriver<Round>({
  storageKey: ROUNDS_STORAGE_KEY,
  schema: roundSchema,
  entityName: 'Round',
  generatedFields: [
    { field: 'id' },
  ],
  uniqueFields: ['id'],
  cleanupBeforeSave: (round: Round) => {
    // Remove legacy fields (courseName, scores, players, photos, title) if present
    const cleaned = { ...round };
    delete (cleaned as any).courseName;
    delete (cleaned as any).scores;
    delete (cleaned as any).players;
    delete (cleaned as any).photos;
    delete (cleaned as any).title;
    return cleaned;
  },
  foreignKeys: [
    {
      field: 'roundId',
      referencesStorageKey: '@gulfer_user_rounds',
      cascadeDelete: true, // Delete all UserRounds when round is deleted
    },
    {
      field: 'roundId',
      referencesStorageKey: '@gulfer_scores',
      cascadeDelete: true, // Delete all Scores when round is deleted
    },
    {
      field: 'refId',
      referencesStorageKey: '@gulfer_photos',
      cascadeDelete: true, // Delete all Photos when round is deleted (polymorphic)
      findChildren: (roundId: string, allPhotos: any[]) => {
        return allPhotos.filter(photo => photo.refId === roundId);
      },
    },
  ],
});

/**
 * Migration: Remove players field from all rounds
 * Players are now computed from UserRound entities
 */
export async function migrateRoundsRemovePlayers(): Promise<{ migrated: number; failed: number }> {
  try {
    // Check if migration has already been run
    const migrationVersion = await defaultStorageDriver.getItem(ROUNDS_MIGRATION_VERSION_KEY);
    if (migrationVersion && parseInt(migrationVersion, 10) >= CURRENT_MIGRATION_VERSION) {
      console.log('[Migration] Rounds players removal migration already completed');
      return { migrated: 0, failed: 0 };
    }
    
    console.log('[Migration] Starting rounds players removal migration...');
    const data = await defaultStorageDriver.getItem(ROUNDS_STORAGE_KEY);
    if (!data) {
      await defaultStorageDriver.setItem(ROUNDS_MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION.toString());
      return { migrated: 0, failed: 0 };
    }
    
    const rounds = JSON.parse(data);
    let migrated = 0;
    let needsSave = false;
    
    for (const round of rounds) {
      // Remove players field if present
      if (round.players !== undefined) {
        delete round.players;
        migrated++;
        needsSave = true;
      }
    }
    
    // Save all migrated rounds (with players removed)
    if (needsSave) {
      await defaultStorageDriver.setItem(ROUNDS_STORAGE_KEY, JSON.stringify(rounds));
      console.log(`[Migration] Removed players from ${migrated} rounds`);
    }
    
    // Mark migration as complete
    await defaultStorageDriver.setItem(ROUNDS_MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION.toString());
    
    console.log(`[Migration] Rounds players removal complete: ${migrated} rounds migrated`);
    return { migrated, failed: 0 };
  } catch (error) {
    console.error('[Migration] Error migrating rounds players:', error);
    throw error;
  }
}

/**
 * Get course name from courseId
 * Helper function to compute courseName from courseId
 */
export async function getCourseNameFromId(courseId: string | undefined): Promise<string | undefined> {
  if (!courseId) {
    return undefined;
  }
  const course = await getCourseById(courseId);
  return course?.name;
}

/**
 * Get players for a round by computing from UserRound entities
 * This replaces the old round.players field which is now redundant
 */
export async function getPlayersForRound(roundId: string): Promise<Player[]> {
  try {
    const userRounds = await getUserRoundsByRoundId(roundId);
    const allUsers = await getAllUsers();
    const userMap = new Map(allUsers.map(u => [u.id, u]));
    
    const players: Player[] = [];
    for (const userRound of userRounds) {
      const user = userMap.get(userRound.userId);
      if (user) {
        players.push({
          id: user.id,
          name: user.name,
          notes: user.notes, // Include notes from user
        });
      }
    }
    
    return players;
  } catch (error) {
    console.error('Error getting players for round:', error);
    return [];
  }
}

/**
 * Legacy: Auto-populate courseId from courseName if missing (for migration purposes)
 * This handles old data that might still have courseName
 */
async function populateCourseIdFromLegacyName(round: any): Promise<Round> {
  // If courseId is already set, remove courseName and return
  if (round.courseId) {
    const { courseName, ...rest } = round;
    return rest as Round;
  }
  
  // If courseName is set but courseId is missing, look it up (legacy data)
  if (round.courseName) {
    const course = await getCourseByName(round.courseName);
    if (course) {
      const { courseName, ...rest } = round;
      return { ...rest, courseId: course.id } as Round;
    }
  }
  
  // Remove courseName if present
  const { courseName, ...rest } = round;
  return rest as Round;
}

/**
 * Save a round to local storage
 * Validates the round against schema before saving.
 * Removes any legacy courseName and scores fields if present.
 */
export async function saveRound(round: Round): Promise<void> {
  return roundStorage.save(round);
}

/**
 * Get all saved rounds
 */
export async function getAllRounds(): Promise<Round[]> {
  return roundStorage.getAll();
}

/**
 * Get a single round by ID
 */
export async function getRoundById(roundId: string): Promise<Round | null> {
  return roundStorage.getById(roundId);
}

/**
 * Delete a round by ID
 */
export async function deleteRound(roundId: string): Promise<void> {
  try {
    // Retry logic to handle race conditions with pending writes
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      const rounds = await getAllRounds();
      const initialLength = rounds.length;
      const filtered = rounds.filter((r) => r.id !== roundId);
      
      // Verify that a round was actually found and removed
      if (filtered.length === initialLength) {
        // Round not found - verify it's actually gone by reading back
        // This handles the case where we read stale data due to a pending write
        if (attempts < maxAttempts - 1) {
          // Wait a bit and retry in case there's a pending write
          await new Promise(resolve => setTimeout(resolve, 50));
          attempts++;
          continue;
        }
        // On final attempt, check if round exists by reading back
        const verifyRounds = await getAllRounds();
        const roundStillExists = verifyRounds.some((r) => r.id === roundId);
        if (!roundStillExists) {
          // Round is already deleted, consider it success
          return;
        }
        console.warn(`Round with ID "${roundId}" not found for deletion`);
        return; // Round doesn't exist, consider it already deleted
      }
      
      // Write the filtered list
      await defaultStorageDriver.setItem(ROUNDS_STORAGE_KEY, JSON.stringify(filtered));
      
      // Verify the write succeeded by reading back
      // This ensures the IndexedDB transaction is fully committed
      let verified = false;
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 20));
        const verifyRounds = await getAllRounds();
        const roundStillExists = verifyRounds.some((r) => r.id === roundId);
        if (!roundStillExists) {
          verified = true;
          break;
        }
      }
      
      if (verified) {
        return; // Successfully deleted and verified
      }
      
      // If verification failed, retry the deletion
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    // If we get here, all attempts failed
    throw new Error(`Failed to delete round "${roundId}" after ${maxAttempts} attempts`);
  } catch (error) {
    console.error('Error deleting round:', error);
    throw error;
  }
}

/**
 * Delete multiple rounds by IDs (more efficient than calling deleteRound multiple times)
 */
export async function deleteRounds(roundIds: string[]): Promise<void> {
  try {
    // Retry logic to handle race conditions with pending writes
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      const rounds = await getAllRounds();
      const initialLength = rounds.length;
      const filtered = rounds.filter((r) => !roundIds.includes(r.id));
      
      if (filtered.length === initialLength) {
        // No rounds found to delete - verify they're actually gone
        if (attempts < maxAttempts - 1) {
          // Wait a bit and retry in case there's a pending write
          await new Promise(resolve => setTimeout(resolve, 50));
          attempts++;
          continue;
        }
        // On final attempt, check if any rounds still exist
        const verifyRounds = await getAllRounds();
        const roundsStillExist = roundIds.some(id => 
          verifyRounds.some((r) => r.id === id)
        );
        if (!roundsStillExist) {
          // Rounds are already deleted, consider it success
          return;
        }
        console.warn(`None of the provided round IDs were found for deletion`);
        return;
      }
      
      // Write the filtered list
      await defaultStorageDriver.setItem(ROUNDS_STORAGE_KEY, JSON.stringify(filtered));
      
      // Verify the write succeeded by reading back
      // This ensures the IndexedDB transaction is fully committed
      let verified = false;
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 20));
        const verifyRounds = await getAllRounds();
        const roundsStillExist = roundIds.some(id => 
          verifyRounds.some((r) => r.id === id)
        );
        if (!roundsStillExist) {
          verified = true;
          break;
        }
      }
      
      if (verified) {
        return; // Successfully deleted and verified
      }
      
      // If verification failed, retry the deletion
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    // If we get here, all attempts failed
    throw new Error(`Failed to delete rounds after ${maxAttempts} attempts`);
  } catch (error) {
    console.error('Error deleting rounds:', error);
    throw error;
  }
}

/**
 * Generate a new unique round ID (16 hex characters)
 */
export async function generateRoundId(): Promise<string> {
  return roundStorage.generateId();
}

/**
 * Generate a round name from date and time
 */
export function generateRoundName(date: number): string {
  const d = new Date(date);
  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  const formattedDate = d.toLocaleDateString('en-US', dateOptions);
  const formattedTime = d.toLocaleTimeString('en-US', timeOptions);
  return `${formattedDate} @${formattedTime}`;
}

/**
 * Create a new round with auto-generated ID and name
 * Note: Players are not stored in the round - they are managed via UserRound entities
 */
export async function createNewRound(initialData: {
  notes?: string;
  courseId?: string;
  date?: number; // Optional custom date (Unix timestamp)
}): Promise<Round> {
  const date = initialData.date || Date.now();
  const roundId = await generateRoundId();
  const name = generateRoundName(date);

  const newRound: Round = {
    id: roundId,
    name, // baseEntitySchema requires name
    date,
    notes: initialData.notes,
    courseId: initialData.courseId,
  };

  await saveRound(newRound);
  return newRound;
}

/**
 * Migration: Remove courseName from all rounds and ensure courseId is set
 * This migration:
 * 1. Backfills courseId from courseName if missing
 * 2. Removes courseName field from all rounds
 */
export async function migrateRoundsRemoveCourseName(): Promise<{ migrated: number; failed: number }> {
  try {
    // Check if migration has already been run
    const migrationVersion = await defaultStorageDriver.getItem(ROUNDS_MIGRATION_VERSION_KEY);
    if (migrationVersion && parseInt(migrationVersion, 10) >= CURRENT_MIGRATION_VERSION) {
      console.log('[Migration] Rounds courseName removal migration already completed');
      return { migrated: 0, failed: 0 };
    }
    
    console.log('[Migration] Starting rounds courseName removal migration...');
    const data = await defaultStorageDriver.getItem(ROUNDS_STORAGE_KEY);
    if (!data) {
      await defaultStorageDriver.setItem(ROUNDS_MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION.toString());
      return { migrated: 0, failed: 0 };
    }
    
    const rounds = JSON.parse(data);
    const courses = await getAllCourses();
    const courseNameToId = new Map<string, string>();
    
    // Build a map of course name to course ID
    for (const course of courses) {
      courseNameToId.set(course.name.trim().toLowerCase(), course.id);
    }
    
    let migrated = 0;
    let failed = 0;
    let needsSave = false;
    
    for (const round of rounds) {
      let hasChanges = false;
      
      // If courseName exists but courseId doesn't, try to populate courseId
      if (round.courseName && !round.courseId) {
        const normalizedName = round.courseName.trim().toLowerCase();
        const courseId = courseNameToId.get(normalizedName);
        
        if (courseId) {
          round.courseId = courseId;
          hasChanges = true;
        } else {
          // Try direct lookup as fallback
          const course = await getCourseByName(round.courseName);
          if (course) {
            round.courseId = course.id;
            hasChanges = true;
          } else {
            console.warn(`[Migration] Could not find course for round ${round.id} with courseName: ${round.courseName}`);
            failed++;
          }
        }
      }
      
      // Remove courseName field if present
      if (round.courseName !== undefined) {
        delete round.courseName;
        hasChanges = true;
      }
      
      if (hasChanges) {
        migrated++;
        needsSave = true;
      }
    }
    
    // Save all migrated rounds
    if (needsSave) {
      await defaultStorageDriver.setItem(ROUNDS_STORAGE_KEY, JSON.stringify(rounds));
      console.log(`[Migration] Saved ${migrated} migrated rounds`);
    }
    
    // Mark migration as complete
    await defaultStorageDriver.setItem(ROUNDS_MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION.toString());
    
    console.log(`[Migration] Rounds courseName removal complete: ${migrated} migrated, ${failed} failed`);
    return { migrated, failed };
  } catch (error) {
    console.error('[Migration] Error migrating rounds:', error);
    throw error;
  }
}

/**
 * Migration: Split scores from rounds into UserRound entities
 * This migration:
 * 1. Reads all rounds that have scores
 * 2. Creates UserRound entities for each player's scores
 * 3. Removes scores field from rounds
 */
export async function migrateRoundsSplitScores(): Promise<{ migrated: number; failed: number }> {
  try {
    // Check if migration has already been run
    const migrationVersion = await defaultStorageDriver.getItem(ROUNDS_MIGRATION_VERSION_KEY);
    if (migrationVersion && parseInt(migrationVersion, 10) >= CURRENT_MIGRATION_VERSION) {
      console.log('[Migration] Rounds scores split migration already completed');
      return { migrated: 0, failed: 0 };
    }
    
    console.log('[Migration] Starting rounds scores split migration...');
    const data = await defaultStorageDriver.getItem(ROUNDS_STORAGE_KEY);
    if (!data) {
      await defaultStorageDriver.setItem(ROUNDS_MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION.toString());
      return { migrated: 0, failed: 0 };
    }
    
    const rounds = JSON.parse(data);
    let migrated = 0;
    let failed = 0;
    let needsSave = false;
    
    for (const round of rounds) {
      // Check if this round has scores to migrate
      if (round.scores && Array.isArray(round.scores) && round.scores.length > 0) {
        try {
          // Group scores by playerId
          const scoresByPlayer = new Map<string, Score[]>();
          
          for (const score of round.scores) {
            // Legacy scores have playerId, new scores don't
            const playerId = (score as any).playerId;
            if (!playerId) {
              console.warn(`[Migration] Score missing playerId in round ${round.id}, skipping`);
              failed++;
              continue;
            }
            
            if (!scoresByPlayer.has(playerId)) {
              scoresByPlayer.set(playerId, []);
            }
            
            // Convert legacy score format (with playerId) to new format (with userId and roundId)
            scoresByPlayer.get(playerId)!.push({
              holeNumber: score.holeNumber,
              throws: score.throws,
              complete: (score as any).complete !== undefined ? (score as any).complete : true, // Default to complete for legacy
              userId: playerId,
              roundId: round.id,
            });
          }
          
          // Create UserRound for each player and save scores separately
          for (const [playerId, scores] of scoresByPlayer.entries()) {
            // Create UserRound (without scores - scores are stored separately)
            await saveUserRoundByUserAndRound(playerId, round.id);
            
            // Save scores in separate table
            await saveScores(scores);
            migrated++;
          }
          
          // Remove scores from round
          delete round.scores;
          needsSave = true;
        } catch (error) {
          console.error(`[Migration] Error migrating scores for round ${round.id}:`, error);
          failed++;
        }
      }
    }
    
    // Save all migrated rounds (with scores removed)
    if (needsSave) {
      await defaultStorageDriver.setItem(ROUNDS_STORAGE_KEY, JSON.stringify(rounds));
      console.log(`[Migration] Saved ${migrated} user rounds and removed scores from rounds`);
    }
    
    // Mark migration as complete
    await defaultStorageDriver.setItem(ROUNDS_MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION.toString());
    
    console.log(`[Migration] Rounds scores split complete: ${migrated} user rounds created, ${failed} failed`);
    return { migrated, failed };
  } catch (error) {
    console.error('[Migration] Error migrating rounds scores:', error);
    throw error;
  }
}

/**
 * Migration: Remove photos field from all rounds and move to photos table
 * Photos are now stored in a separate table and referenced via refId
 */
export async function migrateRoundsRemovePhotos(): Promise<{ migrated: number; failed: number }> {
  try {
    // Check if migration has already been run
    const migrationVersion = await defaultStorageDriver.getItem(ROUNDS_MIGRATION_VERSION_KEY);
    if (migrationVersion && parseInt(migrationVersion, 10) >= CURRENT_MIGRATION_VERSION) {
      console.log('[Migration] Rounds photos removal migration already completed');
      return { migrated: 0, failed: 0 };
    }
    
    console.log('[Migration] Starting rounds photos removal migration...');
    const data = await defaultStorageDriver.getItem(ROUNDS_STORAGE_KEY);
    if (!data) {
      await defaultStorageDriver.setItem(ROUNDS_MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION.toString());
      return { migrated: 0, failed: 0 };
    }
    
    const rounds = JSON.parse(data);
    let migrated = 0;
    let failed = 0;
    let needsSave = false;
    
    for (const round of rounds) {
      // Check if this round has photos to migrate
      if (round.photos && Array.isArray(round.photos) && round.photos.length > 0) {
        try {
          // Move photos to photos table
          await addPhotosToEntity(round.id, round.photos);
          migrated += round.photos.length;
          
          // Remove photos from round
          delete round.photos;
          needsSave = true;
        } catch (error) {
          console.error(`[Migration] Error migrating photos for round ${round.id}:`, error);
          failed++;
        }
      } else if (round.photos !== undefined) {
        // Remove photos field even if it's empty
        delete round.photos;
        needsSave = true;
      }
    }
    
    // Save all migrated rounds (with photos removed)
    if (needsSave) {
      await defaultStorageDriver.setItem(ROUNDS_STORAGE_KEY, JSON.stringify(rounds));
      console.log(`[Migration] Moved ${migrated} photos to photos table and removed photos from rounds`);
    }
    
    // Mark migration as complete
    await defaultStorageDriver.setItem(ROUNDS_MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION.toString());
    
    console.log(`[Migration] Rounds photos removal complete: ${migrated} photos migrated, ${failed} failed`);
    return { migrated, failed };
  } catch (error) {
    console.error('[Migration] Error migrating rounds photos:', error);
    throw error;
  }
}

/**
 * Run all round migrations in order
 * This is the main entry point for migrations
 */
export async function migrateRoundsCourseId(): Promise<void> {
  try {
    // Run migrations in order (they check their own version internally)
    await migrateRoundsRemoveCourseName();
    await migrateRoundsSplitScores();
    await migrateRoundsRemovePlayers();
    await migrateRoundsRemovePhotos();
  } catch (error) {
    console.error('[Migration] Error running round migrations:', error);
    throw error;
  }
}

