/**
 * Storage service for managing courses locally
 * Uses localforage (IndexedDB on web, native storage on mobile)
 */

import { getItem, setItem } from './storageAdapter';
import { Course } from '../../types';

// Re-export Course type from types
export type { Course };

const COURSES_STORAGE_KEY = '@gulfer_courses';

/**
 * Get all saved courses
 */
export async function getAllCourses(): Promise<Course[]> {
  try {
    const data = await getItem(COURSES_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Error loading courses:', error);
    return [];
  }
}

/**
 * Save a course to local storage
 */
export async function saveCourse(course: Course): Promise<void> {
  try {
    const courses = await getAllCourses();
    // Handle both numeric and string IDs for comparison
    const courseNumId = typeof course.id === 'string' ? parseInt(course.id, 10) : course.id;
    const existingIndex = courses.findIndex((c) => {
      const cNumId = typeof c.id === 'string' ? parseInt(c.id, 10) : c.id;
      return cNumId === courseNumId || c.id === course.id;
    });
    
    if (existingIndex >= 0) {
      courses[existingIndex] = course;
    } else {
      courses.push(course);
    }
    
    await setItem(COURSES_STORAGE_KEY, JSON.stringify(courses));
  } catch (error) {
    console.error('Error saving course:', error);
    throw error;
  }
}

/**
 * Get a course by ID (supports both numeric IDs and string IDs for backward compatibility)
 */
export async function getCourseById(courseId: string | number): Promise<Course | null> {
  try {
    const courses = await getAllCourses();
    // Convert to number for comparison if needed
    const numId = typeof courseId === 'string' ? parseInt(courseId, 10) : courseId;
    return courses.find((c) => {
      const cNumId = typeof c.id === 'string' ? parseInt(c.id, 10) : c.id;
      return cNumId === numId || c.id === courseId;
    }) || null;
  } catch (error) {
    console.error('Error loading course:', error);
    return null;
  }
}

/**
 * Get a course by name
 */
export async function getCourseByName(courseName: string): Promise<Course | null> {
  try {
    const courses = await getAllCourses();
    return courses.find((c) => c.name === courseName) || null;
  } catch (error) {
    console.error('Error loading course by name:', error);
    return null;
  }
}

/**
 * Delete a course by ID (supports both numeric IDs and string IDs for backward compatibility)
 */
export async function deleteCourse(courseId: string | number): Promise<void> {
  try {
    const courses = await getAllCourses();
    const numId = typeof courseId === 'string' ? parseInt(courseId, 10) : courseId;
    const filtered = courses.filter((c) => {
      const cNumId = typeof c.id === 'string' ? parseInt(c.id, 10) : c.id;
      return cNumId !== numId && c.id !== courseId;
    });
    await setItem(COURSES_STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting course:', error);
    throw error;
  }
}

/**
 * Generate a new unique course ID (numeric, ending in 0)
 */
export async function generateCourseId(): Promise<number> {
  const { getNextCourseId } = await import('../../utils/idUtils');
  return getNextCourseId();
}

/**
 * Get the last used course from rounds
 * Returns the course that was used in the most recent round
 */
export async function getLastUsedCourse(): Promise<Course | null> {
  try {
    // Import here to avoid circular dependency
    const { getAllRounds } = await import('./roundStorage');
    const rounds = await getAllRounds();
    
    // Find the most recent round with a courseName
    const roundsWithCourse = rounds
      .filter(r => r.courseName)
      .sort((a, b) => b.date - a.date);
    
    if (roundsWithCourse.length === 0) {
      return null;
    }
    
    const lastUsedCourseName = roundsWithCourse[0].courseName;
    if (!lastUsedCourseName) {
      return null;
    }
    
    // Find the course matching the name
    const courses = await getAllCourses();
    return courses.find(c => c.name === lastUsedCourseName) || null;
  } catch (error) {
    console.error('Error getting last used course:', error);
    return null;
  }
}

/**
 * Get the latest added course (by highest numeric ID)
 */
export async function getLatestAddedCourse(): Promise<Course | null> {
  try {
    const courses = await getAllCourses();
    if (courses.length === 0) {
      return null;
    }
    
    // Extract numeric IDs and sort
    const coursesWithId = courses.map(course => {
      const numId = typeof course.id === 'string' ? parseInt(course.id, 10) : course.id;
      return { course, id: isNaN(numId) ? -1 : numId };
    });
    
    // Sort by ID descending and return the most recent
    coursesWithId.sort((a, b) => b.id - a.id);
    return coursesWithId[0]?.course || null;
  } catch (error) {
    console.error('Error getting latest added course:', error);
    return null;
  }
}

