/**
 * Import Mapping Utilities
 * Helper functions to prepare manual mappings for import
 */

import { parseExportText } from './roundExport';
import { getAllCourses } from './storage/courseStorage';
import { getAllUsers } from './storage/userStorage';
import { getLocalUuidForForeign } from './storage/uuidMerge';
import { findMostSimilar } from '../utils/stringSimilarity';
import { EntityType } from '@/types';

interface EntityMapping {
  foreignId: string;
  foreignName: string;
  localId: string | null; // null = create new, string = mapped to existing
  alreadyMapped: boolean; // true if already in merge table
  suggestedLocalId: string | null; // suggested based on name similarity
}

/**
 * Parse an export to get foreign entities that need mapping
 * Checks merge table first to see if entities are already mapped
 * Returns information about foreign courses and players that need user confirmation
 */
export async function getImportMappingInfo(exportText: string): Promise<{
  foreignStorageId?: string;
  courseMapping: EntityMapping | null;
  playerMappings: EntityMapping[];
  localCourses: Array<{ id: string; name: string }>;
  localPlayers: Array<{ id: string; name: string }>;
  needsMapping: boolean; // true if any entity needs user confirmation
}> {
  const parsed = parseExportText(exportText);
  const foreignStorageId = parsed.storageId;
  
  // Get all local entities for selection
  const localCourses = await getAllCourses();
  const localUsers = await getAllUsers();
  
  const localCoursesList = localCourses.map(c => ({ id: c.id, name: c.name }));
  const localPlayersList = localUsers.map(u => ({ id: u.id, name: u.name }));
  
  // Check course mapping
  let courseMapping: EntityMapping | null = null;
  if (parsed.courseId && parsed.courseName && foreignStorageId) {
    // First check if already mapped
    const existingMapping = await getLocalUuidForForeign(foreignStorageId, parsed.courseId, EntityType.Courses);
    
    if (existingMapping) {
      // Already mapped, no need to prompt
      courseMapping = {
        foreignId: parsed.courseId,
        foreignName: parsed.courseName,
        localId: existingMapping,
        alreadyMapped: true,
        suggestedLocalId: existingMapping,
      };
    } else {
      // Not mapped yet - find similar name if local courses exist
      let suggestedLocalId: string | null = null;
      if (localCourses.length > 0) {
        const match = findMostSimilar(parsed.courseName, localCourses, c => c.name, 0.6);
        suggestedLocalId = match?.item.id || null;
      }
      
      courseMapping = {
        foreignId: parsed.courseId,
        foreignName: parsed.courseName,
        localId: suggestedLocalId,
        alreadyMapped: false,
        suggestedLocalId,
      };
    }
  }
  
  // Check player mappings
  const playerMappings: EntityMapping[] = [];
  for (const foreignPlayer of parsed.players) {
    if (!foreignPlayer.id) continue;
    
    if (foreignStorageId) {
      // Check if already mapped
      const existingMapping = await getLocalUuidForForeign(foreignStorageId, foreignPlayer.id, EntityType.Players);
      
      if (existingMapping) {
        // Already mapped
        playerMappings.push({
          foreignId: foreignPlayer.id,
          foreignName: foreignPlayer.name,
          localId: existingMapping,
          alreadyMapped: true,
          suggestedLocalId: existingMapping,
        });
        continue;
      }
    }
    
    // Not mapped yet - find similar name if local players exist
    let suggestedLocalId: string | null = null;
    if (localUsers.length > 0) {
      const match = findMostSimilar(foreignPlayer.name, localUsers, u => u.name, 0.6);
      suggestedLocalId = match?.item.id || null;
    }
    
    playerMappings.push({
      foreignId: foreignPlayer.id,
      foreignName: foreignPlayer.name,
      localId: suggestedLocalId,
      alreadyMapped: false,
      suggestedLocalId,
    });
  }
  
  // Determine if we need to show the mapping dialog
  // Skip if:
  // 1. All entities are already mapped
  // 2. No local courses exist and we have a foreign course (definitely create new)
  // 3. No local players exist and we have foreign players (definitely create new)
  const allCourseMapped = !courseMapping || courseMapping.alreadyMapped;
  const allPlayersMapped = playerMappings.every(p => p.alreadyMapped);
  const noLocalCoursesAndForeignCourse = localCourses.length === 0 && courseMapping && !courseMapping.alreadyMapped;
  const noLocalPlayersAndForeignPlayers = localUsers.length === 0 && playerMappings.length > 0 && playerMappings.some(p => !p.alreadyMapped);
  
  const needsMapping = !(allCourseMapped && allPlayersMapped) && 
                       !noLocalCoursesAndForeignCourse && 
                       !noLocalPlayersAndForeignPlayers;
  
  return {
    foreignStorageId,
    courseMapping: courseMapping && !courseMapping.alreadyMapped ? courseMapping : null,
    playerMappings: playerMappings.filter(p => !p.alreadyMapped),
    localCourses: localCoursesList,
    localPlayers: localPlayersList,
    needsMapping,
  };
}

/**
 * Create manual mappings from user selections
 */
export function createManualMappings(options: {
  courseMapping?: { foreignCourseId: string; localCourseId: string };
  playerMappings?: Array<{ foreignPlayerId: string; localPlayerId: string }>;
}): {
  courses?: Map<string, string>;
  players?: Map<string, string>;
} {
  const mappings: {
    courses?: Map<string, string>;
    players?: Map<string, string>;
  } = {};
  
  if (options.courseMapping) {
    mappings.courses = new Map([
      [options.courseMapping.foreignCourseId, options.courseMapping.localCourseId]
    ]);
  }
  
  if (options.playerMappings && options.playerMappings.length > 0) {
    mappings.players = new Map(
      options.playerMappings.map(m => [m.foreignPlayerId, m.localPlayerId])
    );
  }
  
  return mappings;
}

