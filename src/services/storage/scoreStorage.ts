/**
 * Storage service for managing Score entities
 * Scores are stored in their own table for better query performance
 * Uses GenericStorageService for common operations
 */

import { Score, scoreSchema } from '@/types';
import { TableDriver } from '@services/storage/relations/TableDriver';

const SCORES_STORAGE_KEY = '@gulfer_scores';

// Create generic storage service instance for scores
// Note: Scores don't have a name field, so we disable name uniqueness checking
const scoreStorage = new TableDriver<Score>({
  storageKey: SCORES_STORAGE_KEY,
  schema: scoreSchema,
  entityName: 'Score',
  checkNameUniqueness: false, // Scores don't have names
  generatedFields: [
    { field: 'id' },
  ],
  uniqueFields: ['id'],
  uniqueFieldCombos: [['userId', 'roundId', 'holeNumber']],
  findExisting: (score: Score, allScores: Score[]) => {
    // Find existing score by userId, roundId, and holeNumber (not just ID)
    return allScores.findIndex(s => 
      s.userId === score.userId &&
      s.roundId === score.roundId &&
      s.holeNumber === score.holeNumber
    );
  },
});

/**
 * Get all scores
 */
export async function getAllScores(): Promise<Score[]> {
  return scoreStorage.getAll();
}

/**
 * Get scores by userId and roundId
 */
export async function getScoresByUserAndRound(
  userId: string,
  roundId: string
): Promise<Score[]> {
  return scoreStorage.filter(s => s.userId === userId && s.roundId === roundId);
}

/**
 * Get scores by roundId
 */
export async function getScoresByRoundId(roundId: string): Promise<Score[]> {
  return scoreStorage.filter(s => s.roundId === roundId);
}

/**
 * Get scores by userId
 */
export async function getScoresByUserId(userId: string): Promise<Score[]> {
  return scoreStorage.filter(s => s.userId === userId);
}

/**
 * Get score by userId, roundId, and holeNumber
 */
export async function getScoreByUserRoundAndHole(
  userId: string,
  roundId: string,
  holeNumber: number
): Promise<Score | null> {
  return scoreStorage.find(s => 
    s.userId === userId && 
    s.roundId === roundId && 
    s.holeNumber === holeNumber
  );
}

/**
 * Save a score
 * If a score already exists for the same userId, roundId, and holeNumber, it will be updated
 */
export async function saveScore(score: Score): Promise<void> {
  return scoreStorage.save(score);
}

/**
 * Save multiple scores at once (more efficient than calling saveScore multiple times)
 */
export async function saveScores(scoresToSave: Score[]): Promise<void> {
  return scoreStorage.saveMany(scoresToSave);
}

/**
 * Delete a score by userId, roundId, and holeNumber
 */
export async function deleteScore(
  userId: string,
  roundId: string,
  holeNumber: number
): Promise<void> {
  const score = await getScoreByUserRoundAndHole(userId, roundId, holeNumber);
  if (score) {
    return scoreStorage.delete(score.id);
  }
}

/**
 * Delete all scores for a specific user and round
 */
export async function deleteScoresByUserAndRound(
  userId: string,
  roundId: string
): Promise<void> {
  const scores = await getAllScores();
  const idsToDelete = scores
    .filter(s => s.userId === userId && s.roundId === roundId)
    .map(s => s.id);
  return scoreStorage.deleteMany(idsToDelete);
}

/**
 * Delete all scores for a specific round
 */
export async function deleteScoresByRoundId(roundId: string): Promise<void> {
  const scores = await getAllScores();
  const idsToDelete = scores.filter(s => s.roundId === roundId).map(s => s.id);
  return scoreStorage.deleteMany(idsToDelete);
}

/**
 * Delete all scores for a specific user
 */
export async function deleteScoresByUserId(userId: string): Promise<void> {
  const scores = await getAllScores();
  const idsToDelete = scores.filter(s => s.userId === userId).map(s => s.id);
  return scoreStorage.deleteMany(idsToDelete);
}

/**
 * Get all scores for a round, grouped by userId
 * Returns a map: userId -> scores array
 */
export async function getScoresByRoundIdGrouped(userId: string): Promise<Map<string, Score[]>> {
  try {
    const scores = await getScoresByRoundId(userId);
    const scoresMap = new Map<string, Score[]>();
    
    for (const score of scores) {
      if (!scoresMap.has(score.userId)) {
        scoresMap.set(score.userId, []);
      }
      scoresMap.get(score.userId)!.push(score);
    }
    
    return scoresMap;
  } catch (error) {
    console.error('Error getting scores grouped by user:', error);
    return new Map();
  }
}

