/**
 * Storage service for managing rounds locally
 * Uses localforage (IndexedDB on web, native storage on mobile) for larger quota support
 */

import { getItem, setItem } from './storageAdapter';
import { Round } from '../../types';
import { generateUniqueUUID } from '../../utils/uuid';

const ROUNDS_STORAGE_KEY = '@gulfer_rounds';

/**
 * Save a round to local storage
 * Note: This function will NOT restore a round that was deleted. If a round doesn't exist,
 * it will only add it if it's a new round (not a deleted one being restored).
 */
export async function saveRound(round: Round, allowRestore: boolean = false): Promise<void> {
  try {
    const rounds = await getAllRounds();
    const existingIndex = rounds.findIndex((r) => r.id === round.id);
    
    if (existingIndex >= 0) {
      // Round exists, update it
      rounds[existingIndex] = round;
    } else {
      // Round doesn't exist - only add it if explicitly allowed (for new rounds)
      // This prevents auto-save from restoring deleted rounds
      if (allowRestore) {
        rounds.push(round);
      } else {
        // Round was deleted or doesn't exist - don't restore it
        console.warn(`Attempted to save round "${round.id}" that doesn't exist. This may be a deleted round being restored by auto-save. Skipping save.`);
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
  };

  await saveRound(newRound, true); // allowRestore=true for new rounds
  return newRound;
}

