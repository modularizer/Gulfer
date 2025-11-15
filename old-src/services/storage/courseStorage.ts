/**
 * Course storage service
 * Uses Drizzle ORM directly
 */

import { schema, getDatabase } from './db';
import { eq } from 'drizzle-orm';
import { generateUUID } from '@/utils/uuid';

export type Course = typeof schema.courses.$inferSelect;
export type CourseInsert = typeof schema.courses.$inferInsert;
export type Hole = typeof schema.holes.$inferSelect;
export type HoleInsert = typeof schema.holes.$inferInsert;

export function generateCourseId(): string {
  return generateUUID();
}

export async function getAllCourses(): Promise<Course[]> {
  const db = await getDatabase();
  return await db.select().from(schema.courses);
}

export async function getCourseById(courseId: string): Promise<Course | null> {
  const db = await getDatabase();
  const results = await db.select()
    .from(schema.courses)
    .where(eq(schema.courses.id, courseId))
    .limit(1);
  
  return results[0] ?? null;
}

export async function getCourseByName(courseName: string): Promise<Course | null> {
  const db = await getDatabase();
  const results = await db.select()
    .from(schema.courses)
    .where(eq(schema.courses.name, courseName))
    .limit(1);
  
  return results[0] ?? null;
}

export async function saveCourse(course: CourseInsert): Promise<void> {
  const db = await getDatabase();
  
  await db.insert(schema.courses).values(course).onConflictDoUpdate({
    target: schema.courses.id,
    set: course,
  });
}

export async function getAllHolesForCourse(courseId: string): Promise<Hole[]> {
  const db = await getDatabase();
  return await db.select()
    .from(schema.holes)
    .where(eq(schema.holes.courseId, courseId));
}

export async function saveHolesForCourse(courseId: string, holes: HoleInsert[]): Promise<void> {
  const db = await getDatabase();
  
  // Delete existing holes for this course
  await db.delete(schema.holes)
    .where(eq(schema.holes.courseId, courseId));
  
  // Insert new holes
  if (holes.length > 0) {
    await db.insert(schema.holes).values(holes);
  }
}

