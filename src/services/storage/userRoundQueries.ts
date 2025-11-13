/**
 * Helper functions for querying userRounds (playerRounds) from the database
 * These queries are optimized for corner statistics and other analytics
 */

import { schema, getDatabase } from './db';
import { eq, and, sql, gte, lte, inArray } from 'drizzle-orm';

export type PlayerRound = typeof schema.playerRounds.$inferSelect;
export type Round = typeof schema.rounds.$inferSelect;
export type Score = typeof schema.playerRoundHoleScores.$inferSelect;
export type Player = typeof schema.players.$inferSelect;

/**
 * Get all userRounds for a specific course
 * Returns userRounds with their scores and round information
 */
export async function getUserRoundsForCourse(courseId: string): Promise<Array<{
  userRound: PlayerRound;
  round: Round;
  player: { id: string; name: string };
  scores: Score[];
}>> {
  const db = await getDatabase();
  
  // Query playerRounds with joins
  const results = await db
    .select({
      userRound: schema.playerRounds,
      round: schema.rounds,
      player: {
        id: schema.players.id,
        name: schema.players.name,
      },
    })
    .from(schema.playerRounds)
    .innerJoin(schema.rounds, eq(schema.playerRounds.roundId, schema.rounds.id))
    .innerJoin(schema.players, eq(schema.playerRounds.playerId, schema.players.id))
    .where(eq(schema.rounds.courseId, courseId));
  
  // Get scores for each userRound
  const roundIds: string[] = Array.from(new Set(results.map((r: typeof results[0]) => r.userRound.roundId)));
  const playerIds: string[] = Array.from(new Set(results.map((r: typeof results[0]) => r.userRound.playerId)));
  
  const allScores = roundIds.length > 0 && playerIds.length > 0
    ? await db
        .select()
        .from(schema.playerRoundHoleScores)
        .where(
          and(
            inArray(schema.playerRoundHoleScores.roundId, roundIds),
            inArray(schema.playerRoundHoleScores.playerId, playerIds)
          )
        )
    : [];
  
  // Group scores by playerId and roundId
  const scoresByPlayerRound = new Map<string, typeof allScores>();
  for (const score of allScores) {
    const key = `${score.playerId}:${score.roundId}`;
    if (!scoresByPlayerRound.has(key)) {
      scoresByPlayerRound.set(key, []);
    }
    scoresByPlayerRound.get(key)!.push(score);
  }
  
  // Combine results - use DB types directly
  return results.map((r: typeof results[0]) => {
    const key = `${r.userRound.playerId}:${r.userRound.roundId}`;
    const scores = scoresByPlayerRound.get(key) || [];
    
    return {
      userRound: r.userRound,
      round: r.round,
      player: r.player,
      scores,
    };
  });
}

/**
 * Get completed userRounds for a specific course
 * A userRound is considered complete if the player has scores for all expected holes
 */
export async function getCompletedUserRoundsForCourse(
  courseId: string,
  expectedHoleCount?: number
): Promise<Array<{
  userRound: PlayerRound;
  round: Round;
  player: { id: string; name: string };
  scores: Score[];
}>> {
  const allUserRounds = await getUserRoundsForCourse(courseId);
  
  // If expectedHoleCount not provided, calculate from holes
  let holeCount: number;
  if (expectedHoleCount === undefined) {
    const db = await getDatabase();
    const holes = await db
      .select()
      .from(schema.holes)
      .where(eq(schema.holes.courseId, courseId));
    holeCount = holes.length;
  } else {
    holeCount = expectedHoleCount;
  }
  
  // Filter to only completed userRounds
  return allUserRounds.filter(ur => {
    const completedScores = ur.scores.filter(s => s.complete);
    const uniqueHoles = new Set(completedScores.map(s => s.holeNumber));
    return uniqueHoles.size >= holeCount;
  });
}

/**
 * Get userRounds filtered by date range
 */
export async function getUserRoundsForCourseInDateRange(
  courseId: string,
  sinceDate?: number,
  untilDate?: number,
  beforeDate?: number // Exclude rounds on or after this date
): Promise<Array<{
  userRound: PlayerRound;
  round: Round;
  player: { id: string; name: string };
  scores: Score[];
}>> {
  const db = await getDatabase();
  
  let roundConditions = [eq(schema.rounds.courseId, courseId)];
  
  if (sinceDate !== undefined) {
    roundConditions.push(gte(schema.rounds.date, sinceDate));
  }
  
  if (untilDate !== undefined) {
    roundConditions.push(lte(schema.rounds.date, untilDate));
  }
  
  if (beforeDate !== undefined) {
    roundConditions.push(sql`${schema.rounds.date} < ${beforeDate}`);
  }
  
  const results = await db
    .select({
      userRound: schema.playerRounds,
      round: schema.rounds,
      player: {
        id: schema.players.id,
        name: schema.players.name,
      },
    })
    .from(schema.playerRounds)
    .innerJoin(schema.rounds, eq(schema.playerRounds.roundId, schema.rounds.id))
    .innerJoin(schema.players, eq(schema.playerRounds.playerId, schema.players.id))
    .where(and(...roundConditions));
  
  // Get scores
  const roundIds: string[] = Array.from(new Set(results.map((r: typeof results[0]) => r.userRound.roundId)));
  const playerIds: string[] = Array.from(new Set(results.map((r: typeof results[0]) => r.userRound.playerId)));
  
  const allScores = roundIds.length > 0 && playerIds.length > 0
    ? await db
        .select()
        .from(schema.playerRoundHoleScores)
        .where(
          and(
            inArray(schema.playerRoundHoleScores.roundId, roundIds),
            inArray(schema.playerRoundHoleScores.playerId, playerIds)
          )
        )
    : [];
  
  // Group scores
  const scoresByPlayerRound = new Map<string, typeof allScores>();
  for (const score of allScores) {
    const key = `${score.playerId}:${score.roundId}`;
    if (!scoresByPlayerRound.has(key)) {
      scoresByPlayerRound.set(key, []);
    }
    scoresByPlayerRound.get(key)!.push(score);
  }
  
  // Use DB types directly
  return results.map((r: typeof results[0]) => {
    const key = `${r.userRound.playerId}:${r.userRound.roundId}`;
    const scores = scoresByPlayerRound.get(key) || [];
    
    return {
      userRound: r.userRound,
      round: r.round,
      player: r.player,
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

