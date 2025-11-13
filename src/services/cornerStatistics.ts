/**
 * Service for computing corner statistics from round data
 * Refactored to use playerRounds (playerRounds) directly from database
 */

import type { PlayerRound, Score, Round } from './storage/playerRoundQueries';
import {
  getPlayerRoundsForCourseInDateRange,
  getExpectedHoleCount
} from './storage/playerRoundQueries';

/**
 * PlayerRound data with related round, player, and scores
 * This is the standard structure returned by playerRoundQueries functions
 */
export type PlayerRoundData = {
  playerRound: PlayerRound;
  round: Round;
  player: { id: string; name: string };
  scores: Score[];
};

export type UserFilter = 
  | 'everyone'  // Include all rounds from everyone
  | 'eachUser'  // Each player's column uses their own rounds (each respective player)
  | 'todaysPlayers'  // Players from today's round
  | string[];   // Array of user IDs - compare each player against these users' rounds

export type AccumulationMode = 'best' | 'latest' | 'first' | 'worst' | 'average' | 'percentile' | 'relevant';

export type Scope = 'round' | 'hole';

export type RoundSelection = 
  | 'all'
  | 'latest'
  | 'latest2'
  | 'latest3'
  | 'first'
  | 'bestRound'
  | 'bestRound2'
  | 'bestRounds2'
  | 'bestRounds3'
  | 'worstRound'
  | 'worstRound2'
  | 'worstRounds2'
  | 'worstRounds3'
  | { type: 'specific'; roundIds: string[] };

export type UserFilterMode = 'and' | 'or'; // For multiple user selection: 'and' = all users must be in round, 'or' = any user can be in round

export type SinceDateOption = 'beginning' | 'yearAgo' | 'monthAgo' | { type: 'custom'; timestamp: number };
export type UntilDateOption = 'today' | 'yesterday' | { type: 'custom'; timestamp: number };

export interface CornerConfig {
  scoreUserFilter: UserFilter; // Which users' scores to consider from the filtered rounds
  roundUserFilter: UserFilter; // Which rounds to include based on who played in them
  userFilterMode?: UserFilterMode; // Used when either scoreUserFilter or roundUserFilter is an array with multiple users ('and' = all users must be present, 'or' = any user can be present)
  accumulationMode: AccumulationMode;
  scope: Scope;
  roundSelection?: RoundSelection; // Required if accumulationMode is not 'latest' or 'first'
  percentile?: number; // Required if accumulationMode is 'percentile' (0-100)
  sinceDate?: SinceDateOption; // Optional: filter rounds to those on or after this date
  untilDate?: UntilDateOption; // Optional: filter rounds to those on or before this date
  presetName?: string; // Optional: name of the preset that was used to create this config
  autoColor?: boolean; // Optional: if true, automatically color the corner based on comparison with cell value (red if corner < cell, yellow/orange if equal, green if corner > cell)
  customColor?: string; // Optional: custom hex color for the corner (only used if autoColor is not true)
}

export interface CornerStatisticsConfig {
  topLeft?: CornerConfig | null;
  topRight?: CornerConfig | null;
  bottomLeft?: CornerConfig | null;
  bottomRight?: CornerConfig | null;
}

/**
 * Check if a score represents a completed hole
 */
function isScoreComplete(score: Score): boolean {
    return score.complete === true;
  }

/**
 * Check if a playerRound is complete (has all holes marked as complete)
 */
function isPlayerRoundComplete(playerRoundData: { scores: Score[] }, expectedHoleCount: number): boolean {
  if (playerRoundData.scores.length === 0) return false;
  
  const completedScores = playerRoundData.scores.filter(s => isScoreComplete(s));
  const uniqueHoles = new Set(completedScores.map(s => s.holeNumber));
  
  return uniqueHoles.size >= expectedHoleCount;
}

/**
 * Convert date options to timestamps
 */
function getSinceTimestamp(sinceDate?: SinceDateOption): number | undefined {
  if (!sinceDate) return undefined;
  
  if (sinceDate === 'beginning') {
    return 0;
  } else if (sinceDate === 'yearAgo') {
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    yearAgo.setHours(0, 0, 0, 0);
    return yearAgo.getTime();
  } else if (sinceDate === 'monthAgo') {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    monthAgo.setHours(0, 0, 0, 0);
    return monthAgo.getTime();
  } else {
    return sinceDate.timestamp;
  }
}

function getUntilTimestamp(untilDate?: UntilDateOption): number | undefined {
  if (!untilDate) return undefined;
  
  if (untilDate === 'today') {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return today.getTime();
  } else if (untilDate === 'yesterday') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);
    return yesterday.getTime();
  } else {
    return untilDate.timestamp;
  }
}

/**
 * Filter playerRounds by user filter
 */
function filterPlayerRoundsByUser(
  playerRounds: PlayerRoundData[],
  userFilter: UserFilter,
  currentUserId?: string,
  todaysPlayerIds?: string[]
): PlayerRoundData[] {
  if (userFilter === 'everyone') {
    return playerRounds;
  }
  if (userFilter === 'eachUser') {
    if (currentUserId) {
      return playerRounds.filter(ur => ur.playerRound.playerId === currentUserId);
    }
    return playerRounds;
  }
  if (userFilter === 'todaysPlayers') {
    if (todaysPlayerIds && todaysPlayerIds.length > 0) {
      return playerRounds.filter(ur => todaysPlayerIds.includes(ur.playerRound.playerId));
    }
    return playerRounds;
  }
  if (Array.isArray(userFilter) && userFilter.length > 0) {
    return playerRounds.filter(ur => userFilter.includes(ur.playerRound.playerId));
  }
  return playerRounds;
}

/**
 * Select playerRounds based on round selection criteria
 */
function selectPlayerRoundsByCriteria(
  playerRounds: PlayerRoundData[],
  roundSelection: RoundSelection | undefined,
  accumulationMode: AccumulationMode,
  currentUserId: string,
  expectedHoleCount: number
): PlayerRoundData[] {
  // If accumulation mode is 'latest' or 'first', we use all playerRounds (they'll be sorted later)
  if (accumulationMode === 'latest' || accumulationMode === 'first') {
    return playerRounds;
  }

  // If no round selection provided, default to 'all'
  if (!roundSelection) {
    return playerRounds;
  }

  if (roundSelection === 'all') {
    return playerRounds;
  }

  // Filter to only completed playerRounds for the current user
  const userPlayerRounds = playerRounds
    .filter(ur => ur.playerRound.playerId === currentUserId)
    .filter(ur => isPlayerRoundComplete(ur, expectedHoleCount));

  if (roundSelection === 'latest') {
    const sorted = [...userPlayerRounds].sort((a, b) => b.round.date - a.round.date);
    return sorted.length > 0 ? [sorted[0]] : [];
  }

  if (roundSelection === 'latest2') {
    const sorted = [...userPlayerRounds].sort((a, b) => b.round.date - a.round.date);
    return sorted.slice(0, 2);
  }

  if (roundSelection === 'latest3') {
    const sorted = [...userPlayerRounds].sort((a, b) => b.round.date - a.round.date);
    return sorted.slice(0, 3);
  }

  if (roundSelection === 'first') {
    const sorted = [...userPlayerRounds].sort((a, b) => a.round.date - b.round.date);
    return sorted.length > 0 ? [sorted[0]] : [];
  }

  if (roundSelection === 'bestRound' || roundSelection === 'bestRound2' || roundSelection === 'bestRounds2' || roundSelection === 'bestRounds3' || 
      roundSelection === 'worstRound' || roundSelection === 'worstRound2' || roundSelection === 'worstRounds2' || roundSelection === 'worstRounds3') {
    // Calculate total score for each playerRound
    const playerRoundsWithScores = userPlayerRounds.map(ur => {
      const completedScores = ur.scores.filter(s => isScoreComplete(s));
      const totalScore = completedScores.reduce((sum, score) => sum + score.score, 0);
      return { ...ur, totalScore, scoreCount: completedScores.length };
    }).filter(r => r.scoreCount > 0);

    if (playerRoundsWithScores.length === 0) {
      return [];
    }

    // Sort by total score (best = lowest, worst = highest)
    const isWorstSelection = roundSelection === 'worstRound' || roundSelection === 'worstRound2' || 
                            roundSelection === 'worstRounds2' || roundSelection === 'worstRounds3';
    playerRoundsWithScores.sort((a, b) => {
      if (isWorstSelection) {
        return b.totalScore - a.totalScore; // Higher is worse
      } else {
        return a.totalScore - b.totalScore; // Lower is better
      }
    });

    // Return the appropriate playerRound(s)
    if (roundSelection === 'bestRound' || roundSelection === 'worstRound') {
      return [playerRoundsWithScores[0]];
    } else if (roundSelection === 'bestRound2' || roundSelection === 'worstRound2') {
      return playerRoundsWithScores.length > 1 ? [playerRoundsWithScores[1]] : [];
    } else if (roundSelection === 'bestRounds2' || roundSelection === 'worstRounds2') {
      return playerRoundsWithScores.slice(0, 2);
    } else if (roundSelection === 'bestRounds3' || roundSelection === 'worstRounds3') {
      return playerRoundsWithScores.slice(0, 3);
    }
  }

  if (typeof roundSelection === 'object' && roundSelection.type === 'specific') {
    return playerRounds.filter(ur => roundSelection.roundIds.includes(ur.round.id));
  }

  return playerRounds;
}

/**
 * Compute percentile from sorted scores
 * 
 * IMPORTANT: For golf/disc golf, lower scores are better, so percentiles are inverted.
 * 
 * In golf, "Xth percentile" means "better than the worst X% of scores",
 * which means "X% of scores are HIGHER (worse) than this value".
 * 
 * This is the OPPOSITE of the standard percentile definition where "Xth percentile"
 * means "X% of values are at or below this value".
 * 
 * To get the golf percentile, we calculate the (100-X)th traditional percentile:
 * - 25th percentile (golf) = 75th percentile (traditional) = 75% at or below = 25% are HIGHER
 * - 75th percentile (golf) = 25th percentile (traditional) = 25% at or below = 75% are HIGHER
 * 
 * @param scores - Array of scores (will be sorted ascending)
 * @param percentile - The percentile to calculate (0-100), where X means "X% are HIGHER/worse"
 */
function computePercentile(scores: number[], percentile: number): number {
  if (scores.length === 0) return 0;
  const sorted = [...scores].sort((a, b) => a - b);
  
  // Invert the percentile: for golf, Xth percentile means X% are HIGHER, so we use (100-X)th traditional percentile
  const traditionalPercentile = 100 - percentile;
  const index = Math.ceil((traditionalPercentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

/**
 * Collect scores from playerRounds based on config
 */
function collectScoresFromPlayerRounds(
  config: CornerConfig,
  selectedPlayerRounds: PlayerRoundData[],
  currentPlayerId: string,
  holeNumber: number,
  expectedHoleCount: number,
  todaysPlayerIds?: string[]
): { scores: number[]; playerRounds: Array<{ userId: string; round: Round }> } {
  const playerRounds: Array<{ userId: string; round: Round }> = [];
  const scores: number[] = [];
  
  // Sort playerRounds by date to ensure we get the correct latest/first
  const sortedSelectedPlayerRounds = [...selectedPlayerRounds].sort((a, b) => {
    if (config.accumulationMode === 'latest') {
      return b.round.date - a.round.date; // Latest = most recent first
    } else if (config.accumulationMode === 'first') {
      return a.round.date - b.round.date; // First = earliest first
    }
    return 0;
  });
  
  // Track which users we've already added (for latest/first modes)
  const addedUsers = new Set<string>();
  
  // Step 1: Build user+round combinations based on scoreUserFilter
  for (const urData of sortedSelectedPlayerRounds) {
    // Check if this playerRound is complete
    if (!isPlayerRoundComplete(urData, expectedHoleCount)) {
      continue;
    }
    
    if (config.scoreUserFilter === 'eachUser') {
      // For eachUser, use the current player
      if (urData.playerRound.playerId !== currentPlayerId) {
        continue;
      }
      // For latest/first, only add once per user
      if (config.accumulationMode === 'latest' || config.accumulationMode === 'first') {
        if (addedUsers.has(currentPlayerId)) {
          continue; // Already added this user's round
        }
        addedUsers.add(currentPlayerId);
      }
      playerRounds.push({ userId: currentPlayerId, round: urData.round });
    } else if (config.scoreUserFilter === 'everyone') {
      // For everyone, include all users from the playerRounds
      // For latest/first, only add once per user
        if (config.accumulationMode === 'latest' || config.accumulationMode === 'first') {
        if (addedUsers.has(urData.playerRound.playerId)) {
            continue; // Already added this user's round
        }
        addedUsers.add(urData.playerRound.playerId);
      }
      playerRounds.push({ userId: urData.playerRound.playerId, round: urData.round });
    } else if (config.scoreUserFilter === 'todaysPlayers') {
      // For todaysPlayers, include today's players
      if (todaysPlayerIds && todaysPlayerIds.includes(urData.playerRound.playerId)) {
          // For latest/first, only add once per user
          if (config.accumulationMode === 'latest' || config.accumulationMode === 'first') {
          if (addedUsers.has(urData.playerRound.playerId)) {
              continue; // Already added this user's round
          }
          addedUsers.add(urData.playerRound.playerId);
        }
        playerRounds.push({ userId: urData.playerRound.playerId, round: urData.round });
      }
    } else if (Array.isArray(config.scoreUserFilter)) {
      // For specific users, include those users
      if (config.scoreUserFilter.includes(urData.playerRound.playerId)) {
        // For latest/first, only add once per user
        if (config.accumulationMode === 'latest' || config.accumulationMode === 'first') {
          if (addedUsers.has(urData.playerRound.playerId)) {
            continue; // Already added this user's round
          }
          addedUsers.add(urData.playerRound.playerId);
        }
        playerRounds.push({ userId: urData.playerRound.playerId, round: urData.round });
      }
    }
  }
  
  // Step 2: Collect scores from user+round combinations
  for (const { userId, round } of playerRounds) {
    // Find the playerRound data for this userId and round
    const urData = selectedPlayerRounds.find(ur => ur.playerRound.playerId === userId && ur.round.id === round.id);
    if (!urData) continue;
    
    if (config.userFilterMode === 'and' && Array.isArray(config.scoreUserFilter) && config.scoreUserFilter.length > 1) {
      // AND mode: Only collect if ALL selected users have scores for this hole in this round
      const allUsersHaveScores = config.scoreUserFilter.every(userId => {
        const ur = selectedPlayerRounds.find(ur => ur.playerRound.playerId === userId && ur.round.id === round.id);
        if (!ur || !isPlayerRoundComplete(ur, expectedHoleCount)) return false;
        const score = ur.scores.find(s => s.holeNumber === holeNumber);
        return score && isScoreComplete(score);
      });
      if (allUsersHaveScores) {
        // Collect scores from all selected users
        for (const userId of config.scoreUserFilter) {
          const ur = selectedPlayerRounds.find(ur => ur.playerRound.playerId === userId && ur.round.id === round.id);
          if (ur) {
            const score = ur.scores.find(s => s.holeNumber === holeNumber);
          if (score && isScoreComplete(score)) {
            scores.push(score.score);
            }
          }
        }
      }
    } else {
      // OR mode (default) or single user or everyone
      const score = urData.scores.find(s => s.holeNumber === holeNumber);
      if (score && isScoreComplete(score)) {
        scores.push(score.score);
      }
    }
  }
  
  return { scores, playerRounds };
}

/**
 * Compute corner value based on configuration
 */
export async function computeCornerValue(
  config: CornerConfig | null | undefined,
  courseId: string | undefined,
  holeNumber: number,
  playerId: string,
  todaysPlayerIds?: string[],
  currentRoundDate?: number
): Promise<{ value: string | number; visible: boolean }> {
  // If no config or empty, return invisible
  if (!config || !courseId) {
    return { value: '', visible: false };
  }

    try {
    // Get expected hole count
    const expectedHoleCount = await getExpectedHoleCount(courseId);
      
    // Convert date options to timestamps
    const sinceTimestamp = getSinceTimestamp(config.sinceDate);
    const untilTimestamp = getUntilTimestamp(config.untilDate);
    const beforeTimestamp = currentRoundDate;
    
    // Get playerRounds for this course with date filters
    let allPlayerRounds = await getPlayerRoundsForCourseInDateRange(
      courseId,
      sinceTimestamp,
      untilTimestamp,
      beforeTimestamp
    );
    
    // Filter to only completed playerRounds
    allPlayerRounds = allPlayerRounds.filter(ur => isPlayerRoundComplete(ur, expectedHoleCount));
    
    // Step 1: Filter playerRounds based on roundUserFilter (who played in the rounds)
    let roundFilteredPlayerRounds: typeof allPlayerRounds;
    if (config.roundUserFilter === 'eachUser') {
      // Filter to playerRounds where the current player is the player
      roundFilteredPlayerRounds = allPlayerRounds.filter(ur => ur.playerRound.playerId === playerId);
    } else if (Array.isArray(config.roundUserFilter) && config.roundUserFilter.length > 1) {
      // Multiple users selected - apply AND/OR logic
      const selectedUserIds = config.roundUserFilter;
      if (config.userFilterMode === 'and') {
        // AND: Only include rounds where ALL selected users have playerRounds
        // Group by round and check if all users are present
        const roundsByRoundId = new Map<string, typeof allPlayerRounds>();
        for (const ur of allPlayerRounds) {
          if (!roundsByRoundId.has(ur.round.id)) {
            roundsByRoundId.set(ur.round.id, []);
          }
          roundsByRoundId.get(ur.round.id)!.push(ur);
        }
        roundFilteredPlayerRounds = allPlayerRounds.filter(ur => {
          const roundPlayerRounds = roundsByRoundId.get(ur.round.id) || [];
          const userIdsInRound = new Set(roundPlayerRounds.map(ur => ur.playerRound.playerId));
          return selectedUserIds.every(userId => userIdsInRound.has(userId));
        });
      } else {
        // OR (default): Include playerRounds where ANY selected user is the player
        roundFilteredPlayerRounds = allPlayerRounds.filter(ur => selectedUserIds.includes(ur.playerRound.playerId));
      }
    } else if (config.roundUserFilter === 'todaysPlayers') {
      // For 'todaysPlayers', apply AND/OR logic based on userFilterMode
      if (todaysPlayerIds && todaysPlayerIds.length > 0) {
        if (todaysPlayerIds.length > 1 && config.userFilterMode === 'and') {
          // AND mode: Only include rounds where ALL of today's players have playerRounds
          const roundsByRoundId = new Map<string, typeof allPlayerRounds>();
          for (const ur of allPlayerRounds) {
            if (!roundsByRoundId.has(ur.round.id)) {
              roundsByRoundId.set(ur.round.id, []);
            }
            roundsByRoundId.get(ur.round.id)!.push(ur);
          }
          roundFilteredPlayerRounds = allPlayerRounds.filter(ur => {
            const roundPlayerRounds = roundsByRoundId.get(ur.round.id) || [];
            const userIdsInRound = new Set(roundPlayerRounds.map(ur => ur.playerRound.playerId));
            return todaysPlayerIds.every(userId => userIdsInRound.has(userId));
          });
        } else {
          // OR mode (default): Include playerRounds where ANY of today's players is the player
          roundFilteredPlayerRounds = allPlayerRounds.filter(ur => todaysPlayerIds.includes(ur.playerRound.playerId));
        }
      } else {
        roundFilteredPlayerRounds = allPlayerRounds;
      }
    } else {
      // Single user or everyone - use standard filter
      roundFilteredPlayerRounds = filterPlayerRoundsByUser(
        allPlayerRounds, 
        config.roundUserFilter, 
        undefined,
        todaysPlayerIds
      );
    }

    // Step 2: Select playerRounds based on criteria (latest, first, all, etc.)
    const selectedPlayerRounds = selectPlayerRoundsByCriteria(
      roundFilteredPlayerRounds,
      config.roundSelection,
      config.accumulationMode,
      playerId,
      expectedHoleCount
    );

    // Step 3: Collect scores using the shared logic
    const { scores, playerRounds } = collectScoresFromPlayerRounds(
      config,
      selectedPlayerRounds,
      playerId,
      holeNumber,
      expectedHoleCount,
      todaysPlayerIds
    );

    if (scores.length === 0) {
      return { value: '', visible: false };
    }

    // Apply accumulation mode
    let result: number;
    switch (config.accumulationMode) {
      case 'best':
        result = Math.min(...scores);
        break;
      case 'worst':
        result = Math.max(...scores);
        break;
      case 'average':
        result = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
        break;
      case 'latest':
        // Scores are collected in order (latest first), so the last one is from the latest round
        result = scores[scores.length - 1];
        break;
      case 'first':
        // Scores are collected in order (first first), so the first one is from the earliest round
        result = scores[0];
        break;
      case 'percentile':
        if (config.percentile === undefined) {
          return { value: '', visible: false };
        }
        result = computePercentile(scores, config.percentile);
        break;
      case 'relevant':
        // For 'relevant', we should have exactly one round per player
        // Return the score from that round (first score found)
        result = scores[0];
        break;
      default:
        return { value: '', visible: false };
    }

    if (result === 0 || isNaN(result)) {
      return { value: '', visible: false };
    }

    return { value: result, visible: true };
  } catch (error) {
    console.error('Error computing corner value:', error);
    return { value: '', visible: false };
  }
}

/**
 * Compute all corner values for a cell
 * @param playerId - The ID of the player whose column we're computing for (used when scoreUserFilter is 'eachUser')
 * @param currentRoundDate - Timestamp of the current round being viewed (to exclude rounds that started at the same time or after)
 */
export async function computeCellCornerValues(
  config: CornerStatisticsConfig,
  courseId: string | undefined,
  holeNumber: number,
  playerId: string,
  todaysPlayerIds?: string[],
  currentRoundDate?: number
): Promise<{
  topLeft: { value: string | number; visible: boolean };
  topRight: { value: string | number; visible: boolean };
  bottomLeft: { value: string | number; visible: boolean };
  bottomRight: { value: string | number; visible: boolean };
}> {
  const [topLeft, topRight, bottomLeft, bottomRight] = await Promise.all([
    computeCornerValue(config.topLeft, courseId, holeNumber, playerId, todaysPlayerIds, currentRoundDate),
    computeCornerValue(config.topRight, courseId, holeNumber, playerId, todaysPlayerIds, currentRoundDate),
    computeCornerValue(config.bottomLeft, courseId, holeNumber, playerId, todaysPlayerIds, currentRoundDate),
    computeCornerValue(config.bottomRight, courseId, holeNumber, playerId, todaysPlayerIds, currentRoundDate),
  ]);

  return { topLeft, topRight, bottomLeft, bottomRight };
}

/**
 * Compute total corner values for completed holes
 * @param playerId - The ID of the player whose column we're computing for (used when scoreUserFilter is 'eachUser')
 * @param currentRoundDate - Timestamp of the current round being viewed (to exclude rounds that started at the same time or after)
 */
export async function computeTotalCornerValues(
  config: CornerStatisticsConfig,
  courseId: string | undefined,
  holes: number[],
  scores: Score[],
  playerId: string,
  todaysPlayerIds?: string[],
  currentRoundDate?: number
): Promise<{
  topLeft: { value: string | number; visible: boolean };
  topRight: { value: string | number; visible: boolean };
  bottomLeft: { value: string | number; visible: boolean };
  bottomRight: { value: string | number; visible: boolean };
}> {
  // Get holes that have non-zero scores for this player
  const completedHoles = new Set<number>();
  for (const score of scores) {
    if (isScoreComplete(score) && score.playerId === playerId) {
      completedHoles.add(score.holeNumber!);
    }
  }

  // Compute corner values for each completed hole
  const cornerValues: {
    topLeft: number[];
    topRight: number[];
    bottomLeft: number[];
    bottomRight: number[];
  } = {
    topLeft: [],
    topRight: [],
    bottomLeft: [],
    bottomRight: [],
  };

  for (const holeNumber of Array.from(completedHoles)) {
    const cellValues = await computeCellCornerValues(config, courseId, holeNumber, playerId, todaysPlayerIds, currentRoundDate);
    
    if (cellValues.topLeft.visible && typeof cellValues.topLeft.value === 'number') {
      cornerValues.topLeft.push(cellValues.topLeft.value);
    }
    if (cellValues.topRight.visible && typeof cellValues.topRight.value === 'number') {
      cornerValues.topRight.push(cellValues.topRight.value);
    }
    if (cellValues.bottomLeft.visible && typeof cellValues.bottomLeft.value === 'number') {
      cornerValues.bottomLeft.push(cellValues.bottomLeft.value);
    }
    if (cellValues.bottomRight.visible && typeof cellValues.bottomRight.value === 'number') {
      cornerValues.bottomRight.push(cellValues.bottomRight.value);
    }
  }

  // Sum the values
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  return {
    topLeft: {
      value: cornerValues.topLeft.length > 0 ? sum(cornerValues.topLeft) : 0,
      visible: cornerValues.topLeft.length > 0,
    },
    topRight: {
      value: cornerValues.topRight.length > 0 ? sum(cornerValues.topRight) : 0,
      visible: cornerValues.topRight.length > 0,
    },
    bottomLeft: {
      value: cornerValues.bottomLeft.length > 0 ? sum(cornerValues.bottomLeft) : 0,
      visible: cornerValues.bottomLeft.length > 0,
    },
    bottomRight: {
      value: cornerValues.bottomRight.length > 0 ? sum(cornerValues.bottomRight) : 0,
      visible: cornerValues.bottomRight.length > 0,
    },
  };
}

/**
 * Filter playerRounds by user
 */
export function filterRoundsByUser(
  playerRounds: PlayerRoundData[],
  userFilter: UserFilter,
  currentUserId?: string,
  todaysPlayerIds?: string[]
): PlayerRoundData[] {
  return filterPlayerRoundsByUser(playerRounds, userFilter, currentUserId, todaysPlayerIds);
}

/**
 * Select playerRounds based on round selection criteria
 */
export async function selectRoundsByCriteria(
  playerRounds: PlayerRoundData[],
  roundSelection: RoundSelection | undefined,
  accumulationMode: AccumulationMode,
  currentUserId: string
): Promise<PlayerRoundData[]> {
  // Get expected hole count from the first playerRound's round's course
  if (playerRounds.length === 0) {
    return [];
  }
  
  const courseId = playerRounds[0].round.courseId;
  if (!courseId) {
    return [];
  }
  
  const expectedHoleCount = await getExpectedHoleCount(courseId);
  
  return selectPlayerRoundsByCriteria(playerRounds, roundSelection, accumulationMode, currentUserId, expectedHoleCount);
}
