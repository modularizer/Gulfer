/**
 * Course Export/Import
 * Handles exporting and importing course data in a human-readable format
 * Includes both UUIDs and human-readable names for merging support
 */

import { Course, Hole } from '../types';
import { getStorageId } from './storage/platform/platformStorage';
import { saveCourse, getCourseByName, generateCourseId, getCourseById } from './storage/courseStorage';
import { getLocalUuidForForeign, mapForeignToLocal } from './storage/uuidMerge';
import { normalizeExportText } from '../utils';

/**
 * Export a course to a human-readable text format
 * Includes both UUID and name for merging support
 */
export async function exportCourse(courseId: string): Promise<string> {
  const course = await getCourseById(courseId);
  
  if (!course) {
    throw new Error('Course not found');
  }
  
  const storageId = await getStorageId();
  const lines: string[] = [];
  
  // Header
  lines.push('=== GULFER COURSE EXPORT ===');
  lines.push(`Storage ID: ${storageId}`);
  lines.push(`Course ID: ${course.id}`);
  lines.push(`Course Name: ${course.name}`);
  lines.push('');
  
  // Holes
  if (course.holes && course.holes.length > 0) {
    lines.push('Holes:');
    course.holes.forEach((hole, index) => {
      const holeData: string[] = [`  ${hole.number}`];
      if (hole.par !== undefined) {
        holeData.push(`Par: ${hole.par}`);
      }
      if (hole.distance !== undefined) {
        holeData.push(`Distance: ${hole.distance}m`);
      }
      lines.push(holeData.join(', '));
    });
    lines.push('');
  }
  
  // Location (if available)
  if (course.location) {
    lines.push(`Location: ${course.location.latitude}, ${course.location.longitude}`);
    lines.push('');
  }
  
  lines.push('=== END EXPORT ===');
  
  const text = lines.join('\n');
  // Normalize the exported text to ensure it uses regular newlines
  return normalizeExportText(text);
}

/**
 * Parse exported course text
 */
export interface ParsedCourseExport {
  storageId?: string;
  courseId?: string;
  courseName?: string;
  holes?: Hole[];
  location?: {
    latitude: number;
    longitude: number;
  };
}

export function parseCourseExport(exportText: string): ParsedCourseExport {
  // Normalize the text to replace non-breaking spaces with newlines
  const normalizedText = normalizeExportText(exportText);
  const lines = normalizedText.split('\n').map(l => l.trim());
  const parsed: ParsedCourseExport = {};
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    
    if (line.startsWith('Storage ID:')) {
      parsed.storageId = line.substring('Storage ID:'.length).trim();
    } else if (line.startsWith('Course ID:')) {
      parsed.courseId = line.substring('Course ID:'.length).trim();
    } else if (line.startsWith('Course Name:')) {
      parsed.courseName = line.substring('Course Name:'.length).trim();
    } else if (line === 'Holes:') {
      const holes: Hole[] = [];
      i++;
      while (i < lines.length && lines[i] && !lines[i].startsWith('Location:') && lines[i] !== '=== END EXPORT ===') {
        const holeLine = lines[i];
        // Parse hole line: "  1, Par: 3, Distance: 150m"
        const match = holeLine.match(/^\s*(\d+)(?:,\s*Par:\s*(\d+))?(?:,\s*Distance:\s*(\d+)m)?/);
        if (match) {
          const number = parseInt(match[1], 10);
          const par = match[2] ? parseInt(match[2], 10) : undefined;
          const distance = match[3] ? parseInt(match[3], 10) : undefined;
          holes.push({ number, par, distance });
        }
        i++;
      }
      parsed.holes = holes;
      continue;
    } else if (line.startsWith('Location:')) {
      const locationMatch = line.match(/Location:\s*([\d.-]+),\s*([\d.-]+)/);
      if (locationMatch) {
        parsed.location = {
          latitude: parseFloat(locationMatch[1]),
          longitude: parseFloat(locationMatch[2]),
        };
      }
    } else if (line === '=== END EXPORT ===') {
      break;
    }
    
    i++;
  }
  
  return parsed;
}

/**
 * Import a course from exported text
 * Supports merging with existing courses via UUID mapping
 */
export async function importCourse(
  exportText: string,
  manualMapping?: { foreignCourseId: string; localCourseId: string }
): Promise<string> {
  const parsed = parseCourseExport(exportText);
  
  if (!parsed.courseName) {
    throw new Error('Course name is missing from export');
  }
  
  const localStorageId = await getStorageId();
  const foreignStorageId = parsed.storageId;
  
  // Check if importing from same storage
  if (foreignStorageId && foreignStorageId === localStorageId) {
    throw new Error('Cannot import course from the same storage instance');
  }
  
  let localCourseId: string | undefined;
  
  if (parsed.courseId && foreignStorageId) {
    // Check for manual mapping first
    if (manualMapping && manualMapping.foreignCourseId === parsed.courseId) {
      localCourseId = manualMapping.localCourseId;
      await mapForeignToLocal(foreignStorageId, parsed.courseId, localCourseId, 'course');
    } else {
      // Check if already mapped
      const existingMapping = await getLocalUuidForForeign(foreignStorageId, parsed.courseId, 'course');
      
      if (existingMapping) {
        localCourseId = existingMapping;
      } else {
        // Check if course with same name exists
        const existingCourse = await getCourseByName(parsed.courseName);
        
        if (existingCourse) {
          // Map to existing course
          localCourseId = existingCourse.id;
          await mapForeignToLocal(foreignStorageId, parsed.courseId, existingCourse.id, 'course');
        } else {
          // Create new course
          localCourseId = generateCourseId();
          const newCourse: Course = {
            id: localCourseId,
            name: parsed.courseName,
            holes: parsed.holes || [],
            location: parsed.location,
          };
          await saveCourse(newCourse);
          
          // Map foreign course to new local course
          await mapForeignToLocal(foreignStorageId, parsed.courseId, localCourseId, 'course');
        }
      }
    }
  } else {
    // Import without UUID - find by name or create new
    const existingCourse = await getCourseByName(parsed.courseName);
    
    if (existingCourse) {
      localCourseId = existingCourse.id;
    } else {
      localCourseId = await generateCourseId();
      const newCourse: Course = {
        id: localCourseId,
        name: parsed.courseName,
        holes: parsed.holes || [],
        location: parsed.location,
      };
      await saveCourse(newCourse);
    }
  }
  
  if (!localCourseId) {
    throw new Error('Failed to import course');
  }
  
  return localCourseId;
}

