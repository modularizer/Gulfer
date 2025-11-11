/**
 * Service for computing corner statistics from round data
 */

import { Round, Score } from '../types';
import { getAllRounds } from './storage/roundStorage';

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
}

export interface CornerStatisticsConfig {
  topLeft?: CornerConfig | null;
  topRight?: CornerConfig | null;
  bottomLeft?: CornerConfig | null;
  bottomRight?: CornerConfig | null;
}

/**
 * Get all rounds for a specific course
 */
async function getRoundsForCourse(courseName: string): Promise<Round[]> {
  const allRounds = await getAllRounds();
  return allRounds.filter(r => r.courseName === courseName);
}

/**
 * Check if a round is complete for a user (has score >= 1 on all holes)
 */
function isRoundComplete(round: Round, userId: string, expectedHoleCount: number): boolean {
  const userScores = round.scores?.filter(s => s.playerId === userId) || [];
  if (userScores.length === 0) return false;
  
  // Get unique hole numbers with scores >= 1
  const completedHoles = new Set(
    userScores.filter(s => s.throws >= 1).map(s => s.holeNumber)
  );
  
  // Check if we have scores for all expected holes
  return completedHoles.size >= expectedHoleCount;
}

/**
 * Filter rounds to only include completed rounds for the relevant user(s)
 * A completed round means every hole has a nonzero score for the user
 */
function filterCompletedRounds(
  rounds: Round[],
  scoreUserFilter: UserFilter,
  currentUserId: string,
  expectedHoleCount: number,
  todaysPlayerIds?: string[]
): Round[] {
  if (scoreUserFilter === 'eachUser') {
    // Only include rounds where currentUserId has completed the round
    return rounds.filter(round => 
      isRoundComplete(round, currentUserId, expectedHoleCount)
    );
  } else if (scoreUserFilter === 'everyone') {
    // For 'everyone', we need to check if at least one user in the round has completed it
    // But actually, we should filter to rounds where ALL players have completed it
    // OR we could filter to rounds where at least one player has completed it
    // The user said "completed userrounds" - so I think we should only include rounds
    // where at least one player has completed it, and we'll only use scores from completed user+rounds
    // Actually, let me re-read: "ONLY consider completed userrounds, meaning every hole has a nonzero score"
    // This means for each user+round combination, we only consider it if that user has completed the round
    // So we should filter rounds to only include those where at least one user has completed it
    // But we'll still filter scores later to only use scores from users who completed the round
    return rounds.filter(round => {
      // Check if at least one player in the round has completed it
      return round.players.some(player => 
        isRoundComplete(round, player.id, expectedHoleCount)
      );
    });
  } else if (scoreUserFilter === 'todaysPlayers') {
    // For 'todaysPlayers', only include rounds where at least one of today's players has completed it
    if (todaysPlayerIds && todaysPlayerIds.length > 0) {
      return rounds.filter(round => {
        return todaysPlayerIds.some(userId => 
          isRoundComplete(round, userId, expectedHoleCount)
        );
      });
    }
    return rounds;
  } else if (Array.isArray(scoreUserFilter)) {
    // Only include rounds where at least one of the selected users has completed it
    return rounds.filter(round => {
      return scoreUserFilter.some(userId => 
        isRoundComplete(round, userId, expectedHoleCount)
      );
    });
  }
  return rounds;
}

/**
 * Get expected hole count from course or rounds
 */
function getExpectedHoleCount(rounds: Round[]): number {
  if (rounds.length === 0) return 0;
  
  // Find the maximum number of unique holes across all rounds
  let maxHoles = 0;
  for (const round of rounds) {
    const uniqueHoles = new Set(round.scores?.map(s => s.holeNumber) || []);
    maxHoles = Math.max(maxHoles, uniqueHoles.size);
  }
  
  return maxHoles;
}

/**
 * Filter rounds by user
 * Note: 'eachUser' mode is handled at the computation level, not here
 */
export function filterRoundsByUser(rounds: Round[], userFilter: UserFilter, currentUserId?: string, todaysPlayerIds?: string[]): Round[] {
  if (userFilter === 'everyone') {
    return rounds;
  }
  if (userFilter === 'eachUser') {
    // For 'eachUser', filter to rounds where the current user is a player
    if (currentUserId) {
      return rounds.filter(round => 
        round.players.some(p => p.id === currentUserId)
      );
    }
    return rounds;
  }
  if (userFilter === 'todaysPlayers') {
    // For 'todaysPlayers', filter to rounds where at least one of today's players is a player
    if (todaysPlayerIds && todaysPlayerIds.length > 0) {
      return rounds.filter(round => 
        round.players.some(p => todaysPlayerIds.includes(p.id))
      );
    }
    return rounds;
  }
  // Filter to rounds based on selected users
  if (Array.isArray(userFilter) && userFilter.length > 0) {
    // Note: userFilterMode is handled at the computation level, not here
    // This function just filters to rounds where at least one selected user is a player
    return rounds.filter(round => 
      round.players.some(p => userFilter.includes(p.id))
    );
  }
  return rounds;
}


/**
 * Select rounds based on round selection criteria
 */
export async function selectRoundsByCriteria(
  rounds: Round[],
  roundSelection: RoundSelection | undefined,
  accumulationMode: AccumulationMode,
  currentUserId: string
): Promise<Round[]> {
  // If accumulation mode is 'latest' or 'first', we use all rounds (they'll be sorted later)
  if (accumulationMode === 'latest' || accumulationMode === 'first') {
    return rounds;
  }

  // If no round selection provided, default to 'all'
  if (!roundSelection) {
    return rounds;
  }

  if (roundSelection === 'all') {
    return rounds;
  }

  if (roundSelection === 'latest') {
    const sorted = [...rounds].sort((a, b) => b.date - a.date);
    return sorted.length > 0 ? [sorted[0]] : [];
  }

  if (roundSelection === 'latest2') {
    const sorted = [...rounds].sort((a, b) => b.date - a.date);
    return sorted.slice(0, 2);
  }

  if (roundSelection === 'latest3') {
    const sorted = [...rounds].sort((a, b) => b.date - a.date);
    return sorted.slice(0, 3);
  }

  if (roundSelection === 'first') {
    const sorted = [...rounds].sort((a, b) => a.date - b.date);
    return sorted.length > 0 ? [sorted[0]] : [];
  }

  if (roundSelection === 'bestRound' || roundSelection === 'bestRound2' || roundSelection === 'bestRounds2' || roundSelection === 'bestRounds3' || 
      roundSelection === 'worstRound' || roundSelection === 'worstRound2' || roundSelection === 'worstRounds2' || roundSelection === 'worstRounds3') {
    // Calculate total score for each round for the current user
    // Only consider completed rounds (all holes have nonzero scores)
    const expectedHoleCount = getExpectedHoleCount(rounds);
    const roundsWithScores = rounds
      .filter(round => isRoundComplete(round, currentUserId, expectedHoleCount)) // Only completed rounds
      .map(round => {
        const userScores = round.scores?.filter(s => s.playerId === currentUserId && s.throws >= 1) || [];
        const totalScore = userScores.reduce((sum, score) => sum + score.throws, 0);
        return { round, totalScore, scoreCount: userScores.length };
      })
      .filter(r => r.scoreCount > 0); // Only include rounds where user has at least one score (should be all holes if complete)

    if (roundsWithScores.length === 0) {
      return [];
    }

    // Sort by total score (best = lowest, worst = highest)
    const isWorstSelection = roundSelection === 'worstRound' || roundSelection === 'worstRound2' || 
                            roundSelection === 'worstRounds2' || roundSelection === 'worstRounds3';
    roundsWithScores.sort((a, b) => {
      if (isWorstSelection) {
        return b.totalScore - a.totalScore; // Higher is worse
      } else {
        return a.totalScore - b.totalScore; // Lower is better
      }
    });

    // Return the appropriate round(s)
    if (roundSelection === 'bestRound' || roundSelection === 'worstRound') {
      return [roundsWithScores[0].round];
    } else if (roundSelection === 'bestRound2' || roundSelection === 'worstRound2') {
      // Second best/worst round
      return roundsWithScores.length > 1 ? [roundsWithScores[1].round] : [];
    } else if (roundSelection === 'bestRounds2' || roundSelection === 'worstRounds2') {
      // Best/Worst 2 rounds
      return roundsWithScores.slice(0, 2).map(r => r.round);
    } else if (roundSelection === 'bestRounds3' || roundSelection === 'worstRounds3') {
      // Best/Worst 3 rounds
      return roundsWithScores.slice(0, 3).map(r => r.round);
    }
  }

  if (typeof roundSelection === 'object' && roundSelection.type === 'specific') {
    return rounds.filter(r => roundSelection.roundIds.includes(r.id));
  }

  return rounds;
}

/**
 * Compute percentile from sorted scores
 */
function computePercentile(scores: number[], percentile: number): number {
  if (scores.length === 0) return 0;
  const sorted = [...scores].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

/**
 * User+Round combination for score collection
 */
interface UserRound {
  userId: string;
  round: Round;
}

/**
 * Collect scores from user+round combinations based on config
 * This is the core logic that matches the preview computation
 */
function collectScoresFromUserRounds(
  config: CornerConfig,
  selectedRounds: Round[],
  currentPlayerId: string,
  holeNumber: number,
  expectedHoleCount: number,
  todaysPlayerIds?: string[]
): { scores: number[]; userRounds: UserRound[] } {
  const userRounds: UserRound[] = [];
  const scores: number[] = [];
  
  // Sort rounds by date to ensure we get the correct latest/first
  const sortedSelectedRounds = [...selectedRounds].sort((a, b) => {
    if (config.accumulationMode === 'latest') {
      return b.date - a.date; // Latest = most recent first
    } else if (config.accumulationMode === 'first') {
      return a.date - b.date; // First = earliest first
    }
    return 0;
  });
  
  // Track which users we've already added (for latest/first modes)
  const addedUsers = new Set<string>();
  
  // Step 1: Build user+round combinations based on scoreUserFilter
  for (const round of sortedSelectedRounds) {
    if (config.scoreUserFilter === 'eachUser') {
      // For eachUser, use the current player
      // Only include if the player has completed the round
      if (!isRoundComplete(round, currentPlayerId, expectedHoleCount)) {
        continue;
      }
      // For latest/first, only add once per user
      if (config.accumulationMode === 'latest' || config.accumulationMode === 'first') {
        if (addedUsers.has(currentPlayerId)) {
          continue; // Already added this user's round
        }
        addedUsers.add(currentPlayerId);
      }
      if (round.players.some(p => p.id === currentPlayerId)) {
        userRounds.push({ userId: currentPlayerId, round });
      }
    } else if (config.scoreUserFilter === 'everyone') {
      // For everyone, include all users from the round who have completed it
      // For latest/first, only add once per user
      for (const roundPlayer of round.players) {
        // Only include if this user has completed the round
        if (!isRoundComplete(round, roundPlayer.id, expectedHoleCount)) {
          continue;
        }
        if (config.accumulationMode === 'latest' || config.accumulationMode === 'first') {
          if (addedUsers.has(roundPlayer.id)) {
            continue; // Already added this user's round
          }
          addedUsers.add(roundPlayer.id);
        }
        userRounds.push({ userId: roundPlayer.id, round });
      }
    } else if (config.scoreUserFilter === 'todaysPlayers') {
      // For todaysPlayers, include today's players from the round who have completed it
      if (todaysPlayerIds && todaysPlayerIds.length > 0) {
        for (const userId of todaysPlayerIds) {
          // Check if this user is in the round and has completed it
          if (!round.players.some(p => p.id === userId) ||
              !isRoundComplete(round, userId, expectedHoleCount)) {
            continue; // User not in this round or hasn't completed it
          }
          
          // For latest/first, only add once per user
          if (config.accumulationMode === 'latest' || config.accumulationMode === 'first') {
            if (addedUsers.has(userId)) {
              continue; // Already added this user's round
            }
            addedUsers.add(userId);
          }
          
          userRounds.push({ userId, round });
        }
      }
    } else if (Array.isArray(config.scoreUserFilter)) {
      // For specific users, include those users from this round who have completed it
      for (const userId of config.scoreUserFilter) {
        // Check if this user is in the round and has completed it
        if (!round.players.some(p => p.id === userId) ||
            !isRoundComplete(round, userId, expectedHoleCount)) {
          continue; // User not in this round or hasn't completed it
        }
        
        // For latest/first, only add once per user
        if (config.accumulationMode === 'latest' || config.accumulationMode === 'first') {
          if (addedUsers.has(userId)) {
            continue; // Already added this user's round
          }
          addedUsers.add(userId);
        }
        
        userRounds.push({ userId, round });
      }
    }
  }
  
  // Step 2: Collect scores from user+round combinations
  for (const userRound of userRounds) {
    if (config.userFilterMode === 'and' && Array.isArray(config.scoreUserFilter) && config.scoreUserFilter.length > 1) {
      // AND mode: Only collect if ALL selected users have scores for this hole in this round
      const allUsersHaveScores = config.scoreUserFilter.every(userId => {
        if (!isRoundComplete(userRound.round, userId, expectedHoleCount)) return false;
        const score = userRound.round.scores?.find(s => s.holeNumber === holeNumber && s.playerId === userId);
        return score && score.throws >= 1;
      });
      if (allUsersHaveScores) {
        // Collect scores from all selected users
        for (const userId of config.scoreUserFilter) {
          const score = userRound.round.scores?.find(s => s.holeNumber === holeNumber && s.playerId === userId);
          if (score && score.throws >= 1) {
            scores.push(score.throws);
          }
        }
      }
    } else {
      // OR mode (default) or single user or everyone
      const score = userRound.round.scores?.find(s => s.holeNumber === holeNumber && s.playerId === userRound.userId);
      if (score && score.throws >= 1) {
        scores.push(score.throws);
      }
    }
  }
  
  return { scores, userRounds };
}

/**
 * Compute corner value based on configuration
 * @param playerId - The ID of the player whose column we're computing for (used when scoreUserFilter is 'eachUser')
 * @param currentRoundDate - Timestamp of the current round being viewed (to exclude rounds that started at the same time or after)
 */
export async function computeCornerValue(
  config: CornerConfig | null | undefined,
  courseName: string | undefined,
  holeNumber: number,
  playerId: string,
  todaysPlayerIds?: string[],
  currentRoundDate?: number
): Promise<{ value: string | number; visible: boolean }> {
  // If no config or empty, return invisible
  if (!config || !courseName) {
    return { value: '', visible: false };
  }

    try {
    // Get all rounds for this course
    let courseRounds = await getRoundsForCourse(courseName);
    
    // Get expected hole count for completion checking
    const expectedHoleCount = getExpectedHoleCount(courseRounds);
    
    // Step 0: Filter rounds by date (since/until) - applied first
    // Note: round.date is a timestamp. We need to compare dates in local timezone.
    if (config.sinceDate) {
      let sinceTimestamp: number;
      if (config.sinceDate === 'beginning') {
        sinceTimestamp = 0; // Beginning of time
      } else if (config.sinceDate === 'yearAgo') {
        const yearAgo = new Date();
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        yearAgo.setHours(0, 0, 0, 0); // Start of day in local timezone
        sinceTimestamp = yearAgo.getTime();
      } else if (config.sinceDate === 'monthAgo') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        monthAgo.setHours(0, 0, 0, 0); // Start of day in local timezone
        sinceTimestamp = monthAgo.getTime();
      } else {
        // Custom date - timestamp should already be set to start of day (00:00:00.000) in local timezone
        sinceTimestamp = config.sinceDate.timestamp;
      }
      // Filter: round.date >= sinceTimestamp (inclusive from start of since date)
      courseRounds = courseRounds.filter(round => round.date >= sinceTimestamp);
    }
    if (config.untilDate) {
      let untilTimestamp: number;
      if (config.untilDate === 'today') {
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today in local timezone
        untilTimestamp = today.getTime();
      } else if (config.untilDate === 'yesterday') {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(23, 59, 59, 999); // End of yesterday in local timezone
        untilTimestamp = yesterday.getTime();
      } else {
        // Custom date - timestamp should already be set to end of day (23:59:59.999) in local timezone
        untilTimestamp = config.untilDate.timestamp;
      }
      // Filter: round.date <= untilTimestamp (inclusive until end of until date)
      courseRounds = courseRounds.filter(round => round.date <= untilTimestamp);
    }
    
    // CRITICAL: Always exclude rounds that started at the same time or after the current round
    // This ensures we only consider historical data, not future or concurrent rounds
    if (currentRoundDate !== undefined) {
      // Exclude rounds where round.date >= currentRoundDate
      // We want rounds.date < currentRoundDate (strictly before)
      courseRounds = courseRounds.filter(round => round.date < currentRoundDate);
    }
    
    // Step 0.5: VERY IMPORTANT - Filter to only include completed rounds (every hole has nonzero score)
    // This must be done early, before any other filtering
    courseRounds = filterCompletedRounds(
      courseRounds,
      config.scoreUserFilter,
      playerId,
      expectedHoleCount,
      todaysPlayerIds
    );
    
    // Step 1: Filter rounds based on roundUserFilter (who played in the rounds)
    let roundFilteredRounds: Round[];
    if (config.roundUserFilter === 'eachUser') {
      // Filter to rounds where the current player is a player
      roundFilteredRounds = courseRounds.filter(round => 
        round.players.some(p => p.id === playerId)
      );
    } else if (Array.isArray(config.roundUserFilter) && config.roundUserFilter.length > 1) {
      // Multiple users selected - apply AND/OR logic
      const selectedUserIds = config.roundUserFilter; // Type guard: we know it's an array here
      if (config.userFilterMode === 'and') {
        // AND: Only include rounds where ALL selected users are players
        roundFilteredRounds = courseRounds.filter(round => 
          selectedUserIds.every((userId: string) => 
            round.players.some(p => p.id === userId)
          )
        );
      } else {
        // OR (default): Include rounds where ANY selected user is a player
        roundFilteredRounds = courseRounds.filter(round => 
          round.players.some(p => selectedUserIds.includes(p.id))
        );
      }
    } else if (config.roundUserFilter === 'todaysPlayers') {
      // For 'todaysPlayers', apply AND/OR logic based on userFilterMode
      if (todaysPlayerIds && todaysPlayerIds.length > 0) {
        if (todaysPlayerIds.length > 1 && config.userFilterMode === 'and') {
          // AND mode: Only include rounds where ALL of today's players are present
          roundFilteredRounds = courseRounds.filter(round => 
            todaysPlayerIds.every((userId: string) => 
              round.players.some(p => p.id === userId)
            )
          );
        } else {
          // OR mode (default): Include rounds where ANY of today's players is a player
          roundFilteredRounds = courseRounds.filter(round => 
            round.players.some(p => todaysPlayerIds.includes(p.id))
          );
        }
      } else {
        roundFilteredRounds = courseRounds;
      }
    } else {
      // Single user or everyone - use standard filter
      roundFilteredRounds = filterRoundsByUser(
        courseRounds, 
        config.roundUserFilter, 
        undefined,
        todaysPlayerIds
      );
    }

    // Step 2: Select rounds based on criteria (latest, first, all, etc.)
    const selectedRounds = await selectRoundsByCriteria(
      roundFilteredRounds,
      config.roundSelection,
      config.accumulationMode,
      playerId
    );

    // Step 3: Collect scores using the shared logic (matches preview computation)
    // This computes userRounds and scores independently for this player's column
    const { scores } = collectScoresFromUserRounds(
      config,
      selectedRounds,
      playerId,
      holeNumber,
      expectedHoleCount,
      todaysPlayerIds
    );

    if (scores.length === 0) {
      return { value: '', visible: false };
    }

    // Apply accumulation mode (matches preview logic)
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
        const sorted = [...scores].sort((a, b) => a - b);
        const index = Math.ceil((config.percentile / 100) * sorted.length) - 1;
        result = sorted[Math.max(0, Math.min(index, sorted.length - 1))];
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
  courseName: string | undefined,
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
    computeCornerValue(config.topLeft, courseName, holeNumber, playerId, todaysPlayerIds, currentRoundDate),
    computeCornerValue(config.topRight, courseName, holeNumber, playerId, todaysPlayerIds, currentRoundDate),
    computeCornerValue(config.bottomLeft, courseName, holeNumber, playerId, todaysPlayerIds, currentRoundDate),
    computeCornerValue(config.bottomRight, courseName, holeNumber, playerId, todaysPlayerIds, currentRoundDate),
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
  courseName: string | undefined,
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
    if (score.throws > 0 && score.playerId === playerId) {
      completedHoles.add(score.holeNumber);
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
    const cellValues = await computeCellCornerValues(config, courseName, holeNumber, playerId, todaysPlayerIds, currentRoundDate);
    
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

