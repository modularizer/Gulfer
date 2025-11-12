/**
 * Storage service for managing Hole entities
 * Holes are stored in their own table for better query performance
 * Uses GenericStorageService for common operations
 */

import { setItem } from './drivers';
import { Hole, holeSchema } from '@/types';
import { GenericStorageService } from './GenericStorageService';

const HOLES_STORAGE_KEY = '@gulfer_holes';

// Create generic storage service instance for holes
const holeStorage = new GenericStorageService<Hole>({
  storageKey: HOLES_STORAGE_KEY,
  schema: holeSchema,
  entityName: 'Hole',
  generatedFields: [
    { field: 'id' },
  ],
  uniqueFields: ['id'],
  uniqueFieldCombos: [['courseId', 'number']],
  findExisting: (hole: Hole, allHoles: Hole[]) => {
    // Find existing hole by courseId and number (not just ID)
    return allHoles.findIndex(h => 
      h.courseId === hole.courseId &&
      h.number === hole.number
    );
  },
});

/**
 * Get all holes
 */
export async function getAllHoles(): Promise<Hole[]> {
  return holeStorage.getAll();
}

/**
 * Get hole by ID
 */
export async function getHoleById(holeId: string): Promise<Hole | null> {
  return holeStorage.getById(holeId);
}

/**
 * Get all holes for a specific course
 */
export async function getHolesByCourseId(courseId: string): Promise<Hole[]> {
  try {
    const holes = await getAllHoles();
    return holes.filter((h) => h.courseId === courseId).sort((a, b) => a.number - b.number);
  } catch (error) {
    console.error('Error loading holes for course:', error);
    return [];
  }
}

/**
 * Get hole by courseId and hole number
 */
export async function getHoleByCourseAndNumber(
  courseId: string,
  holeNumber: number
): Promise<Hole | null> {
  try {
    const holes = await getAllHoles();
    return holes.find((h) => h.courseId === courseId && h.number === holeNumber) || null;
  } catch (error) {
    console.error('Error loading hole:', error);
    return null;
  }
}

/**
 * Save a hole
 * If a hole already exists for the same courseId and number, it will be updated
 */
export async function saveHole(hole: Hole): Promise<void> {
  return holeStorage.save(hole);
}

/**
 * Save multiple holes at once (more efficient than calling saveHole multiple times)
 */
export async function saveHoles(holesToSave: Hole[]): Promise<void> {
  return holeStorage.saveMany(holesToSave);
}

/**
 * Delete a hole by ID
 */
export async function deleteHole(holeId: string): Promise<void> {
  return holeStorage.delete(holeId);
}

/**
 * Delete hole by courseId and number
 */
export async function deleteHoleByCourseAndNumber(
  courseId: string,
  holeNumber: number
): Promise<void> {
  try {
    const holes = await getAllHoles();
    const filtered = holes.filter((h) => 
      !(h.courseId === courseId && h.number === holeNumber)
    );
    await setItem(HOLES_STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting hole:', error);
    throw error;
  }
}

/**
 * Delete all holes for a specific course
 */
export async function deleteHolesByCourseId(courseId: string): Promise<void> {
  try {
    const holes = await getAllHoles();
    const filtered = holes.filter((h) => h.courseId !== courseId);
    await setItem(HOLES_STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting holes for course:', error);
    throw error;
  }
}

/**
 * Generate a new unique hole ID (8 hex characters)
 */
export async function generateHoleId(): Promise<string> {
  return holeStorage.generateId();
}

/**
 * Validate that hole numbers for a course are sequential starting from 1
 */
export async function validateHoleNumbersForCourse(courseId: string): Promise<boolean> {
  try {
    const holes = await getHolesByCourseId(courseId);
    if (holes.length === 0) return true; // Empty is valid
    
    const holeNumbers = holes.map(h => h.number).sort((a, b) => a - b);
    for (let i = 0; i < holeNumbers.length; i++) {
      if (holeNumbers[i] !== i + 1) {
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('Error validating hole numbers:', error);
    return false;
  }
}

