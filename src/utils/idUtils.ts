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

// Legacy functions removed - app now uses string UUIDs instead of numeric IDs
// getNextCourseId, getNextRoundId, and getNextUserId are no longer needed

