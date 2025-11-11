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
 * Compute corner value based on configuration
 */
export async function computeCornerValue(
  config: CornerConfig | null | undefined,
  courseName: string | undefined,
  holeNumber: number,
  currentUserId: string,
  todaysPlayerIds?: string[]
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
    
    // Step 0.5: VERY IMPORTANT - Filter to only include completed rounds (every hole has nonzero score)
    // This must be done early, before any other filtering
    courseRounds = filterCompletedRounds(
      courseRounds,
      config.scoreUserFilter,
      currentUserId,
      expectedHoleCount,
      todaysPlayerIds
    );
    
    // Step 1: Filter rounds based on roundUserFilter (who played in the rounds)
    let roundFilteredRounds: Round[];
    if (config.roundUserFilter === 'eachUser') {
      // Filter to rounds where the current user is a player
      roundFilteredRounds = courseRounds.filter(round => 
        round.players.some(p => p.id === currentUserId)
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
      currentUserId
    );


    // Collect scores based on scope
    const scores: number[] = [];
    
    // Step 3: Determine which user IDs to get scores for from the filtered rounds
    // This is based on scoreUserFilter (which users' scores to consider)
    let scoreUserId: string | undefined;
    let scoreUserIds: string[] | undefined;
    
    if (config.scoreUserFilter === 'eachUser') {
      scoreUserId = currentUserId; // Always use current user's scores
      scoreUserIds = [currentUserId];
    } else if (config.scoreUserFilter === 'everyone') {
      scoreUserId = undefined; // Include all users' scores from the filtered rounds
      scoreUserIds = undefined;
    } else if (config.scoreUserFilter === 'todaysPlayers') {
      // For 'todaysPlayers', use today's player IDs
      if (todaysPlayerIds && todaysPlayerIds.length > 0) {
        if (todaysPlayerIds.length === 1) {
          scoreUserId = todaysPlayerIds[0];
          scoreUserIds = [todaysPlayerIds[0]];
        } else {
          scoreUserIds = todaysPlayerIds;
          scoreUserId = todaysPlayerIds.includes(currentUserId)
            ? currentUserId
            : todaysPlayerIds[0];
        }
      } else {
        scoreUserId = undefined;
        scoreUserIds = undefined;
      }
    } else if (Array.isArray(config.scoreUserFilter)) {
      if (config.scoreUserFilter.length === 1) {
        // Single user selected
        scoreUserId = config.scoreUserFilter[0];
        scoreUserIds = [config.scoreUserFilter[0]];
      } else {
        // Multiple users selected - collect scores from all selected users
        scoreUserIds = config.scoreUserFilter;
        scoreUserId = config.scoreUserFilter.includes(currentUserId)
          ? currentUserId
          : config.scoreUserFilter[0];
      }
    }

    // Sort rounds by date to ensure correct order for 'latest' and 'first' modes
    const sortedRounds = [...selectedRounds].sort((a, b) => {
      if (config.accumulationMode === 'latest' || config.accumulationMode === 'first') {
        // For latest/first, sort by date (latest = descending, first = ascending)
        return config.accumulationMode === 'latest' ? b.date - a.date : a.date - b.date;
      }
      // For other modes, maintain original order
      return 0;
    });

    if (config.scope === 'hole') {
      // Directly get scores for this hole from selected rounds
      // Only use scores from users who have completed the round
      for (const round of sortedRounds) {
        if (scoreUserIds && scoreUserIds.length > 1 && config.userFilterMode === 'and') {
          // AND mode: Only include scores if ALL selected users have scores for this hole in this round
          const allUsersHaveScores = scoreUserIds.every(userId => {
            if (!isRoundComplete(round, userId, expectedHoleCount)) return false;
            const score = round.scores?.find(s => s.holeNumber === holeNumber && s.playerId === userId);
            return score && score.throws >= 1;
          });
          if (allUsersHaveScores) {
            // Collect scores from all selected users
            for (const userId of scoreUserIds) {
              const score = round.scores?.find(s => s.holeNumber === holeNumber && s.playerId === userId);
              if (score && score.throws >= 1) {
                scores.push(score.throws);
              }
            }
          }
        } else {
          // OR mode (default) or single user or everyone
          const roundScores = round.scores?.filter(
            s => {
              if (s.holeNumber !== holeNumber) return false;
              // Only include scores from users who have completed the round
              if (!isRoundComplete(round, s.playerId, expectedHoleCount)) return false;
              if (!scoreUserIds && !scoreUserId) return true; // Everyone mode
              if (scoreUserIds) {
                return scoreUserIds.includes(s.playerId); // Multiple users (OR mode - collect from all)
              }
              return s.playerId === scoreUserId; // Single user
            }
          ) || [];
          roundScores.forEach(s => {
            if (s.throws >= 1) {
              scores.push(s.throws);
            }
          });
        }
      }
    } else {
      // Scope is 'round' - first select round(s), then get hole from that round
      // For each selected round, get the score for this hole from the appropriate user(s)
      // Only use scores from users who have completed the round
      for (const round of sortedRounds) {
        if (scoreUserIds && scoreUserIds.length > 1) {
          if (config.userFilterMode === 'and') {
            // AND mode: Only include scores if ALL selected users have scores for this hole in this round
            const allUsersHaveScores = scoreUserIds.every(userId => {
              if (!isRoundComplete(round, userId, expectedHoleCount)) return false;
              const score = round.scores?.find(s => s.holeNumber === holeNumber && s.playerId === userId);
              return score && score.throws >= 1;
            });
            if (allUsersHaveScores) {
              // Collect scores from all selected users
              for (const userId of scoreUserIds) {
                const holeScore = round.scores?.find(
                  s => s.holeNumber === holeNumber && s.playerId === userId
                );
                if (holeScore && holeScore.throws >= 1) {
                  scores.push(holeScore.throws);
                }
              }
            }
          } else {
            // OR mode (default) - collect scores from all selected users in this round
            for (const userId of scoreUserIds) {
              // Only include if this user has completed the round
              if (!isRoundComplete(round, userId, expectedHoleCount)) continue;
              const holeScore = round.scores?.find(
                s => s.holeNumber === holeNumber && s.playerId === userId
              );
              if (holeScore && holeScore.throws >= 1) {
                scores.push(holeScore.throws);
              }
            }
          }
        } else {
          // Single user or everyone
          const userIdToCheck = scoreUserId;
          if (userIdToCheck) {
            // Single user - only include if they completed the round
            if (!isRoundComplete(round, userIdToCheck, expectedHoleCount)) continue;
          }
          // For everyone mode, we already filtered rounds to only include those where at least one user completed it
          // But we still need to check per-user when collecting scores
          const holeScore = round.scores?.find(
            s => {
              if (s.holeNumber !== holeNumber) return false;
              // Only include if this user has completed the round
              if (!isRoundComplete(round, s.playerId, expectedHoleCount)) return false;
              return !scoreUserId || s.playerId === scoreUserId;
            }
          );
          if (holeScore && holeScore.throws >= 1) {
            scores.push(holeScore.throws);
          }
        }
      }
    }

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
        const sum = scores.reduce((a, b) => a + b, 0);
        result = Math.round((sum / scores.length) * 10) / 10;
        break;
      case 'latest':
        // For 'latest' mode, we should already have the latest round(s) selected
        // But if we have multiple scores, take the one from the latest round
        if (scores.length > 0) {
          // Scores are already collected in order, so the last one is from the latest round
          result = scores[scores.length - 1];
        } else {
          // Fallback: get latest round and its score
          const latestRound = [...selectedRounds].sort((a, b) => b.date - a.date)[0];
          if (!latestRound) {
            return { value: '', visible: false };
          }
          const latestScore = latestRound.scores?.find(
            s => s.holeNumber === holeNumber && (!scoreUserId || s.playerId === scoreUserId)
          );
          result = latestScore?.throws || 0;
        }
        break;
      case 'first':
        // For 'first' mode, we should already have the first round(s) selected
        // Take the first score (from the earliest round)
        if (scores.length > 0) {
          result = scores[0];
        } else {
          // Fallback: get first round and its score
          const firstRound = [...selectedRounds].sort((a, b) => a.date - b.date)[0];
          if (!firstRound) {
            return { value: '', visible: false };
          }
          const firstScore = firstRound.scores?.find(
            s => s.holeNumber === holeNumber && (!scoreUserId || s.playerId === scoreUserId)
          );
          result = firstScore?.throws || 0;
        }
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
 */
export async function computeCellCornerValues(
  config: CornerStatisticsConfig,
  courseName: string | undefined,
  holeNumber: number,
  currentUserId: string,
  todaysPlayerIds?: string[]
): Promise<{
  topLeft: { value: string | number; visible: boolean };
  topRight: { value: string | number; visible: boolean };
  bottomLeft: { value: string | number; visible: boolean };
  bottomRight: { value: string | number; visible: boolean };
}> {
  const [topLeft, topRight, bottomLeft, bottomRight] = await Promise.all([
    computeCornerValue(config.topLeft, courseName, holeNumber, currentUserId, todaysPlayerIds),
    computeCornerValue(config.topRight, courseName, holeNumber, currentUserId, todaysPlayerIds),
    computeCornerValue(config.bottomLeft, courseName, holeNumber, currentUserId, todaysPlayerIds),
    computeCornerValue(config.bottomRight, courseName, holeNumber, currentUserId, todaysPlayerIds),
  ]);

  return { topLeft, topRight, bottomLeft, bottomRight };
}

/**
 * Compute total corner values for completed holes
 */
export async function computeTotalCornerValues(
  config: CornerStatisticsConfig,
  courseName: string | undefined,
  holes: number[],
  scores: Score[],
  currentUserId: string,
  todaysPlayerIds?: string[]
): Promise<{
  topLeft: { value: string | number; visible: boolean };
  topRight: { value: string | number; visible: boolean };
  bottomLeft: { value: string | number; visible: boolean };
  bottomRight: { value: string | number; visible: boolean };
}> {
  // Get holes that have non-zero scores
  const completedHoles = new Set<number>();
  for (const score of scores) {
    if (score.throws > 0) {
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
    const cellValues = await computeCellCornerValues(config, courseName, holeNumber, currentUserId, todaysPlayerIds);
    
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

