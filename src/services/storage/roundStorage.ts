/**
 * Storage service for managing rounds locally
 * Uses localforage (IndexedDB on web, native storage on mobile) for larger quota support
 */

import { getItem, setItem } from './storageAdapter';
import { Round } from '../../types';
import { generateUniqueUUID } from '../../utils/uuid';
import { getAllCourses, getCourseByName } from './courseStorage';

const ROUNDS_STORAGE_KEY = '@gulfer_rounds';
const ROUNDS_MIGRATION_VERSION_KEY = '@gulfer_rounds_migration_version';
const CURRENT_MIGRATION_VERSION = 1; // Increment when adding new migrations

/**
 * Auto-populate courseId from courseName if missing
 */
async function populateCourseId(round: Round): Promise<Round> {
  // If courseId is already set, no need to populate
  if (round.courseId) {
    return round;
  }
  
  // If courseName is set but courseId is missing, look it up
  if (round.courseName) {
    const course = await getCourseByName(round.courseName);
    if (course) {
      return { ...round, courseId: course.id };
    }
  }
  
  return round;
}

/**
 * Save a round to local storage
 * Note: This function will NOT restore a round that was deleted. If a round doesn't exist,
 * it will only add it if it's a new round (not a deleted one being restored).
 * Automatically populates courseId from courseName if missing.
 */
export async function saveRound(round: Round, allowRestore: boolean = false): Promise<void> {
  try {
    // Auto-populate courseId if missing
    const roundWithCourseId = await populateCourseId(round);
    
    const rounds = await getAllRounds();
    const existingIndex = rounds.findIndex((r) => r.id === roundWithCourseId.id);
    
    if (existingIndex >= 0) {
      // Round exists, update it
      rounds[existingIndex] = roundWithCourseId;
    } else {
      // Round doesn't exist - only add it if explicitly allowed (for new rounds)
      // This prevents auto-save from restoring deleted rounds
      if (allowRestore) {
        rounds.push(roundWithCourseId);
      } else {
        // Round was deleted or doesn't exist - don't restore it
        console.warn(`Attempted to save round "${roundWithCourseId.id}" that doesn't exist. This may be a deleted round being restored by auto-save. Skipping save.`);
        return;
      }
    }
    
    await setItem(ROUNDS_STORAGE_KEY, JSON.stringify(rounds));
  } catch (error: any) {
    console.error('Error saving round:', error);
    
    // Check if it's a quota exceeded error
    if (error?.name === 'QuotaExceededError' || error?.message?.includes('quota') || error?.message?.includes('QuotaExceeded')) {
      const quotaError = new Error('Storage quota exceeded. Please delete some old rounds or remove photos to free up space.');
      (quotaError as any).name = 'QuotaExceededError';
      throw quotaError;
    }
    
    throw error;
  }
}

/**
 * Get all saved rounds
 */
export async function getAllRounds(): Promise<Round[]> {
  try {
    const data = await getItem(ROUNDS_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Error loading rounds:', error);
    return [];
  }
}

/**
 * Get a single round by ID
 */
export async function getRoundById(roundId: string): Promise<Round | null> {
  try {
    const rounds = await getAllRounds();
    return rounds.find((r) => r.id === roundId) || null;
  } catch (error) {
    console.error('Error loading round:', error);
    return null;
  }
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
      await setItem(ROUNDS_STORAGE_KEY, JSON.stringify(filtered));
      
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
      await setItem(ROUNDS_STORAGE_KEY, JSON.stringify(filtered));
      
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
 * Generate a new unique round ID (6 hex characters)
 * Ensures local uniqueness by checking existing rounds
 */
export async function generateRoundId(): Promise<string> {
  const rounds = await getAllRounds();
  const existingIds = new Set(rounds.map(r => r.id));
  return generateUniqueUUID(existingIds);
}

/**
 * Generate a round title from date and time
 */
export function generateRoundTitle(date: number): string {
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
 * Create a new round with auto-generated ID and title
 */
export async function createNewRound(initialData: {
  players: Round['players'];
  notes?: string;
  photos?: string[];
  courseName?: string;
  courseId?: string;
  date?: number; // Optional custom date (Unix timestamp)
}): Promise<Round> {
  const date = initialData.date || Date.now();
  const roundId = await generateRoundId();
  const title = generateRoundTitle(date);

  const newRound: Round = {
    id: roundId,
    title,
    date,
    players: initialData.players,
    scores: [],
    notes: initialData.notes,
    photos: initialData.photos,
    courseName: initialData.courseName,
    courseId: initialData.courseId,
  };

  await saveRound(newRound, true); // allowRestore=true for new rounds
  return newRound;
}

/**
 * Migration: Backfill courseId for all existing rounds
 * This should be run once to migrate existing data
 */
export async function migrateRoundsCourseId(): Promise<{ migrated: number; failed: number }> {
  try {
    // Check if migration has already been run
    const migrationVersion = await getItem(ROUNDS_MIGRATION_VERSION_KEY);
    if (migrationVersion && parseInt(migrationVersion, 10) >= CURRENT_MIGRATION_VERSION) {
      console.log('[Migration] Rounds courseId migration already completed');
      return { migrated: 0, failed: 0 };
    }
    
    console.log('[Migration] Starting rounds courseId migration...');
    const rounds = await getAllRounds();
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
      // Skip if courseId is already set
      if (round.courseId) {
        continue;
      }
      
      // Try to find courseId from courseName
      if (round.courseName) {
        const normalizedName = round.courseName.trim().toLowerCase();
        const courseId = courseNameToId.get(normalizedName);
        
        if (courseId) {
          round.courseId = courseId;
          migrated++;
          needsSave = true;
        } else {
          // Course not found - try direct lookup as fallback
          const course = await getCourseByName(round.courseName);
          if (course) {
            round.courseId = course.id;
            migrated++;
            needsSave = true;
          } else {
            console.warn(`[Migration] Could not find course for round ${round.id} with courseName: ${round.courseName}`);
            failed++;
          }
        }
      } else {
        // No courseName, can't migrate
        failed++;
      }
    }
    
    // Save all migrated rounds
    if (needsSave) {
      await setItem(ROUNDS_STORAGE_KEY, JSON.stringify(rounds));
      console.log(`[Migration] Saved ${migrated} migrated rounds`);
    }
    
    // Mark migration as complete
    await setItem(ROUNDS_MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION.toString());
    
    console.log(`[Migration] Rounds courseId migration complete: ${migrated} migrated, ${failed} failed`);
    return { migrated, failed };
  } catch (error) {
    console.error('[Migration] Error migrating rounds courseId:', error);
    throw error;
  }
}

