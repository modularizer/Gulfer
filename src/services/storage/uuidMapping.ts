/**
 * Manual UUID Mapping API
 * Allows users to manually map foreign entities to local entities
 * Useful when automatic name matching doesn't work or user wants to merge differently
 */

import { mapForeignToLocal, getLocalUuidForForeign, getForeignEntitiesForLocal } from './uuidMerge';
import { getAllCourses, getCourseById } from './courseStorage';
import { getAllUsers, getUserById } from './userStorage';

/**
 * Manually map a foreign course to a local course
 * This allows saying "foreign course X (from storage Y) is the same as my local course Z"
 * 
 * @param foreignStorageId - Storage UUID where the foreign course came from
 * @param foreignCourseId - Course UUID in the foreign storage
 * @param localCourseId - Local course UUID to map to
 */
export async function mapForeignCourseToLocal(
  foreignStorageId: string,
  foreignCourseId: string,
  localCourseId: string
): Promise<void> {
  await mapForeignToLocal(foreignStorageId, foreignCourseId, localCourseId, 'course');
}

/**
 * Manually map a foreign player to a local player
 * 
 * @param foreignStorageId - Storage UUID where the foreign player came from
 * @param foreignPlayerId - Player UUID in the foreign storage
 * @param localPlayerId - Local player UUID to map to
 */
export async function mapForeignPlayerToLocal(
  foreignStorageId: string,
  foreignPlayerId: string,
  localPlayerId: string
): Promise<void> {
  await mapForeignToLocal(foreignStorageId, foreignPlayerId, localPlayerId, 'player');
}

/**
 * Get information about a foreign course for display
 * Returns the course name if available, or just the UUID
 */
export async function getForeignCourseInfo(
  foreignStorageId: string,
  foreignCourseId: string
): Promise<{ id: string; name?: string }> {
  // Check if already mapped
  const localId = await getLocalUuidForForeign(foreignStorageId, foreignCourseId, 'course');
  if (localId) {
    const course = await getCourseById(localId);
    return {
      id: foreignCourseId,
      name: course?.name,
    };
  }
  
  return { id: foreignCourseId };
}

/**
 * Get information about a foreign player for display
 */
export async function getForeignPlayerInfo(
  foreignStorageId: string,
  foreignPlayerId: string
): Promise<{ id: string; name?: string }> {
  // Check if already mapped
  const localId = await getLocalUuidForForeign(foreignStorageId, foreignPlayerId, 'player');
  if (localId) {
    const user = await getUserById(localId);
    return {
      id: foreignPlayerId,
      name: user?.name,
    };
  }
  
  return { id: foreignPlayerId };
}

/**
 * Get all unmapped foreign courses from a specific storage
 * Useful for showing what needs to be mapped during import
 */
export async function getUnmappedForeignCourses(
  foreignStorageId: string
): Promise<Array<{ foreignCourseId: string; courseName?: string }>> {
  // This would need to be tracked during import
  // For now, return empty - could be enhanced to track pending mappings
  return [];
}

/**
 * Get all local courses that could be mapped to
 * Returns all local courses for selection UI
 */
export async function getLocalCoursesForMapping(): Promise<Array<{ id: string; name: string }>> {
  const courses = await getAllCourses();
  return courses.map(c => ({ id: c.id, name: c.name }));
}

/**
 * Get all local players that could be mapped to
 */
export async function getLocalPlayersForMapping(): Promise<Array<{ id: string; name: string }>> {
  const users = await getAllUsers();
  return users.map(u => ({ id: u.id, name: u.name }));
}

