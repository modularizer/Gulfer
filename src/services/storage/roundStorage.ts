/**
 * Round storage service
 * Uses Drizzle ORM directly
 * Note: Rounds are stored separately from playerRounds and scores
 */

import { schema, getDatabase } from './db';
import { eq, inArray } from 'drizzle-orm';
import { generateUUID } from '@/utils/uuid';

export type Round = typeof schema.rounds.$inferSelect;
export type RoundInsert = typeof schema.rounds.$inferInsert;
export type PlayerRound = typeof schema.playerRounds.$inferSelect;
export type PlayerRoundInsert = typeof schema.playerRounds.$inferInsert;
export type Score = typeof schema.playerRoundHoleScores.$inferSelect;
export type ScoreInsert = typeof schema.playerRoundHoleScores.$inferInsert;

export function generateRoundId(): string {
  return generateUUID();
}

export async function getAllRounds(): Promise<Round[]> {
  const db = await getDatabase();
  return await db.select().from(schema.rounds);
}

export async function getRoundById(roundId: string): Promise<Round | null> {
  const db = await getDatabase();
  const results = await db.select()
    .from(schema.rounds)
    .where(eq(schema.rounds.id, roundId))
    .limit(1);
  
  return results[0] ?? null;
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
