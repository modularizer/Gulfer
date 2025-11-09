/**
 * Utilities for converting between numeric IDs and codenames
 * Courses use IDs ending in 0 (0, 10, 20, 30, etc.)
 * Rounds use IDs ending in 1 (1, 11, 21, 31, etc.)
 */

import { numberToName, nameToNumber } from './nameGenerator';

/**
 * Convert a numeric ID to a codename for use in URLs
 */
export function idToCodename(id: number): string {
  return numberToName(id);
}

/**
 * Convert a codename from URL back to numeric ID
 */
export function codenameToId(codename: string, maxSearch: number = 1000000): number | null {
  return nameToNumber(codename, maxSearch);
}

/**
 * Get the next available course ID (ending in 0)
 */
export async function getNextCourseId(): Promise<number> {
  const { getAllCourses } = await import('../services/storage/courseStorage');
  const courses = await getAllCourses();
  
  // Extract numeric IDs from courses
  const courseIds = courses
    .map(c => c.id)
    .filter((id): id is number => id % 10 === 0);
  
  if (courseIds.length === 0) {
    return 0; // First course gets ID 0
  }
  
  // Find the highest ID and add 10
  const maxId = Math.max(...courseIds);
  return maxId + 10;
}

/**
 * Get the next available round ID (ending in 1)
 */
export async function getNextRoundId(): Promise<number> {
  const { getAllRounds } = await import('../services/storage/roundStorage');
  const rounds = await getAllRounds();
  
  // Extract numeric IDs from rounds
  const roundIds = rounds
    .map(r => r.id)
    .filter((id): id is number => id % 10 === 1);
  
  if (roundIds.length === 0) {
    return 1; // First round gets ID 1
  }
  
  // Find the highest ID and add 10
  const maxId = Math.max(...roundIds);
  return maxId + 10;
}

/**
 * Get the next available user ID (ending in 2)
 */
export async function getNextUserId(): Promise<number> {
  const { getAllUsers } = await import('../services/storage/userStorage');
  const users = await getAllUsers();
  
  // Extract numeric IDs from users
  const userIds = users
    .map(u => u.id)
    .filter((id): id is number => id % 10 === 2);
  
  if (userIds.length === 0) {
    return 2; // First user gets ID 2
  }
  
  // Find the highest ID and add 10
  const maxId = Math.max(...userIds);
  return maxId + 10;
}

