/**
 * Storage service for managing UserRound entities
 * UserRound links a user to a round and stores their scores
 * Uses GenericStorageService for common operations
 */

import { setItem } from './drivers';
import { UserRound, userRoundSchema } from '@/types';
import { generateUniqueUUID } from '../../utils/uuid';
import { GenericStorageService } from './GenericStorageService';

const USER_ROUNDS_STORAGE_KEY = '@gulfer_user_rounds';

// Create generic storage service instance for user rounds
const userRoundStorage = new GenericStorageService<UserRound>({
  storageKey: USER_ROUNDS_STORAGE_KEY,
  schema: userRoundSchema,
  entityName: 'UserRound',
  generatedFields: [
    { field: 'id' },
  ],
  uniqueFields: ['id'],
  uniqueFieldCombos: [['userId', 'roundId']],
  cleanupBeforeSave: (userRound: UserRound) => {
    // Remove scores array if present (legacy data - scores are now in separate table)
    const cleaned = { ...userRound };
    delete (cleaned as any).scores;
    return cleaned;
  },
  findExisting: (userRound: UserRound, allUserRounds: UserRound[]) => {
    // Find existing UserRound by userId and roundId (not just ID)
    return allUserRounds.findIndex(ur => 
      ur.userId === userRound.userId && 
      ur.roundId === userRound.roundId
    );
  },
});

/**
 * Get all UserRounds
 */
export async function getAllUserRounds(): Promise<UserRound[]> {
  return userRoundStorage.getAll();
}

/**
 * Get UserRound by ID
 */
export async function getUserRoundById(userRoundId: string): Promise<UserRound | null> {
  return userRoundStorage.getById(userRoundId);
}

/**
 * Get UserRound by userId and roundId
 */
export async function getUserRoundByUserAndRound(
  userId: string,
  roundId: string
): Promise<UserRound | null> {
  return userRoundStorage.find(ur => ur.userId === userId && ur.roundId === roundId);
}

/**
 * Get all UserRounds for a specific round
 */
export async function getUserRoundsByRoundId(roundId: string): Promise<UserRound[]> {
  return userRoundStorage.filter(ur => ur.roundId === roundId);
}

/**
 * Get all UserRounds for a specific user
 */
export async function getUserRoundsByUserId(userId: string): Promise<UserRound[]> {
  return userRoundStorage.filter(ur => ur.userId === userId);
}

/**
 * Save a UserRound to storage
 * Validates the UserRound against schema before saving
 */
export async function saveUserRound(userRound: UserRound): Promise<void> {
  return userRoundStorage.save(userRound);
}

/**
 * Save or update a UserRound by userId and roundId
 * Creates a new UserRound if it doesn't exist, updates if it does
 * Note: Scores should be saved separately using scoreStorage.saveScores()
 */
export async function saveUserRoundByUserAndRound(
  userId: string,
  roundId: string
): Promise<UserRound> {
  try {
    const existing = await getUserRoundByUserAndRound(userId, roundId);
    
    if (existing) {
      // Update existing UserRound (just return it, no changes needed unless frozen status changes)
      return existing;
    } else {
      // Create new UserRound
      const userRoundId = await generateUserRoundId();
      const newUserRound: UserRound = {
        id: userRoundId,
        userId,
        roundId,
        frozen: false,
      };
      await saveUserRound(newUserRound);
      return newUserRound;
    }
  } catch (error) {
    console.error('Error saving user round by user and round:', error);
    throw error;
  }
}

/**
 * Delete a UserRound by ID
 */
export async function deleteUserRound(userRoundId: string): Promise<void> {
  return userRoundStorage.delete(userRoundId);
}

/**
 * Delete all UserRounds for a specific round
 */
export async function deleteUserRoundsByRoundId(roundId: string): Promise<void> {
  const userRounds = await getAllUserRounds();
  const idsToDelete = userRounds.filter(ur => ur.roundId === roundId).map(ur => ur.id);
  return userRoundStorage.deleteMany(idsToDelete);
}

/**
 * Delete all UserRounds for a specific user
 */
export async function deleteUserRoundsByUserId(userId: string): Promise<void> {
  const userRounds = await getAllUserRounds();
  const idsToDelete = userRounds.filter(ur => ur.userId === userId).map(ur => ur.id);
  return userRoundStorage.deleteMany(idsToDelete);
}

/**
 * Generate a new unique UserRound ID (8 hex characters)
 */
export async function generateUserRoundId(): Promise<string> {
  const userRounds = await getAllUserRounds();
  const existingIds = new Set(userRounds.map(ur => ur.id));
  return generateUniqueUUID(existingIds);
}

// Note: Score-related helper functions have been moved to scoreStorage.ts
// Use scoreStorage.getScoresByRoundId() and scoreStorage.getScoresByUserAndRound() instead

