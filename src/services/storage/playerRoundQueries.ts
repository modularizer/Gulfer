/**
 * Helper functions for querying playerRounds from the database
 * These queries are optimized for corner statistics and other analytics
 * Uses Drizzle ORM directly - returns database types without transformation
 */

import { schema, getDatabase, type PlayerRoundWithDetails, type Score } from './db';
import { eq, and, sql, gte, lte, inArray } from 'drizzle-orm';

/**
 * Get all playerRounds for a specific course
 * Returns playerRounds with their scores and round information
 */
export async function getPlayerRoundsForCourse(courseId: string): Promise<PlayerRoundWithDetails[]> {
  const db = await getDatabase();
  
  // Query playerRounds with joins
  // Note: Drizzle returns joined results with table names as keys
  const results = await db
    .select()
    .from(schema.playerRounds)
    .innerJoin(schema.rounds, eq(schema.playerRounds.roundId, schema.rounds.id))
    .innerJoin(schema.players, eq(schema.playerRounds.playerId, schema.players.id))
    .where(eq(schema.rounds.courseId, courseId));
  
  if (results.length === 0) {
    return [];
  }
  
  // Get scores for each playerRound
  const roundIds = Array.from(new Set(results.map(r => r.player_rounds.roundId)));
  const playerIds = Array.from(new Set(results.map(r => r.player_rounds.playerId)));
  
  const allScores = await db
    .select()
    .from(schema.playerRoundHoleScores)
    .where(
      and(
        inArray(schema.playerRoundHoleScores.roundId, roundIds),
        inArray(schema.playerRoundHoleScores.playerId, playerIds)
      )
    );
  
  // Group scores by playerId and roundId
  const scoresByPlayerRound = new Map<string, Score[]>();
  for (const score of allScores) {
    const key = `${score.playerId}:${score.roundId}`;
    if (!scoresByPlayerRound.has(key)) {
      scoresByPlayerRound.set(key, []);
    }
    scoresByPlayerRound.get(key)!.push(score);
  }
  
  // Combine results - use DB types directly
  // Drizzle returns joined results with table names as keys
  return results.map(r => {
    const key = `${r.player_rounds.playerId}:${r.player_rounds.roundId}`;
    const scores = scoresByPlayerRound.get(key) || [];
    
    return {
      playerRound: r.player_rounds,
      round: r.rounds,
      player: {
        id: r.players.id,
        name: r.players.name,
      },
      scores,
    };
  });
}

/**
 * Get completed playerRounds for a specific course
 * A playerRound is considered complete if the player has scores for all expected holes
 */
export async function getCompletedPlayerRoundsForCourse(
  courseId: string,
  expectedHoleCount?: number
): Promise<PlayerRoundWithDetails[]> {
  const allPlayerRounds = await getPlayerRoundsForCourse(courseId);
  
  // If expectedHoleCount not provided, calculate from holes
  let holeCount: number;
  if (expectedHoleCount === undefined) {
    holeCount = await getExpectedHoleCount(courseId);
  } else {
    holeCount = expectedHoleCount;
  }
  
  // Filter to only completed playerRounds
  return allPlayerRounds.filter(ur => {
    const completedScores = ur.scores.filter(s => s.complete);
    const uniqueHoles = new Set(completedScores.map(s => s.holeNumber));
    return uniqueHoles.size >= holeCount;
  });
}

/**
 * Get playerRounds filtered by date range
 */
export async function getPlayerRoundsForCourseInDateRange(
  courseId: string,
  sinceDate?: number,
  untilDate?: number,
  beforeDate?: number // Exclude rounds on or after this date
): Promise<PlayerRoundWithDetails[]> {
  const db = await getDatabase();
  
  const roundConditions = [eq(schema.rounds.courseId, courseId)];
  
  if (sinceDate !== undefined) {
    roundConditions.push(gte(schema.rounds.date, sinceDate));
  }
  
  if (untilDate !== undefined) {
    roundConditions.push(lte(schema.rounds.date, untilDate));
  }
  
  if (beforeDate !== undefined) {
    roundConditions.push(sql`${schema.rounds.date} < ${beforeDate}`);
  }
  
  // Query playerRounds with joins
  // Note: Drizzle returns joined results with table names as keys
  const results = await db
    .select()
    .from(schema.playerRounds)
    .innerJoin(schema.rounds, eq(schema.playerRounds.roundId, schema.rounds.id))
    .innerJoin(schema.players, eq(schema.playerRounds.playerId, schema.players.id))
    .where(and(...roundConditions));
  
  if (results.length === 0) {
    return [];
  }
  
  // Get scores
  const roundIds = Array.from(new Set(results.map(r => r.player_rounds.roundId)));
  const playerIds = Array.from(new Set(results.map(r => r.player_rounds.playerId)));
  
  const allScores = await db
    .select()
    .from(schema.playerRoundHoleScores)
    .where(
      and(
        inArray(schema.playerRoundHoleScores.roundId, roundIds),
        inArray(schema.playerRoundHoleScores.playerId, playerIds)
      )
    );
  
  // Group scores by playerId and roundId
  const scoresByPlayerRound = new Map<string, Score[]>();
  for (const score of allScores) {
    const key = `${score.playerId}:${score.roundId}`;
    if (!scoresByPlayerRound.has(key)) {
      scoresByPlayerRound.set(key, []);
    }
    scoresByPlayerRound.get(key)!.push(score);
  }
  
  // Combine results - use DB types directly
  // Drizzle returns joined results with table names as keys
  return results.map(r => {
    const key = `${r.player_rounds.playerId}:${r.player_rounds.roundId}`;
    const scores = scoresByPlayerRound.get(key) || [];
    
    return {
      playerRound: r.player_rounds,
      round: r.rounds,
      player: {
        id: r.players.id,
        name: r.players.name,
      },
      scores,
    };
  });
}

/**
 * Get expected hole count for a course
 */
export async function getExpectedHoleCount(courseId: string): Promise<number> {
  const db = await getDatabase();
  const holes = await db
    .select()
    .from(schema.holes)
    .where(eq(schema.holes.courseId, courseId));
  return holes.length;
}

