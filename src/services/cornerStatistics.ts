/**
 * Service for computing corner statistics from round data
 * Refactored to use playerRounds (playerRounds) directly from database
 */

import type { PlayerRoundWithDetails, Score, Round } from './storage/db';
import {
  getPlayerRoundsForCourseInDateRange,
  getExpectedHoleCount
} from './storage/playerRoundQueries';

/**
 * PlayerRound data with related round, player, and scores
 * Alias for PlayerRoundWithDetails from db types
 */
export type PlayerRoundData = PlayerRoundWithDetails;

/**
 * Enum for user filter options
 */
export enum UserFilterEnum {
  /** Include all rounds from everyone */
  Everyone = 'everyone',
  /** Each player's column uses their own rounds (each respective player) */
  EachUser = 'eachUser',
  /** Players from today's round */
  TodaysPlayers = 'todaysPlayers',
}

/**
 * Filter for which users' data to include
 * - UserFilterEnum: Include all rounds from everyone, each user, or today's players
 * - string[]: Array of user IDs - compare each player against these users' rounds
 */
export type UserFilter = 
  | UserFilterEnum
  | string[];

/**
 * Enum for accumulation modes - how to combine multiple scores
 */
export enum AccumulationModeEnum {
  /** Use the best (lowest) score */
  Best = 'best',
  /** Use the latest (most recent) score */
  Latest = 'latest',
  /** Use the first (earliest) score */
  First = 'first',
  /** Use the worst (highest) score */
  Worst = 'worst',
  /** Use the average of all scores */
  Average = 'average',
  /** Use a percentile of all scores */
  Percentile = 'percentile',
  /** Use the relevant score (one round per player) */
  Relevant = 'relevant',
}

/**
 * How to accumulate multiple scores into a single value
 */
export type AccumulationMode = AccumulationModeEnum;

/**
 * Enum for the scope of the statistic
 */
export enum ScopeEnum {
  /** Statistic applies to the entire round */
  Round = 'round',
  /** Statistic applies to a single hole */
  Hole = 'hole',
}

/**
 * The scope of the statistic (round or hole level)
 */
export type Scope = ScopeEnum;

/**
 * Enum for round selection criteria
 */
export enum RoundSelectionEnum {
  /** Include all rounds */
  All = 'all',
  /** Include only the latest round */
  Latest = 'latest',
  /** Include the 2nd latest round */
  Latest2 = 'latest2',
  /** Include the 3rd latest round */
  Latest3 = 'latest3',
  /** Include only the first round */
  First = 'first',
  /** Include only the best (lowest total score) round */
  BestRound = 'bestRound',
  /** Include the 2nd best round */
  BestRound2 = 'bestRound2',
  /** Include the 2 best rounds */
  BestRounds2 = 'bestRounds2',
  /** Include the 3 best rounds */
  BestRounds3 = 'bestRounds3',
  /** Include only the worst (highest total score) round */
  WorstRound = 'worstRound',
  /** Include the 2nd worst round */
  WorstRound2 = 'worstRound2',
  /** Include the 2 worst rounds */
  WorstRounds2 = 'worstRounds2',
  /** Include the 3 worst rounds */
  WorstRounds3 = 'worstRounds3',
}

/**
 * Enum for round selection type (used in object-based selections)
 */
export enum RoundSelectionTypeEnum {
  /** Select specific rounds by their IDs */
  Specific = 'specific',
  /** Custom date option */
  Custom = 'custom',
}

/**
 * Selection criteria for which rounds to include
 * - RoundSelectionEnum: Predefined selection (all, latest, first, best/worst rounds, etc.)
 * - Object with type RoundSelectionTypeEnum.Specific: Specific round IDs to include
 */
export type RoundSelection = 
  | RoundSelectionEnum
  | { type: RoundSelectionTypeEnum.Specific; roundIds: string[] };

/**
 * Enum for user filter mode when multiple users are selected
 */
export enum UserFilterModeEnum {
  /** All users must be present in the round */
  And = 'and',
  /** Any user can be present in the round */
  Or = 'or',
}

/**
 * For multiple user selection: UserFilterModeEnum.And = all users must be in round, UserFilterModeEnum.Or = any user can be in round
 */
export type UserFilterMode = UserFilterModeEnum;

/**
 * Enum for "since date" options
 */
export enum SinceDateOptionEnum {
  /** From the beginning of time */
  Beginning = 'beginning',
  /** From one year ago */
  YearAgo = 'yearAgo',
  /** From one month ago */
  MonthAgo = 'monthAgo',
}

/**
 * Enum for "until date" options
 */
export enum UntilDateOptionEnum {
  /** Until today (end of day) */
  Today = 'today',
  /** Until yesterday (end of day) */
  Yesterday = 'yesterday',
}

/**
 * Date option for filtering rounds from a starting date
 * - SinceDateOptionEnum: Predefined options (beginning, yearAgo, monthAgo)
 * - Object with type RoundSelectionTypeEnum.Custom: Custom timestamp
 */
export type SinceDateOption = SinceDateOptionEnum | { type: RoundSelectionTypeEnum.Custom; timestamp: number };

/**
 * Date option for filtering rounds until an ending date
 * - UntilDateOptionEnum: Predefined options (today, yesterday)
 * - Object with type RoundSelectionTypeEnum.Custom: Custom timestamp
 */
export type UntilDateOption = UntilDateOptionEnum | { type: RoundSelectionTypeEnum.Custom; timestamp: number };

/**
 * Configuration for a single corner statistic
 */
export interface CornerConfig {
  /** Which users' scores to consider from the filtered rounds */
  scoreUserFilter: UserFilter;
  /** Which rounds to include based on who played in them */
  roundUserFilter: UserFilter;
  /** Used when either scoreUserFilter or roundUserFilter is an array with multiple users (UserFilterModeEnum.And = all users must be present, UserFilterModeEnum.Or = any user can be present) */
  userFilterMode?: UserFilterMode;
  /** How to accumulate the scores (best, worst, average, latest, first, percentile, or relevant) */
  accumulationMode: AccumulationMode;
  /** The scope of the statistic (round or hole) */
  scope: Scope;
  /** Required if accumulationMode is not AccumulationModeEnum.Latest or AccumulationModeEnum.First */
  roundSelection?: RoundSelection;
  /** Required if accumulationMode is AccumulationModeEnum.Percentile (0-100) */
  percentile?: number;
  /** Optional: filter rounds to those on or after this date */
  sinceDate?: SinceDateOption;
  /** Optional: filter rounds to those on or before this date */
  untilDate?: UntilDateOption;
  /** Optional: name of the preset that was used to create this config */
  presetName?: string;
  /** Optional: if true, automatically color the corner based on comparison with cell value (red if corner < cell, yellow/orange if equal, green if corner > cell) */
  autoColor?: boolean;
  /** Optional: custom hex color for the corner (only used if autoColor is not true) */
  customColor?: string;
}



/**
 * Check if a score represents a completed hole
 * @param score - The score to check
 * @returns True if the score is marked as complete
 */
function isScoreComplete(score: Score): boolean {
    return score.complete === true;
  }

/**
 * Check if a playerRound is complete (has all holes marked as complete)
 * @param playerRoundData - The playerRound data with scores
 * @param expectedHoleCount - The expected number of holes for the round
 * @returns True if the playerRound has all expected holes completed
 */
function isPlayerRoundComplete(playerRoundData: { scores: Score[] }, expectedHoleCount: number): boolean {
  if (playerRoundData.scores.length === 0) return false;
  
  const completedScores = playerRoundData.scores.filter(s => isScoreComplete(s));
  const uniqueHoles = new Set(completedScores.map(s => s.holeNumber));
  
  return uniqueHoles.size >= expectedHoleCount;
}

/**
 * Convert date options to timestamps
 * @param sinceDate - The date option to convert (beginning, yearAgo, monthAgo, or custom timestamp)
 * @returns The timestamp in milliseconds, or undefined if no date provided
 */
function getSinceTimestamp(sinceDate?: SinceDateOption): number | undefined {
  if (!sinceDate) return undefined;
  
  if (sinceDate === SinceDateOptionEnum.Beginning) {
    return 0;
  } else if (sinceDate === SinceDateOptionEnum.YearAgo) {
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    yearAgo.setHours(0, 0, 0, 0);
    return yearAgo.getTime();
  } else if (sinceDate === SinceDateOptionEnum.MonthAgo) {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    monthAgo.setHours(0, 0, 0, 0);
    return monthAgo.getTime();
  } else {
    return sinceDate.timestamp;
  }
}

/**
 * Convert until date options to timestamps
 * @param untilDate - The date option to convert (today, yesterday, or custom timestamp)
 * @returns The timestamp in milliseconds, or undefined if no date provided
 */
function getUntilTimestamp(untilDate?: UntilDateOption): number | undefined {
  if (!untilDate) return undefined;
  
  if (untilDate === UntilDateOptionEnum.Today) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return today.getTime();
  } else if (untilDate === UntilDateOptionEnum.Yesterday) {
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
 * @param playerRounds - The playerRounds to filter
 * @param userFilter - The user filter to apply (UserFilterEnum or array of user IDs)
 * @param currentUserId - Optional current user ID for 'eachUser' filter
 * @param todaysPlayerIds - Optional array of today's player IDs for 'todaysPlayers' filter
 * @returns Filtered playerRounds based on the user filter
 */
function filterPlayerRoundsByUser(
  playerRounds: PlayerRoundData[],
  userFilter: UserFilter,
  currentUserId?: string,
  todaysPlayerIds?: string[]
): PlayerRoundData[] {
  if (userFilter === UserFilterEnum.Everyone) {
    return playerRounds;
  }
  if (userFilter === UserFilterEnum.EachUser) {
    if (currentUserId) {
      return playerRounds.filter(ur => ur.playerRound.playerId === currentUserId);
    }
    return playerRounds;
  }
  if (userFilter === UserFilterEnum.TodaysPlayers) {
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
 * @param playerRounds - The playerRounds to select from
 * @param roundSelection - The round selection criteria (RoundSelectionEnum or specific round IDs)
 * @param accumulationMode - The accumulation mode (affects behavior for 'latest' and 'first')
 * @param currentUserId - The current user ID for filtering
 * @param expectedHoleCount - The expected number of holes for completeness check
 * @returns Selected playerRounds based on the criteria
 */
function selectPlayerRoundsByCriteria(
  playerRounds: PlayerRoundData[],
  roundSelection: RoundSelection | undefined,
  accumulationMode: AccumulationMode,
  currentUserId: string,
  expectedHoleCount: number
): PlayerRoundData[] {
  // If accumulation mode is 'latest' or 'first', we use all playerRounds (they'll be sorted later)
  if (accumulationMode === AccumulationModeEnum.Latest || accumulationMode === AccumulationModeEnum.First) {
    return playerRounds;
  }

  // If no round selection provided, default to 'all'
  if (!roundSelection) {
    return playerRounds;
  }

  if (roundSelection === RoundSelectionEnum.All) {
    return playerRounds;
  }

  // Filter to only completed playerRounds for the current user
  const userPlayerRounds = playerRounds
    .filter(ur => ur.playerRound.playerId === currentUserId)
    .filter(ur => isPlayerRoundComplete(ur, expectedHoleCount));

  if (roundSelection === RoundSelectionEnum.Latest) {
    const sorted = [...userPlayerRounds].sort((a, b) => b.round.date - a.round.date);
    return sorted.length > 0 ? [sorted[0]] : [];
  }

  if (roundSelection === RoundSelectionEnum.Latest2) {
    const sorted = [...userPlayerRounds].sort((a, b) => b.round.date - a.round.date);
    return sorted.slice(0, 2);
  }

  if (roundSelection === RoundSelectionEnum.Latest3) {
    const sorted = [...userPlayerRounds].sort((a, b) => b.round.date - a.round.date);
    return sorted.slice(0, 3);
  }

  if (roundSelection === RoundSelectionEnum.First) {
    const sorted = [...userPlayerRounds].sort((a, b) => a.round.date - b.round.date);
    return sorted.length > 0 ? [sorted[0]] : [];
  }

  if (roundSelection === RoundSelectionEnum.BestRound || roundSelection === RoundSelectionEnum.BestRound2 || roundSelection === RoundSelectionEnum.BestRounds2 || roundSelection === RoundSelectionEnum.BestRounds3 || 
      roundSelection === RoundSelectionEnum.WorstRound || roundSelection === RoundSelectionEnum.WorstRound2 || roundSelection === RoundSelectionEnum.WorstRounds2 || roundSelection === RoundSelectionEnum.WorstRounds3) {
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
    const isWorstSelection = roundSelection === RoundSelectionEnum.WorstRound || roundSelection === RoundSelectionEnum.WorstRound2 || 
                            roundSelection === RoundSelectionEnum.WorstRounds2 || roundSelection === RoundSelectionEnum.WorstRounds3;
    playerRoundsWithScores.sort((a, b) => {
      if (isWorstSelection) {
        return b.totalScore - a.totalScore; // Higher is worse
      } else {
        return a.totalScore - b.totalScore; // Lower is better
      }
    });

    // Return the appropriate playerRound(s)
    if (roundSelection === RoundSelectionEnum.BestRound || roundSelection === RoundSelectionEnum.WorstRound) {
      return [playerRoundsWithScores[0]];
    } else if (roundSelection === RoundSelectionEnum.BestRound2 || roundSelection === RoundSelectionEnum.WorstRound2) {
      return playerRoundsWithScores.length > 1 ? [playerRoundsWithScores[1]] : [];
    } else if (roundSelection === RoundSelectionEnum.BestRounds2 || roundSelection === RoundSelectionEnum.WorstRounds2) {
      return playerRoundsWithScores.slice(0, 2);
    } else if (roundSelection === RoundSelectionEnum.BestRounds3 || roundSelection === RoundSelectionEnum.WorstRounds3) {
      return playerRoundsWithScores.slice(0, 3);
    }
  }

  if (typeof roundSelection === 'object' && roundSelection.type === RoundSelectionTypeEnum.Specific) {
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
 * @param config - The corner configuration
 * @param selectedPlayerRounds - The playerRounds to collect scores from
 * @param currentPlayerId - The current player ID (used when scoreUserFilter is UserFilterEnum.EachUser)
 * @param holeNumber - The hole number to collect scores for
 * @param expectedHoleCount - The expected number of holes for completeness check
 * @param todaysPlayerIds - Optional array of today's player IDs
 * @returns Object containing collected scores and associated playerRounds
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
    if (config.accumulationMode === AccumulationModeEnum.Latest) {
      return b.round.date - a.round.date; // Latest = most recent first
    } else if (config.accumulationMode === AccumulationModeEnum.First) {
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
    
    if (config.scoreUserFilter === UserFilterEnum.EachUser) {
      // For eachUser, use the current player
      if (urData.playerRound.playerId !== currentPlayerId) {
        continue;
      }
      // For latest/first, only add once per user
      if (config.accumulationMode === AccumulationModeEnum.Latest || config.accumulationMode === AccumulationModeEnum.First) {
        if (addedUsers.has(currentPlayerId)) {
          continue; // Already added this user's round
        }
        addedUsers.add(currentPlayerId);
      }
      playerRounds.push({ userId: currentPlayerId, round: urData.round });
    } else if (config.scoreUserFilter === UserFilterEnum.Everyone) {
      // For everyone, include all users from the playerRounds
      // For latest/first, only add once per user
        if (config.accumulationMode === AccumulationModeEnum.Latest || config.accumulationMode === AccumulationModeEnum.First) {
        if (addedUsers.has(urData.playerRound.playerId)) {
            continue; // Already added this user's round
        }
        addedUsers.add(urData.playerRound.playerId);
      }
      playerRounds.push({ userId: urData.playerRound.playerId, round: urData.round });
    } else if (config.scoreUserFilter === UserFilterEnum.TodaysPlayers) {
      // For todaysPlayers, include today's players
      if (todaysPlayerIds && todaysPlayerIds.includes(urData.playerRound.playerId)) {
          // For latest/first, only add once per user
          if (config.accumulationMode === AccumulationModeEnum.Latest || config.accumulationMode === AccumulationModeEnum.First) {
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
        if (config.accumulationMode === AccumulationModeEnum.Latest || config.accumulationMode === AccumulationModeEnum.First) {
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
    
    if (config.userFilterMode === UserFilterModeEnum.And && Array.isArray(config.scoreUserFilter) && config.scoreUserFilter.length > 1) {
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
 * @param config - The corner configuration (null/undefined returns invisible)
 * @param courseId - The course ID to compute statistics for
 * @param holeNumber - The hole number to compute statistics for
 * @param playerId - The player ID whose column we're computing for (used when scoreUserFilter is UserFilterEnum.EachUser)
 * @param todaysPlayerIds - Optional array of today's player IDs
 * @param currentRoundDate - Optional timestamp of the current round being viewed (to exclude rounds that started at the same time or after)
 * @returns Promise resolving to an object with the computed value and visibility flag
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
    if (config.roundUserFilter === UserFilterEnum.EachUser) {
      // Filter to playerRounds where the current player is the player
      roundFilteredPlayerRounds = allPlayerRounds.filter(ur => ur.playerRound.playerId === playerId);
    } else if (Array.isArray(config.roundUserFilter) && config.roundUserFilter.length > 1) {
      // Multiple users selected - apply AND/OR logic
      const selectedUserIds = config.roundUserFilter;
      if (config.userFilterMode === UserFilterModeEnum.And) {
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
    } else if (config.roundUserFilter === UserFilterEnum.TodaysPlayers) {
      // For 'todaysPlayers', apply AND/OR logic based on userFilterMode
      if (todaysPlayerIds && todaysPlayerIds.length > 0) {
        if (todaysPlayerIds.length > 1 && config.userFilterMode === UserFilterModeEnum.And) {
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
      case AccumulationModeEnum.Best:
        result = Math.min(...scores);
        break;
      case AccumulationModeEnum.Worst:
        result = Math.max(...scores);
        break;
      case AccumulationModeEnum.Average:
        result = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
        break;
      case AccumulationModeEnum.Latest:
        // Scores are collected in order (latest first), so the last one is from the latest round
        result = scores[scores.length - 1];
        break;
      case AccumulationModeEnum.First:
        // Scores are collected in order (first first), so the first one is from the earliest round
        result = scores[0];
        break;
      case AccumulationModeEnum.Percentile:
        if (config.percentile === undefined) {
          return { value: '', visible: false };
        }
        result = computePercentile(scores, config.percentile);
        break;
      case AccumulationModeEnum.Relevant:
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
 * @param config - The corner statistics configuration
 * @param courseId - The course ID to compute statistics for
 * @param holeNumber - The hole number to compute statistics for
 * @param playerId - The ID of the player whose column we're computing for (used when scoreUserFilter is UserFilterEnum.EachUser)
 * @param todaysPlayerIds - Optional array of today's player IDs
 * @param currentRoundDate - Timestamp of the current round being viewed (to exclude rounds that started at the same time or after)
 * @returns Promise resolving to an object with corner values for all four corners
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
 * @param config - The corner statistics configuration
 * @param courseId - The course ID to compute statistics for
 * @param holes - Array of hole numbers
 * @param scores - Array of scores to check for completed holes
 * @param playerId - The ID of the player whose column we're computing for (used when scoreUserFilter is UserFilterEnum.EachUser)
 * @param todaysPlayerIds - Optional array of today's player IDs
 * @param currentRoundDate - Timestamp of the current round being viewed (to exclude rounds that started at the same time or after)
 * @returns Promise resolving to an object with total corner values for all four corners (sum of all completed holes)
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
 * @param playerRounds - The playerRounds to filter
 * @param userFilter - The user filter to apply (UserFilterEnum or array of user IDs)
 * @param currentUserId - Optional current user ID for 'eachUser' filter
 * @param todaysPlayerIds - Optional array of today's player IDs for 'todaysPlayers' filter
 * @returns Filtered playerRounds based on the user filter
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
 * @param playerRounds - The playerRounds to select from
 * @param roundSelection - The round selection criteria (RoundSelectionEnum or specific round IDs)
 * @param accumulationMode - The accumulation mode (affects behavior for 'latest' and 'first')
 * @param currentUserId - The current user ID for filtering
 * @returns Promise resolving to selected playerRounds based on the criteria
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
