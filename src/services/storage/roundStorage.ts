/**
 * Round storage service
 * Uses Drizzle ORM directly
 * Note: Rounds are stored separately from playerRounds and scores
 */

import { schema, getDatabase } from './db';
import { eq, inArray } from 'drizzle-orm';
import { generateUUID } from '@/utils/uuid';
import { getCourseById } from './courseStorage';
import type { Player } from './db/types';

export type Round = typeof schema.rounds.$inferSelect;
export type RoundInsert = typeof schema.rounds.$inferInsert;
export type PlayerRound = typeof schema.playerRounds.$inferSelect;
export type PlayerRoundInsert = typeof schema.playerRounds.$inferInsert;
export type Score = typeof schema.playerRoundHoleScores.$inferSelect;
export type ScoreInsert = typeof schema.playerRoundHoleScores.$inferInsert;

/**
 * Round with all related data (players, scores, course name)
 */
export type RoundWithDetails = Round & {
  courseName?: string | null;
  players: Array<{ id: string; name: string }>;
  scores: Score[];
  photos?: string[];
};

export function generateRoundId(): string {
  return generateUUID();
}

export async function getAllRounds(): Promise<Round[]> {
  const db = await getDatabase();
  return await db.select().from(schema.rounds);
}

/**
 * Get all rounds with related data (players, scores, course name, photos)
 * More efficient than calling getRoundWithDetails for each round
 */
export async function getAllRoundsWithDetails(): Promise<RoundWithDetails[]> {
  const db = await getDatabase();
  
  // Get all rounds
  const rounds = await db.select().from(schema.rounds);
  
  if (rounds.length === 0) {
    return [];
  }
  
  const roundIds = rounds.map(r => r.id);
  
  // Get all courses (for course names)
  const courses = await db.select().from(schema.courses);
  const courseMap = new Map(courses.map(c => [c.id, c.name]));
  
  // Get all playerRounds for these rounds
  const playerRounds = roundIds.length > 0
    ? await db
        .select()
        .from(schema.playerRounds)
        .where(inArray(schema.playerRounds.roundId, roundIds))
    : [];
  
  // Get unique player IDs
  const playerIds = Array.from(new Set(playerRounds.map(pr => pr.playerId)));
  
  // Get all players
  const allPlayers = playerIds.length > 0
    ? await db
        .select()
        .from(schema.players)
        .where(playerIds.length === 1 
          ? eq(schema.players.id, playerIds[0])
          : inArray(schema.players.id, playerIds)
        )
    : [];
  
  const playerMap = new Map(allPlayers.map(p => [p.id, { id: p.id, name: p.name }]));
  
  // Get all scores for these rounds
  const allScores = roundIds.length > 0
    ? await db
        .select()
        .from(schema.playerRoundHoleScores)
        .where(inArray(schema.playerRoundHoleScores.roundId, roundIds))
    : [];
  
  // Get all photos for these rounds
  const allPhotos = roundIds.length > 0
    ? await db
        .select()
        .from(schema.photos)
        .where(inArray(schema.photos.refId, roundIds))
    : [];
  
  // Group data by round
  const playerRoundsByRound = new Map<string, typeof playerRounds>();
  for (const pr of playerRounds) {
    if (!playerRoundsByRound.has(pr.roundId)) {
      playerRoundsByRound.set(pr.roundId, []);
    }
    playerRoundsByRound.get(pr.roundId)!.push(pr);
  }
  
  const scoresByRound = new Map<string, typeof allScores>();
  for (const score of allScores) {
    if (!scoresByRound.has(score.roundId)) {
      scoresByRound.set(score.roundId, []);
    }
    scoresByRound.get(score.roundId)!.push(score);
  }
  
  const photosByRound = new Map<string, string[]>();
  for (const photo of allPhotos) {
    if (photo.data && typeof photo.data === 'string') {
      if (!photosByRound.has(photo.refId)) {
        photosByRound.set(photo.refId, []);
      }
      photosByRound.get(photo.refId)!.push(photo.data);
    }
  }
  
  // Build result
  return rounds.map(round => {
    const roundPlayerRounds = playerRoundsByRound.get(round.id) || [];
    const uniquePlayerIds = Array.from(new Set(roundPlayerRounds.map(pr => pr.playerId)));
    const players: Array<{ id: string; name: string }> = uniquePlayerIds
      .map(id => playerMap.get(id))
      .filter((p): p is { id: string; name: string } => p !== undefined);
    
    const scores = scoresByRound.get(round.id) || [];
    const photoUris = photosByRound.get(round.id) || [];
    
    return {
      ...round,
      courseName: round.courseId ? (courseMap.get(round.courseId) ?? null) : null,
      players,
      scores,
      photos: photoUris.length > 0 ? photoUris : undefined,
    };
  });
}

export async function getRoundById(roundId: string): Promise<Round | null> {
  const db = await getDatabase();
  const results = await db.select()
    .from(schema.rounds)
    .where(eq(schema.rounds.id, roundId))
    .limit(1);
  
  return results[0] ?? null;
}

/**
 * Get round with all related data (players, scores, course name, photos)
 */
export async function getRoundWithDetails(roundId: string): Promise<RoundWithDetails | null> {
  const db = await getDatabase();
  
  // Get round
  const roundResults = await db
    .select()
    .from(schema.rounds)
    .where(eq(schema.rounds.id, roundId))
    .limit(1);
  
  if (roundResults.length === 0) {
    return null;
  }
  
  const round = roundResults[0];
  
  // Get course name if courseId exists
  let courseName: string | null = null;
  if (round.courseId) {
    const courseResults = await db
      .select()
      .from(schema.courses)
      .where(eq(schema.courses.id, round.courseId))
      .limit(1);
    if (courseResults.length > 0) {
      courseName = courseResults[0].name;
    }
  }
  
  // Get all playerRounds for this round
  const playerRounds = await db
    .select()
    .from(schema.playerRounds)
    .where(eq(schema.playerRounds.roundId, roundId));
  
  // Get unique player IDs
  const playerIds = Array.from(new Set(playerRounds.map(pr => pr.playerId)));
  
  // Get all players
  const allPlayers = playerIds.length > 0
    ? await db
        .select()
        .from(schema.players)
        .where(playerIds.length === 1 
          ? eq(schema.players.id, playerIds[0])
          : inArray(schema.players.id, playerIds)
        )
    : [];
  
  // Map to the format expected by RoundWithDetails
  const players = allPlayers.map(p => ({
    id: p.id,
    name: p.name,
  }));
  
  // Get all scores for this round
  const scores = await db
    .select()
    .from(schema.playerRoundHoleScores)
    .where(eq(schema.playerRoundHoleScores.roundId, roundId));
  
  // Get photos for this round (if any)
  const photos = await db
    .select()
    .from(schema.photos)
    .where(eq(schema.photos.refId, roundId));
  
  const photoUris = photos
    .map(p => p.data)
    .filter((data): data is string => data !== null && typeof data === 'string');
  
  return {
    ...round,
    courseName: courseName ?? null,
    players,
    scores,
    photos: photoUris.length > 0 ? photoUris : undefined,
  };
}

export async function saveRound(round: RoundInsert): Promise<void> {
  const db = await getDatabase();
  
  await db.insert(schema.rounds).values(round).onConflictDoUpdate({
    target: schema.rounds.id,
    set: round,
  });
}

export async function getAllPlayerRoundsForRound(roundId: string): Promise<PlayerRound[]> {
  const db = await getDatabase();
  return await db.select()
    .from(schema.playerRounds)
    .where(eq(schema.playerRounds.roundId, roundId));
}

export async function savePlayerRoundsForRound(roundId: string, playerRounds: PlayerRoundInsert[]): Promise<void> {
  const db = await getDatabase();
  
  // Delete existing playerRounds for this round
  await db.delete(schema.playerRounds)
    .where(eq(schema.playerRounds.roundId, roundId));
  
  // Insert new playerRounds
  if (playerRounds.length > 0) {
    await db.insert(schema.playerRounds).values(playerRounds);
  }
}

/**
 * Get course name from course ID
 * Returns the course name or undefined if not found
 */
export async function getCourseNameFromId(courseId: string | null | undefined): Promise<string | undefined> {
  if (!courseId) {
    return undefined;
  }
  const course = await getCourseById(courseId);
  return course?.name;
}

/**
 * Get all players for a round
 * Returns array of full Player objects
 */
export async function getPlayersForRound(roundId: string): Promise<Player[]> {
  const db = await getDatabase();
  
  // Get all playerRounds for this round
  const playerRounds = await db
    .select()
    .from(schema.playerRounds)
    .where(eq(schema.playerRounds.roundId, roundId));
  
  if (playerRounds.length === 0) {
    return [];
  }
  
  // Get unique player IDs
  const playerIds = Array.from(new Set(playerRounds.map(pr => pr.playerId)));
  
  // Get all players
  const allPlayers = playerIds.length > 0
    ? await db
        .select()
        .from(schema.players)
        .where(playerIds.length === 1 
          ? eq(schema.players.id, playerIds[0])
          : inArray(schema.players.id, playerIds)
        )
    : [];
  
  return allPlayers;
}

export async function getAllScoresForRound(roundId: string): Promise<Score[]> {
  const db = await getDatabase();
  return await db.select()
    .from(schema.playerRoundHoleScores)
    .where(eq(schema.playerRoundHoleScores.roundId, roundId));
}

export async function saveScoresForRound(roundId: string, scores: ScoreInsert[]): Promise<void> {
  const db = await getDatabase();
  
  // Delete existing scores for this round
  await db.delete(schema.playerRoundHoleScores)
    .where(eq(schema.playerRoundHoleScores.roundId, roundId));
  
  // Insert new scores
  if (scores.length > 0) {
    await db.insert(schema.playerRoundHoleScores).values(scores);
  }
}

export async function deleteRound(roundId: string): Promise<void> {
  const db = await getDatabase();
  
  // Delete scores first (though they should cascade, being explicit is safer)
  await db.delete(schema.playerRoundHoleScores)
    .where(eq(schema.playerRoundHoleScores.roundId, roundId));
  
  // Delete playerRounds
  await db.delete(schema.playerRounds)
    .where(eq(schema.playerRounds.roundId, roundId));
  
  // Delete the round itself
  await db.delete(schema.rounds)
    .where(eq(schema.rounds.id, roundId));
}
