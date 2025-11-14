/**
 * Golf Stroke Play Scoring Method
 * 
 * Used for golf where lower scores are better.
 * Players accumulate strokes across holes, and the lowest total wins.
 */

import { ScoringMethod } from '../../../schema/generic-sports-data/scoring';
import type { EventScoringInfo, SimpleGroupResult, SimplePlayerResult, ValueToScoreType, StageMetadata } from '../../../schema/generic-sports-data/scoring';
import type { EventStage } from '../../../schema/generic-sports-data/tables';
import { z } from 'zod';

export class GolfStrokePlay extends ScoringMethod {
  readonly name = 'golf-stroke-play';
  readonly description = 'Golf stroke play: Lower scores are better. Total strokes across all holes.';
  sportType = 'golf';
  readonly higherPointsBetter = false; // Lower points (strokes) are better in golf
  propagatesToSiblingStages = false; // Modifying an old hole doesn't affect other holes
  valueSchema = z.number().int().min(0); // Validate: non-negative integer

  // Points are one-to-one with strokes (default valueToPoints is identity function)
  // No need to override valueToPoints

  valueToScoreType = (value: any, stageInfo: { stage: EventStage; metadata: StageMetadata | null }): string => {
    // Determine score type based on value and par (if available)
    const par = stageInfo.metadata?.par;
    if (par !== undefined && typeof value === 'number') {
      const diff = value - par;
      if (value === 1) return 'hole-in-one';
      if (diff === -2) return 'double-eagle';
      if (diff === -1) return 'eagle';
      if (diff === 0) return 'par';
      if (diff === 1) return 'bogey';
      if (diff === 2) return 'double-bogey';
      if (diff > 2) return `+${diff}`;
    }
    return 'par'; // Default
  };

  scoreEvent = (info: EventScoringInfo): SimpleGroupResult => {
    const { aggregated, stageResults } = info;
    
    if (stageResults.length === 0) {
      return {
        stats: {},
      };
    }

    // Use precomputed aggregated results - just add custom stats
    // The aggregated already has value and points summed from all stages
    const playerResults: Record<string, SimplePlayerResult> = {};
    
    if (aggregated.playerResults) {
      for (const [playerId, aggregatedResult] of Object.entries(aggregated.playerResults)) {
        const totalStrokes = aggregatedResult.value !== null && typeof aggregatedResult.value === 'number' 
          ? aggregatedResult.value 
          : null;
        const totalPoints = aggregatedResult.points !== null 
          ? aggregatedResult.points 
          : null;
        
        playerResults[playerId] = {
          value: totalStrokes,
          points: totalPoints, // Points = strokes (one-to-one)
          scoreType: 'total',
          stats: {
            totalStrokes,
            totalPoints,
            holesPlayed: stageResults.length,
            averageStrokes: totalStrokes !== null && stageResults.length > 0 
              ? totalStrokes / stageResults.length 
              : null,
          },
        };
      }
    }

    return {
      playerResults,
      stats: {
        totalHoles: stageResults.length,
        totalPlayers: aggregated.playerResults ? Object.keys(aggregated.playerResults).length : 0,
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

export const golfStrokePlay = new GolfStrokePlay();

