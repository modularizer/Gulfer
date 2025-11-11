/**
 * Service for computing hole-level statistics across all rounds
 */

import { Round, Score } from '../types';
import { getAllRounds } from './storage/roundStorage';

export interface HoleStatistics {
  worst: number | null;      // Worst (maximum) score
  p25: number | null;        // 25th percentile: better than worst 25% (25% of scores are HIGHER/worse than this)
  p50: number | null;        // 50th percentile / median
  p75: number | null;        // 75th percentile: better than worst 75% (75% of scores are HIGHER/worse than this)
  best: number | null;        // Best (minimum) score
}

/**
 * Calculate percentile from sorted array (ascending - lower is better)
 * 
 * IMPORTANT: For golf/disc golf, lower scores are better, so percentiles are inverted.
 * 
 * In golf, "Xth percentile" means "better than the worst X% of scores",
 * which means "X% of scores are HIGHER (worse) than this value".
 * 
 * This is the OPPOSITE of the standard percentile definition where "Xth percentile"
 * means "X% of values are at or below this value".
 * 
 * To get the golf percentile, we calculate the (100-X)th traditional percentile:
 * - 25th percentile (golf) = 75th percentile (traditional) = 75% at or below = 25% are HIGHER
 * - 75th percentile (golf) = 25th percentile (traditional) = 25% at or below = 75% are HIGHER
 * 
 * @param sortedScores - Scores sorted ascending (lower is better)
 * @param percentile - The percentile to calculate (0-100), where X means "X% are HIGHER/worse"
 */
function calculatePercentile(sortedScores: number[], percentile: number): number {
  if (sortedScores.length === 0) return 0;
  
  // Invert the percentile: for golf, Xth percentile means X% are HIGHER, so we use (100-X)th traditional percentile
  const traditionalPercentile = 100 - percentile;
  
  // Use linear interpolation for more accurate percentile
  const position = (traditionalPercentile / 100) * (sortedScores.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  
  if (lower === upper) {
    return sortedScores[lower];
  }
  
  return Math.round((sortedScores[lower] * (1 - weight) + sortedScores[upper] * weight) * 10) / 10;
}

/**
 * Calculate median from sorted array
 */
function calculateMedian(sortedScores: number[]): number {
  if (sortedScores.length === 0) return 0;
  const mid = Math.floor(sortedScores.length / 2);
  if (sortedScores.length % 2 === 0) {
    return Math.round(((sortedScores[mid - 1] + sortedScores[mid]) / 2) * 10) / 10;
  }
  return sortedScores[mid];
}

/**
 * Compute hole statistics for a specific course and hole
 * Uses all rounds on the course, all players, all time
 */
export async function computeHoleStatistics(
  courseId: string | undefined,
  holeNumber: number,
  currentRoundDate?: number
): Promise<HoleStatistics> {
  if (!courseId) {
    return { worst: null, p25: null, p50: null, p75: null, best: null };
  }

  try {
    // Get all rounds for this course
    const allRounds = await getAllRounds();
    
    // Filter by course and date
    const courseRounds = allRounds.filter(round => {
      // Must be the correct course
      if (round.courseId !== courseId) return false;
      
      // Exclude rounds that started at the same time or after the current round
      if (currentRoundDate !== undefined && round.date >= currentRoundDate) {
        return false;
      }
      
      return true;
    });

    // Collect all non-zero scores for this hole
    const scores: number[] = [];
    for (const round of courseRounds) {
      if (round.scores) {
        for (const score of round.scores) {
          if (score.holeNumber === holeNumber && score.throws > 0) {
            scores.push(score.throws);
          }
        }
      }
    }

    if (scores.length === 0) {
      return { worst: null, p25: null, p50: null, p75: null, best: null };
    }

    // Sort scores (ascending - lower is better)
    const sortedScores = [...scores].sort((a, b) => a - b);

    // Calculate statistics
    const worst = sortedScores[sortedScores.length - 1]; // Maximum (worst) score
    const p25 = calculatePercentile(sortedScores, 25);   // 25th percentile: 25% of scores are HIGHER/worse than this
    const p50 = calculateMedian(sortedScores);            // 50th percentile / median
    const p75 = calculatePercentile(sortedScores, 75);   // 75th percentile: 75% of scores are HIGHER/worse than this
    const best = sortedScores[0];                         // Minimum (best) score

    return {
      worst: worst,
      p25: p25,
      p50: p50,
      p75: p75,
      best: best,
    };
  } catch (error) {
    console.error('Error computing hole statistics:', error);
    return { worst: null, p25: null, p50: null, p75: null, best: null };
  }
}

/**
 * Compute hole statistics for all holes on a course
 */
export async function computeAllHoleStatistics(
  courseId: string | undefined,
  holes: number[],
  currentRoundDate?: number
): Promise<Map<number, HoleStatistics>> {
  const statsMap = new Map<number, HoleStatistics>();
  
  if (!courseId) {
    return statsMap;
  }

  // Compute statistics for each hole in parallel
  const promises = holes.map(async (holeNumber) => {
    const stats = await computeHoleStatistics(courseId, holeNumber, currentRoundDate);
    return { holeNumber, stats };
  });

  const results = await Promise.all(promises);
  for (const { holeNumber, stats } of results) {
    statsMap.set(holeNumber, stats);
  }

  return statsMap;
}

/**
 * Compute total round statistics (G-Stats for cumulative round totals)
 * Calculates statistics on the total score per user round (sum of all holes)
 */
export async function computeTotalRoundStatistics(
  courseId: string | undefined,
  holes: number[],
  currentRoundDate?: number
): Promise<HoleStatistics> {
  if (!courseId) {
    return { worst: null, p25: null, p50: null, p75: null, best: null };
  }

  try {
    // Get all rounds for this course
    const allRounds = await getAllRounds();
    
    // Filter by course and date
    const courseRounds = allRounds.filter(round => {
      // Must be the correct course
      if (round.courseId !== courseId) return false;
      
      // Exclude rounds that started at the same time or after the current round
      if (currentRoundDate !== undefined && round.date >= currentRoundDate) {
        return false;
      }
      
      return true;
    });

    // Collect total scores for each user round (user + round combination)
    const totalScores: number[] = [];
    
    for (const round of courseRounds) {
      if (round.scores && round.players) {
        for (const player of round.players) {
          const playerScores = round.scores.filter(s => s.playerId === player.id);
          const total = playerScores.reduce((sum, s) => sum + s.throws, 0);
          
          // Only include if total is > 0 (has at least one score)
          if (total > 0) {
            totalScores.push(total);
          }
        }
      }
    }

    if (totalScores.length === 0) {
      return { worst: null, p25: null, p50: null, p75: null, best: null };
    }

    // Sort scores (ascending - lower is better)
    const sortedScores = [...totalScores].sort((a, b) => a - b);

    // Calculate statistics
    const worst = sortedScores[sortedScores.length - 1]; // Maximum (worst) total
    const p25 = calculatePercentile(sortedScores, 25);   // 25th percentile: 25% of totals are HIGHER/worse than this
    const p50 = calculateMedian(sortedScores);            // 50th percentile / median
    const p75 = calculatePercentile(sortedScores, 75);   // 75th percentile: 75% of totals are HIGHER/worse than this
    const best = sortedScores[0];                         // Minimum (best) total

    return {
      worst: worst,
      p25: p25,
      p50: p50,
      p75: p75,
      best: best,
    };
  } catch (error) {
    console.error('Error computing total round statistics:', error);
    return { worst: null, p25: null, p50: null, p75: null, best: null };
  }
}

