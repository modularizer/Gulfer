/**
 * User/Player storage service
 * Uses Drizzle ORM directly
 * Note: Users and Players are the same entity, stored in the players table
 */

import { schema, getDatabase } from './db';
import { eq } from 'drizzle-orm';
import { generateUUID } from '@/utils/uuid';

export type User = typeof schema.players.$inferSelect;
export type UserInsert = typeof schema.players.$inferInsert;

export function generateUserId(): string {
  return generateUUID();
}

export async function getAllUsers(): Promise<User[]> {
  const db = await getDatabase();
  return await db.select()
    .from(schema.players)
    .where(eq(schema.players.isTeam, false));
}

export async function getUserById(userId: string): Promise<User | null> {
  const db = await getDatabase();
  const results = await db.select()
    .from(schema.players)
    .where(eq(schema.players.id, userId))
    .limit(1);
  
  return results[0] ?? null;
}

export async function getUserByName(userName: string): Promise<User | null> {
  const db = await getDatabase();
  const results = await db.select()
    .from(schema.players)
    .where(eq(schema.players.name, userName))
    .limit(1);
  
  return results[0] ?? null;
}

export async function getUserIdForPlayerName(playerName: string): Promise<string> {
  const existing = await getUserByName(playerName);
  if (existing) {
    return existing.id;
  }
  return generateUserId();
}

export async function saveUser(user: UserInsert): Promise<void> {
  const db = await getDatabase();
  
  await db.insert(schema.players).values({
    ...user,
    isTeam: user.isTeam ?? false,
  }).onConflictDoUpdate({
    target: schema.players.id,
    set: user,
  });
}

