/**
 * Golf Match Play Scoring Method
 * 
 * Head-to-head hole-by-hole competition.
 * Each hole is won, lost, or halved. The player who wins more holes wins the match.
 */

import { ScoringMethod } from '../../schema/scoring';
import type { StageScoringInfo, EventScoringInfo, SimpleGroupResult, SimplePlayerResult } from '../../schema/scoring';
import { z } from 'zod';

export class GolfMatchPlay extends ScoringMethod {
  readonly name = 'golf-match-play';
  readonly description = 'Golf match play: Head-to-head hole-by-hole competition.';
  sportType = 'golf';
  readonly higherPointsBetter = true; // Higher points (more holes won) are better in match play
  propagatesToSiblingStages = false; // Modifying an old hole doesn't affect other holes
  valueSchema = z.number().int().min(0); // Validate: non-negative integer

  scoreStage = (info: StageScoringInfo): SimpleGroupResult => {
    const { playerValues } = info;
    const playerIds = Object.keys(playerValues);
    
    if (playerIds.length !== 2) {
      throw new Error('Match play requires exactly 2 players');
    }

    const [player1Id, player2Id] = playerIds;
    const value1 = Number(playerValues[player1Id]);
    const value2 = Number(playerValues[player2Id]);

    if (isNaN(value1) || isNaN(value2)) {
      return {
        playerResults: {
          [player1Id]: {
            value: playerValues[player1Id],
            points: 0,
            scoreType: 'incomplete',
            stats: {},
          },
          [player2Id]: {
            value: playerValues[player2Id],
            points: 0,
            scoreType: 'incomplete',
            stats: {},
          },
        },
        stats: {},
      };
    }

    let scoreType1 = 'halved';
    let scoreType2 = 'halved';
    let points1 = 0;
    let points2 = 0;

    if (value1 < value2) {
      scoreType1 = 'won';
      scoreType2 = 'lost';
      points1 = 1;
      points2 = 0;
    } else if (value2 < value1) {
      scoreType1 = 'lost';
      scoreType2 = 'won';
      points1 = 0;
      points2 = 1;
    } else {
      // Tie - halved
      scoreType1 = 'halved';
      scoreType2 = 'halved';
      points1 = 0.5;
      points2 = 0.5;
    }

    return {
      playerResults: {
        [player1Id]: {
          value: value1,
          points: points1,
          scoreType: scoreType1,
          stats: {
            opponentScore: value2,
            difference: value1 - value2,
          },
        },
        [player2Id]: {
          value: value2,
          points: points2,
          scoreType: scoreType2,
          stats: {
            opponentScore: value1,
            difference: value2 - value1,
          },
        },
      },
      stats: {},
    };
  };

  scoreEvent = (info: EventScoringInfo): SimpleGroupResult => {
    const { aggregated, stageResults } = info;
    
    if (stageResults.length === 0) {
      return {
        stats: {},
      };
    }

    // Use precomputed aggregated points, but calculate match-specific stats
    const holesWon: Record<string, number> = {};
    const holesLost: Record<string, number> = {};
    const holesHalved: Record<string, number> = {};
    const playerIds = new Set<string>();

    for (const stageResult of stageResults) {
      for (const [playerId, result] of Object.entries(stageResult.playerResults)) {
        playerIds.add(playerId);
        if (!holesWon[playerId]) {
          holesWon[playerId] = 0;
          holesLost[playerId] = 0;
          holesHalved[playerId] = 0;
        }
        if (result.scoreType === 'won') {
          holesWon[playerId]++;
        } else if (result.scoreType === 'lost') {
          holesLost[playerId]++;
        } else if (result.scoreType === 'halved') {
          holesHalved[playerId]++;
        }
      }
    }

    const playerIdsArray = Array.from(playerIds);
    const playerResults: Record<string, SimplePlayerResult> = {};
    
    for (const playerId of playerIdsArray) {
      const netHoles = holesWon[playerId] - holesLost[playerId];
      // Use precomputed points from aggregated, or calculate from holes if not available
      const aggregatedResult = aggregated.playerResults?.[playerId];
      const totalPoints = aggregatedResult?.points !== undefined && aggregatedResult.points !== null
        ? aggregatedResult.points
        : null;
      
      playerResults[playerId] = {
        value: netHoles,
        points: totalPoints, // Use precomputed sum from aggregated
        scoreType: 'match-total',
        stats: {
          holesWon: holesWon[playerId],
          holesLost: holesLost[playerId],
          holesHalved: holesHalved[playerId],
          netHoles,
        },
      };
    }

    return {
      playerResults,
      stats: {
        totalHoles: stageResults.length,
        totalPlayers: playerIdsArray.length,
        ...aggregated.stats,
      },
    };
  };

  formatValue = (value: any): string => {
    if (typeof value === 'number') {
      return value.toString();
    }
    return String(value);
  };
}

export const golfMatchPlay = new GolfMatchPlay();
