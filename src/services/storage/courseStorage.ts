/**
 * Storage service for managing courses locally
 * Uses localforage (IndexedDB on web, native storage on mobile)
 */

import { getItem, setItem } from './storageAdapter';
import { Course } from '../../types';
import { getAllRounds } from './roundStorage';
import { generateUniqueUUID } from '../../utils/uuid';

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
 * Enforces local uniqueness of course names
 */
export async function saveCourse(course: Course): Promise<void> {
  try {
    const courses = await getAllCourses();
    const existingIndex = courses.findIndex((c) => c.id === course.id);
    
    // Check for name uniqueness (case-insensitive, excluding current course)
    const trimmedName = course.name.trim();
    const nameConflict = courses.find(c => 
      c.id !== course.id && 
      c.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    
    if (nameConflict) {
      throw new Error(`A course with the name "${trimmedName}" already exists`);
    }
    
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
 * Get a course by ID
 */
export async function getCourseById(courseId: string): Promise<Course | null> {
  try {
    const courses = await getAllCourses();
    return courses.find((c) => c.id === courseId) || null;
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
 * Generate a new unique course ID (6 hex characters)
 * Ensures local uniqueness by checking existing courses
 */
export async function generateCourseId(): Promise<string> {
  const courses = await getAllCourses();
  const existingIds = new Set(courses.map(c => c.id));
  return generateUniqueUUID(existingIds);
}

/**
 * Check if a course name is already taken
 */
export async function isCourseNameAvailable(name: string, excludeCourseId?: string): Promise<boolean> {
  try {
    const courses = await getAllCourses();
    const trimmedName = name.trim();
    return !courses.some(c => 
      c.name.trim().toLowerCase() === trimmedName.toLowerCase() && 
      c.id !== excludeCourseId
    );
  } catch (error) {
    console.error('Error checking course name availability:', error);
    return false;
  }
}

/**
 * Get the last used course from rounds
 * Returns the course that was used in the most recent round
 */
export async function getLastUsedCourse(): Promise<Course | null> {
  try {
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

