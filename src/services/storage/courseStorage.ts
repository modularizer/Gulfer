/**
 * Storage service for managing courses locally
 * Uses localforage (IndexedDB on web, native storage on mobile)
 */

import { getItem, setItem } from './storageAdapter';

export interface Course {
  id: string;
  name: string;
  holes: number;
}

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
    const existingIndex = courses.findIndex((c) => c.id === course.id);
    
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
 * Delete a course by ID
 */
export async function deleteCourse(courseId: string): Promise<void> {
  try {
    const courses = await getAllCourses();
    const filtered = courses.filter((c) => c.id !== courseId);
    await setItem(COURSES_STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting course:', error);
    throw error;
  }
}

/**
 * Generate a new unique course ID
 */
export function generateCourseId(): string {
  return `course_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
 * Get the latest added course (by creation timestamp in ID)
 */
export async function getLatestAddedCourse(): Promise<Course | null> {
  try {
    const courses = await getAllCourses();
    if (courses.length === 0) {
      return null;
    }
    
    // Extract timestamp from course ID and sort
    const coursesWithTimestamp = courses.map(course => {
      const match = course.id.match(/course_(\d+)_/);
      const timestamp = match ? parseInt(match[1], 10) : 0;
      return { course, timestamp };
    });
    
    // Sort by timestamp descending and return the most recent
    coursesWithTimestamp.sort((a, b) => b.timestamp - a.timestamp);
    return coursesWithTimestamp[0]?.course || null;
  } catch (error) {
    console.error('Error getting latest added course:', error);
    return null;
  }
}

