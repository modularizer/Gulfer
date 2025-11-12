/**
 * Storage service for managing courses locally
 * Uses GenericStorageService for common operations
 */

import { Course, courseSchema } from '@/types';
import { getAllRounds } from './roundStorage';
import { saveHoles, generateHoleId } from './holeStorage';
import { TableDriver } from '@services/storage/relations/TableDriver';
import { defaultStorageDriver } from './drivers';

// Re-export Course type from types
export type { Course };

const COURSES_STORAGE_KEY = '@gulfer_courses';

// Create generic storage service instance for courses
const courseStorage = new TableDriver<Course>({
  storageKey: COURSES_STORAGE_KEY,
  schema: courseSchema,
  entityName: 'Course',
  generatedFields: [
    { field: 'id' },
  ],
  uniqueFields: ['id', 'name'],
  cleanupBeforeSave: (course: Course) => {
    // Remove holes array if present (legacy data - holes are now in separate table)
    const cleaned = { ...course };
    delete (cleaned as any).holes;
    return cleaned;
  },
  foreignKeys: [
    {
      field: 'courseId',
      referencesStorageKey: '@gulfer_holes',
      cascadeDelete: true, // Delete all holes when course is deleted
    },
  ],
});

/**
 * Get all saved courses
 */
export async function getAllCourses(): Promise<Course[]> {
  return courseStorage.getAll();
}

/**
 * Get a course by ID
 */
export async function getCourseById(courseId: string): Promise<Course | null> {
  return courseStorage.getById(courseId);
}

/**
 * Get a course by name
 */
export async function getCourseByName(courseName: string): Promise<Course | null> {
  return courseStorage.getByName(courseName);
}

/**
 * Save a course to local storage
 * Enforces local uniqueness of course names
 */
export async function saveCourse(course: Course): Promise<void> {
  return courseStorage.save(course);
}

/**
 * Delete a course by ID
 */
export async function deleteCourse(courseId: string): Promise<void> {
  return courseStorage.delete(courseId);
}

/**
 * Generate a new unique course ID (16 hex characters)
 */
export async function generateCourseId(): Promise<string> {
  return courseStorage.generateId();
}

/**
 * Check if a course name is already taken
 */
export async function isCourseNameAvailable(name: string, excludeCourseId?: string): Promise<boolean> {
  return courseStorage.isNameAvailable(name, excludeCourseId);
}

/**
 * Get the last used course from rounds
 * Returns the course that was used in the most recent round
 */
export async function getLastUsedCourse(): Promise<Course | null> {
  try {
    const rounds = await getAllRounds();
    
    // Find the most recent round with a courseId
    const roundsWithCourse = rounds
      .filter(r => r.courseId)
      .sort((a, b) => b.date - a.date);
    
    if (roundsWithCourse.length === 0) {
      return null;
    }
    
    const lastUsedCourseId = roundsWithCourse[0].courseId;
    if (!lastUsedCourseId) {
      return null;
    }
    
    // Find the course matching the ID
    return await getCourseById(lastUsedCourseId);
  } catch (error) {
    console.error('Error getting last used course:', error);
    return null;
  }
}

/**
 * Get the latest added course (by most recent date if available, otherwise first in list)
 */
export async function getLatestAddedCourse(): Promise<Course | null> {
  try {
    const courses = await getAllCourses();
    if (courses.length === 0) {
      return null;
    }
    
    // Return the last course in the array (most recently added)
    return courses[courses.length - 1] || null;
  } catch (error) {
    console.error('Error getting latest added course:', error);
    return null;
  }
}

const COURSES_MIGRATION_VERSION_KEY = '@gulfer_courses_migration_version';
const CURRENT_COURSES_MIGRATION_VERSION = 1; // Increment when adding new migrations

/**
 * Migration: Split holes from courses into separate table
 * This migration:
 * 1. Reads all courses that have holes arrays
 * 2. Creates Hole entities in the separate table
 * 3. Removes holes field from courses
 */
export async function migrateCoursesSplitHoles(): Promise<{ migrated: number; failed: number }> {
  try {
    // Check if migration has already been run
    const migrationVersion = await defaultStorageDriver.getItem(COURSES_MIGRATION_VERSION_KEY);
    if (migrationVersion && parseInt(migrationVersion, 10) >= CURRENT_COURSES_MIGRATION_VERSION) {
      console.log('[Migration] Courses holes split migration already completed');
      return { migrated: 0, failed: 0 };
    }
    
    console.log('[Migration] Starting courses holes split migration...');
    const data = await defaultStorageDriver.getItem(COURSES_STORAGE_KEY);
    if (!data) {
      await defaultStorageDriver.setItem(COURSES_MIGRATION_VERSION_KEY, CURRENT_COURSES_MIGRATION_VERSION.toString());
      return { migrated: 0, failed: 0 };
    }
    
    const courses = JSON.parse(data);
    let migrated = 0;
    let failed = 0;
    let needsSave = false;
    
    for (const course of courses) {
      // Check if this course has holes to migrate
      if (course.holes && Array.isArray(course.holes) && course.holes.length > 0) {
        try {
          const holesToSave: any[] = [];
          
          for (const hole of course.holes) {
            // Create hole with courseId and ID
            const holeId = await generateHoleId();
            holesToSave.push({
              id: holeId,
              courseId: course.id,
              number: hole.number,
              par: hole.par,
              distance: hole.distance,
              location: hole.location,
              notes: hole.notes,
            });
          }
          
          // Save all holes for this course
          await saveHoles(holesToSave);
          migrated += holesToSave.length;
          
          // Remove holes from course
          delete course.holes;
          needsSave = true;
        } catch (error) {
          console.error(`[Migration] Error migrating holes for course ${course.id}:`, error);
          failed++;
        }
      }
    }
    
    // Save all migrated courses (with holes removed)
    if (needsSave) {
      await defaultStorageDriver.setItem(COURSES_STORAGE_KEY, JSON.stringify(courses));
      console.log(`[Migration] Saved ${migrated} holes and removed holes from courses`);
    }
    
    // Mark migration as complete
    await defaultStorageDriver.setItem(COURSES_MIGRATION_VERSION_KEY, CURRENT_COURSES_MIGRATION_VERSION.toString());
    
    console.log(`[Migration] Courses holes split complete: ${migrated} holes migrated, ${failed} failed`);
    return { migrated, failed };
  } catch (error) {
    console.error('[Migration] Error migrating courses holes:', error);
    throw error;
  }
}

