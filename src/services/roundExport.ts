/**
 * Service for exporting and importing rounds
 */

import { Round, Course, Player, Hole, Score } from '../types';
import { getAllCourses, saveCourse, getCourseByName, getCourseById, generateCourseId } from './storage/courseStorage';
import { getAllUsers, saveUser, generateUserId, getUserIdForPlayerName, getUserById } from './storage/userStorage';
import { saveRound, generateRoundId, getRoundById } from './storage/roundStorage';
import { getLocalUuidForForeign, mapForeignToLocal } from './storage/uuidMerge';
import { getStorageId } from './storage/storageId';
import { normalizeExportText } from '../utils';

/**
 * Parse exported text into structured data
 * Shared by both validation and import functions
 */
interface ParsedExportData {
  storageId?: string; // Storage UUID from export
  roundId?: string; // Round UUID from export
  title: string;
  dateTimestamp: number;
  courseName?: string;
  courseId?: string; // Course UUID from export
  courseHoles?: number;
  courseHolesData: Hole[];
  players: Array<{ name: string; id?: string; total: number }>; // Include UUID if present
  scores: Array<{ playerName: string; holeNumber: number; throws: number }>;
  notes?: string;
}

export function parseExportText(exportText: string): ParsedExportData {
  // Normalize the text to replace non-breaking spaces with newlines
  const normalizedText = normalizeExportText(exportText);
  const lines = normalizedText.split('\n');
  
  // Extract basic info
  let title = '';
  let dateTimestamp: number | null = null;
  let courseName: string | undefined;
  let courseId: string | undefined;
  let courseHoles: number | undefined;
  let courseHolesData: Hole[] = [];
  const players: Array<{ name: string; id?: string; total: number }> = [];
  const scores: Array<{ playerName: string; holeNumber: number; throws: number }> = [];
  let notes: string | undefined;

  let storageId: string | undefined;
  let roundId: string | undefined;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    
    if (line.startsWith('Storage ID:')) {
      storageId = line.substring(11).trim();
    } else if (line.startsWith('Round ID:')) {
      roundId = line.substring(9).trim();
    } else if (line.startsWith('Round:')) {
      title = line.substring(6).trim();
    } else if (line.startsWith('Timestamp:')) {
      dateTimestamp = parseInt(line.substring(10).trim(), 10);
    } else if (line.startsWith('Course:')) {
      courseName = line.substring(7).trim();
    } else if (line.startsWith('Course ID:')) {
      courseId = line.substring(10).trim();
    } else if (line.startsWith('Course Holes:')) {
      const holesStr = line.substring(13).trim();
      courseHoles = holesStr !== '?' ? parseInt(holesStr, 10) : undefined;
    } else if (line.startsWith('Course Holes Data:')) {
        i++;
        while (i < lines.length && lines[i].trim().startsWith('Hole ')) {
          const holeLine = lines[i].trim();
          const holeMatch = holeLine.match(/Hole (\d+):(?: Par (\d+))?(?: Distance (\d+)m)?/);
          if (holeMatch) {
            const number = parseInt(holeMatch[1], 10);
            const par = holeMatch[2] ? parseInt(holeMatch[2], 10) : undefined;
            const distance = holeMatch[3] ? parseInt(holeMatch[3], 10) : undefined;
            courseHolesData.push({ number, par, distance });
          }
          i++;
        }
        i--; // Adjust for loop increment
      } else if (line === 'Players:') {
      i++;
      while (i < lines.length && lines[i].trim().startsWith('- Name:')) {
        const playerLine = lines[i].trim();
        const nameMatch = playerLine.match(/- Name: ([^|]+)/);
        const idMatch = playerLine.match(/\| ID: ([^|]+)/);
        const totalMatch = playerLine.match(/Total: (\d+)/);
        
        if (nameMatch) {
          players.push({
            name: nameMatch[1].trim(),
            id: idMatch ? idMatch[1].trim() : undefined,
            total: totalMatch ? parseInt(totalMatch[1], 10) : 0,
          });
        }
        i++;
      }
      i--; // Adjust for loop increment
    } else if (line === 'Scores:') {
      i++;
      while (i < lines.length && lines[i].trim().startsWith('Hole ')) {
        const scoreLine = lines[i].trim();
        // Match both formats: "Hole 1: ..." and "Hole 1 (Par ?, ?m): ..."
        const holeMatch = scoreLine.match(/Hole (\d+)(?: \(Par [^,)]+, [^)]+\))?: (.+)/);
        if (holeMatch) {
          const holeNumber = parseInt(holeMatch[1], 10);
          const scoresStr = holeMatch[2];
          const scorePairs = scoresStr.split(' ');
          scorePairs.forEach(pair => {
            const [playerName, throwsStr] = pair.split(':');
            if (playerName && throwsStr) {
              scores.push({
                playerName: playerName.trim(),
                holeNumber,
                throws: parseInt(throwsStr.trim(), 10),
              });
            }
          });
        }
        i++;
      }
      i--; // Adjust for loop increment
    } else if (line.startsWith('Notes:')) {
      notes = line.substring(6).trim() || undefined;
    }
    
    i++;
  }

  if (!title || !dateTimestamp) {
    throw new Error('Invalid export format: Missing required fields (Round, Timestamp)');
  }

  return {
    storageId,
    roundId,
    title,
    dateTimestamp,
    courseName,
    courseId,
    courseHoles,
    courseHolesData,
    players,
    scores,
    notes,
  };
}

/**
 * Validate that exported text can be parsed correctly
 */
function validateExportText(exportText: string): void {
  const parsed = parseExportText(exportText);
  
  // Additional validation
  if (parsed.players.length === 0) {
    throw new Error('Export validation failed: No players found');
  }
  
  // Validate that all scores reference valid players
  if (parsed.scores.length > 0) {
    const playerNames = new Set(parsed.players.map(p => p.name));
    for (const score of parsed.scores) {
      if (!playerNames.has(score.playerName)) {
        throw new Error(`Export validation failed: Score references unknown player: ${score.playerName}`);
      }
      if (isNaN(score.throws) || score.throws < 0) {
        throw new Error(`Export validation failed: Invalid score value: ${score.throws}`);
      }
    }
  }
}

/**
 * Export a round to a human-readable format
 */
export async function exportRound(roundId: string): Promise<string> {
  const round = await getRoundById(roundId);
  
  if (!round) {
    throw new Error('Round not found');
  }

  // Get course data if available
  let course: Course | undefined;
  let courseName: string | undefined = round.courseName;
  
  if (round.courseName) {
    const foundCourse = await getCourseByName(round.courseName);
    course = foundCourse || undefined;
  } else {
    // Try to infer course from number of holes played
    if (round.scores && round.scores.length > 0) {
      const maxHole = Math.max(...round.scores.map(s => s.holeNumber));
      const allCourses = await getAllCourses();
      // Try to find a course with matching hole count
      const matchingCourse = allCourses.find(c => {
        const holeCount = Array.isArray(c.holes) ? c.holes.length : (typeof c.holes === 'number' ? c.holes : 0);
        return holeCount === maxHole;
      });
      if (matchingCourse) {
        course = matchingCourse;
        courseName = matchingCourse.name;
      }
    }
  }

  // Get player data
  const allUsers = await getAllUsers();
  const playersData = round.players.map(player => {
    return {
      name: player.name,
    };
  });

  // Format date
  const date = new Date(round.date);
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Calculate player scores
  const playerScores = round.players.map(player => {
    const total = round.scores
      ? round.scores
          .filter(s => s.playerId === player.id)
          .reduce((sum, s) => sum + s.throws, 0)
      : 0;
    return { player, total };
  });

  const winnerScore = playerScores.length > 0 && round.scores && round.scores.length > 0
    ? Math.min(...playerScores.map(ps => ps.total))
    : null;
  const winner = winnerScore !== null
    ? playerScores.find(ps => ps.total === winnerScore)
    : null;

  // Get storage ID for this export
  const storageId = await getStorageId();
  
  // Build human-readable text
  let text = '=== GULFER ROUND EXPORT ===\n';
  text += `Version: 2.0\n`;
  text += `Storage ID: ${storageId}\n`;
  text += `Round ID: ${round.id}\n\n`;
  text += `Round: ${round.name}\n`;
  text += `Date: ${dateStr} at ${timeStr}\n`;
  text += `Timestamp: ${round.date}\n`;
  
  // Always include course information if available
  if (courseName || course) {
    const finalCourseName = courseName || course?.name || 'Unknown';
    text += `Course: ${finalCourseName}\n`;
    
    // Always try to include Course ID
    if (course) {
      text += `Course ID: ${course.id}\n`;
    } else if (courseName) {
      // Try to look up course by name to get its ID
      const courseByName = await getCourseByName(courseName);
      if (courseByName) {
        text += `Course ID: ${courseByName.id}\n`;
      }
    }
    
    // Include course hole count if available
    if (course) {
      const holeCount = Array.isArray(course.holes) ? course.holes.length : (typeof course.holes === 'number' ? course.holes : 0);
      text += `Course Holes: ${holeCount}\n`;
    } else if (round.scores && round.scores.length > 0) {
      // If we have scores but no course data, at least show the number of holes
      const maxHole = Math.max(...round.scores.map(s => s.holeNumber));
      text += `Course Holes: ${maxHole}\n`;
    }
  }
  
  text += '\nPlayers:\n';
  playerScores.forEach(({ player, total }) => {
    const isWinner = winner && player.id === winner.player.id;
    // Always include both name and ID for each player
    text += `  - Name: ${player.name} | ID: ${player.id} | Total: ${total}${isWinner ? ' (Winner)' : ''}\n`;
  });

  // Add hole-by-hole scores if available
  if (round.scores && round.scores.length > 0) {
    const maxHole = Math.max(...round.scores.map(s => s.holeNumber));
    text += '\nScores:\n';
    
    // Create a map of hole data for quick lookup
    const holeDataMap = new Map<number, { par?: number; distance?: number }>();
    if (course && Array.isArray(course.holes)) {
      course.holes.forEach(hole => {
        holeDataMap.set(hole.number, { par: hole.par, distance: hole.distance });
      });
    }
    
    for (let hole = 1; hole <= maxHole; hole++) {
      const holeData = holeDataMap.get(hole);
      const par = holeData?.par !== undefined ? holeData.par : '?';
      const distance = holeData?.distance !== undefined ? `${holeData.distance}m` : '?m';
      
      const holeScores = round.scores
        .filter(s => s.holeNumber === hole)
        .map(s => {
          const player = round.players.find(p => p.id === s.playerId);
          return `${player?.name || 'Unknown'}:${s.throws}`;
        })
        .join(' ');
      text += `  Hole ${hole} (Par ${par}, ${distance}): ${holeScores}\n`;
    }
  }

  if (round.notes) {
    text += `\nNotes: ${round.notes}\n`;
  }

  // Normalize the exported text to ensure it uses regular newlines
  const normalizedText = normalizeExportText(text);

  // Validate that the exported text can be parsed
  try {
    validateExportText(normalizedText);
  } catch (error) {
    console.error('Export validation failed:', error);
    throw new Error(`Export validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return normalizedText;
}

/**
 * Import a round from exported human-readable text
 * 
 * @param exportText - The exported round text
 * @param manualMappings - Optional manual mappings: { courses?: Map<foreignCourseId, localCourseId>, players?: Map<foreignPlayerId, localPlayerId> }
 */
export async function importRound(
  exportText: string,
  manualMappings?: {
    courses?: Map<string, string>; // Map<foreignCourseId, localCourseId>
    players?: Map<string, string>; // Map<foreignPlayerId, localPlayerId>
  }
): Promise<string> {
  try {
    console.log('Starting import round...');
    console.log('Export text length:', exportText.length);
    // Parse the export text using the shared parsing function
    const parsed = parseExportText(exportText);
    console.log('Parsed data:', {
      title: parsed.title,
      dateTimestamp: parsed.dateTimestamp,
      courseName: parsed.courseName,
      playersCount: parsed.players.length,
      scoresCount: parsed.scores.length,
    });
    
    const {
      storageId: foreignStorageId,
      roundId: importedRoundId,
      title,
      dateTimestamp,
      courseName,
      courseId: foreignCourseId,
      courseHoles,
      courseHolesData,
      players,
      scores,
      notes,
    } = parsed;

    // Get local storage ID
    const localStorageId = await getStorageId();
    
    // Skip if importing from same storage (shouldn't happen, but safety check)
    if (foreignStorageId && foreignStorageId === localStorageId) {
      throw new Error('Cannot import from the same storage instance');
    }

    // Import course if provided
    let localCourseId: string | undefined;
    if (courseName && foreignCourseId && foreignStorageId) {
      // First check for manual mapping
      if (manualMappings?.courses?.has(foreignCourseId)) {
        localCourseId = manualMappings.courses.get(foreignCourseId);
        if (localCourseId && foreignStorageId) {
          // Create the mapping in the merge table
          await mapForeignToLocal(foreignStorageId, foreignCourseId, localCourseId, 'course');
        }
      } else {
        // Check if this foreign course is already mapped
        const mappedCourseId = await getLocalUuidForForeign(foreignStorageId, foreignCourseId, 'course');
        
        if (mappedCourseId) {
          // Use existing mapping
          localCourseId = mappedCourseId;
        } else {
          // Check if a course with this name exists locally
          const existingCourse = await getCourseByName(courseName);
          
          if (existingCourse && foreignStorageId) {
            // Map foreign course to existing local course
            localCourseId = existingCourse.id;
            await mapForeignToLocal(foreignStorageId, foreignCourseId, existingCourse.id, 'course');
          } else if (courseHoles !== undefined) {
            // Create new course and optionally map it
            const holes: Hole[] = courseHolesData.length > 0 
              ? courseHolesData 
              : Array.from({ length: courseHoles }, (_, i) => ({ number: i + 1 }));
            
            localCourseId = await generateCourseId();
            const newCourse: Course = {
              id: localCourseId,
              name: courseName,
              holes,
            };
            await saveCourse(newCourse);
            
            // Map foreign course to new local course
            if (foreignStorageId) {
              await mapForeignToLocal(foreignStorageId, foreignCourseId, localCourseId, 'course');
            }
          }
        }
      }
    } else if (courseName && !foreignCourseId) {
      // Legacy import without course UUID - just find by name
      const existingCourse = await getCourseByName(courseName);
      localCourseId = existingCourse?.id;
    }

    // Import players (create users if they don't exist, use merge table)
    const allUsers = await getAllUsers();
    const importedPlayers: Player[] = [];
    
    for (const playerData of players) {
      let localPlayerId: string;
      
      if (playerData.id && foreignStorageId) {
        // First check for manual mapping
        if (manualMappings?.players?.has(playerData.id)) {
          localPlayerId = manualMappings.players.get(playerData.id)!;
          if (foreignStorageId) {
            // Create the mapping in the merge table
            await mapForeignToLocal(foreignStorageId, playerData.id, localPlayerId, 'player');
          }
        } else {
          // Check if this foreign player is already mapped
          const mappedPlayerId = await getLocalUuidForForeign(foreignStorageId, playerData.id, 'player');
          
          if (mappedPlayerId) {
            // Use existing mapping
            localPlayerId = mappedPlayerId;
          } else {
            // Check if a player with this name exists locally
            const existingUser = allUsers.find(u => u.name.trim().toLowerCase() === playerData.name.trim().toLowerCase());
            
            if (existingUser && foreignStorageId) {
              // Map foreign player to existing local player
              localPlayerId = existingUser.id;
              await mapForeignToLocal(foreignStorageId, playerData.id, existingUser.id, 'player');
            } else {
              // Create new user and map it
              localPlayerId = await getUserIdForPlayerName(playerData.name);
              const newUser = {
                id: localPlayerId,
                name: playerData.name.trim(),
              };
              await saveUser(newUser);
              allUsers.push(newUser);
              
              // Map foreign player to new local player
              if (foreignStorageId) {
                await mapForeignToLocal(foreignStorageId, playerData.id, localPlayerId, 'player');
              }
            }
          }
        }
      } else {
        // Legacy import without player UUID - find or create by name
        const existingUser = allUsers.find(u => u.name.trim().toLowerCase() === playerData.name.trim().toLowerCase());
        if (existingUser) {
          localPlayerId = existingUser.id;
        } else {
          localPlayerId = await getUserIdForPlayerName(playerData.name);
          const newUser = {
            id: localPlayerId,
            name: playerData.name.trim(),
          };
          await saveUser(newUser);
          allUsers.push(newUser);
        }
      }

      // Create player for the round
      const user = allUsers.find(u => u.id === localPlayerId) || { id: localPlayerId, name: playerData.name };
      importedPlayers.push({
        id: user.id,
        name: user.name,
      });
    }

    // Map scores to player IDs
    const roundScores: Score[] = scores.map(score => {
      const player = importedPlayers.find(p => p.name === score.playerName);
      if (!player) {
        throw new Error(`Player not found: ${score.playerName}`);
      }
      return {
        playerId: player.id,
        holeNumber: score.holeNumber,
        throws: score.throws,
      };
    });

    // Create new round with UUID (always generate new local UUID for rounds)
    // Rounds are not merged - each import creates a new round
    const roundId = await generateRoundId();
    const newRound: Round = {
      id: roundId,
      title,
      date: dateTimestamp,
      players: importedPlayers,
      scores: roundScores,
      courseName: localCourseId ? (await getCourseById(localCourseId))?.name : courseName,
      notes,
    };

    await saveRound(newRound, true); // allowRestore=true for new rounds
    
    // If we had a foreign round ID, we could optionally track it, but rounds aren't merged
    // so we just create new ones

    return newRound.id;
  } catch (error) {
    console.error('Error importing round:', error);
    throw error;
  }
}

