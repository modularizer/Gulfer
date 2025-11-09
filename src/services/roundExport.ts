/**
 * Service for exporting and importing rounds
 */

import { Round, Course, Player, Hole } from '../types';
import { getAllCourses, saveCourse, getCourseByName } from './storage/courseStorage';
import { getAllUsers, saveUser, generateUserId, getUsernameForPlayerName, isUsernameAvailable } from './storage/userStorage';
import { saveRound } from './storage/roundStorage';

/**
 * Parse exported text into structured data
 * Shared by both validation and import functions
 */
interface ParsedExportData {
  title: string;
  dateTimestamp: number;
  courseName?: string;
  courseHoles?: number;
  courseHolesData: Hole[];
  players: Array<{ name: string; username: string; total: number }>;
  scores: Array<{ playerName: string; holeNumber: number; throws: number }>;
  notes?: string;
}

function parseExportText(exportText: string): ParsedExportData {
  const lines = exportText.split('\n');
  
  // Extract basic info
  let title = '';
  let dateTimestamp: number | null = null;
  let courseName: string | undefined;
  let courseHoles: number | undefined;
  let courseHolesData: Hole[] = [];
  const players: Array<{ name: string; username: string; total: number }> = [];
  const scores: Array<{ playerName: string; holeNumber: number; throws: number }> = [];
  let notes: string | undefined;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    
    if (line.startsWith('Round:')) {
      title = line.substring(6).trim();
    } else if (line.startsWith('Timestamp:')) {
      dateTimestamp = parseInt(line.substring(10).trim(), 10);
    } else if (line.startsWith('Course:')) {
      courseName = line.substring(7).trim();
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
        const usernameMatch = playerLine.match(/Username: ([^|]+)/);
        const totalMatch = playerLine.match(/Total: (\d+)/);
        
        if (nameMatch) {
          players.push({
            name: nameMatch[1].trim(),
            username: usernameMatch ? usernameMatch[1].trim() : nameMatch[1].trim().toLowerCase().replace(/\s+/g, '_'),
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
    title,
    dateTimestamp,
    courseName,
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
export async function exportRound(roundId: string | number): Promise<string> {
  const { getRoundById } = await import('./storage/roundStorage');
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

  // Get player data (usernames)
  const allUsers = await getAllUsers();
  const playersData = round.players.map(player => {
    const user = allUsers.find(u => u.name === player.name || u.username === player.username);
    return {
      name: player.name,
      username: player.username || user?.username || player.name.toLowerCase().replace(/\s+/g, '_'),
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

  // Build human-readable text
  let text = '=== GULFER ROUND EXPORT ===\n';
  text += `Version: 1.0\n\n`;
  text += `Round: ${round.title}\n`;
  text += `Date: ${dateStr} at ${timeStr}\n`;
  text += `Timestamp: ${round.date}\n`;
  
  // Always include course information if available
  if (courseName || course) {
    text += `Course: ${courseName || 'Unknown'}\n`;
    
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
    const username = playersData.find(p => p.name === player.name)?.username || '';
    text += `  - Name: ${player.name}`;
    if (username) text += ` | Username: ${username}`;
    text += ` | Total: ${total}${isWinner ? ' (Winner)' : ''}\n`;
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

  // Validate that the exported text can be parsed
  try {
    validateExportText(text);
  } catch (error) {
    console.error('Export validation failed:', error);
    throw new Error(`Export validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return text;
}

/**
 * Import a round from exported human-readable text
 */
export async function importRound(exportText: string): Promise<string> {
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
      title,
      dateTimestamp,
      courseName,
      courseHoles,
      courseHolesData,
      players,
      scores,
      notes,
    } = parsed;

    // Import course if provided
    if (courseName) {
      const existingCourse = await getCourseByName(courseName);
      if (!existingCourse && courseHoles !== undefined) {
        // Create course
        const holes: Hole[] = courseHolesData.length > 0 
          ? courseHolesData 
          : Array.from({ length: courseHoles }, (_, i) => ({ number: i + 1 }));
        
        const newCourse: Course = {
          id: `course_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: courseName,
          holes,
        };
        await saveCourse(newCourse);
      }
    }

    // Import players (create users if they don't exist)
    const allUsers = await getAllUsers();
    const importedPlayers: Player[] = [];
    
    for (const playerData of players) {
      // Check if user exists by username
      let user = allUsers.find(u => u.username === playerData.username);
      
      if (!user) {
        // Check if username is available
        const usernameAvailable = await isUsernameAvailable(playerData.username);
        const finalUsername = usernameAvailable 
          ? playerData.username 
          : `${playerData.username}_${Date.now()}`;
        
        // Create new user
        const newUser = {
          id: generateUserId(),
          name: playerData.name,
          username: finalUsername,
        };
        await saveUser(newUser);
        user = newUser;
        allUsers.push(newUser);
      }

      // Create player for the round
      importedPlayers.push({
        id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: user.name,
        username: user.username,
      });
    }

    // Map scores to player IDs
    const roundScores = scores.map(score => {
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

    // Create new round
    const newRound: Round = {
      id: `round_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      date: dateTimestamp,
      players: importedPlayers,
      scores: roundScores,
      courseName,
      notes,
    };

    await saveRound(newRound);

    return newRound.id;
  } catch (error) {
    console.error('Error importing round:', error);
    throw error;
  }
}

