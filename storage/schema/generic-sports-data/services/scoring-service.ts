/**
 * Scoring Service
 * 
 * Handles scoring operations for events and stages.
 * Automatically recomputes scores when a player's score is updated.
 */

import { BaseService } from './base';
import { eq, and } from 'drizzle-orm';
import * as schema from '../tables';
import type { ParticipantEventStageScoreInsert } from '../tables';
import { queryEvents, type EventWithDetails, upsertEntity } from '../query-builders';
import { computeGroupResult, aggregateStageResults, StageScoringInfo, EventScoringInfo, GroupResult, getScoringMethod, precomputeStageStats, defaultScoreStage, recomputeStatsFromResult } from '../scoring';
import { generateUUID } from '@utils/uuid';

export class ScoringService extends BaseService {
  /**
   * Set or update a score for a participant on a specific stage
   * This will automatically recompute all scores for that stage and update totals
   */
  async setStageScore(
    eventId: string,
    eventStageId: string,
    participantId: string,
    value: any
  ): Promise<void> {
    // Get the event with all stages and participants
    const event = await queryEvents(this.db)
      .withVenueAndFormat()
      .withParticipants()
      .withStages()
      .where(eq(schema.events.id, eventId))
      .execute()
      .then(results => results[0] || null);

    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }

    // Find the stage
    const stage = event.stages.find(s => s.stage.id === eventStageId);
    if (!stage) {
      throw new Error(`Stage not found: ${eventStageId} in event ${eventId}`);
    }

    // Verify participant is in the event
    const participant = event.participants.find(p => p.id === participantId);
    if (!participant) {
      throw new Error(`Participant ${participantId} not found in event ${eventId}`);
    }

    // Get score format and scoring method
    if (!event.scoreFormat) {
      throw new Error(`Event has no score format`);
    }

    const scoringMethod = getScoringMethod(event.scoreFormat.scoringMethodName);
    if (!scoringMethod) {
      throw new Error(`Scoring method "${event.scoreFormat.scoringMethodName}" not found`);
    }

    // Validate the value using the scoring method's validation
    if (!scoringMethod.validateValue(value)) {
      throw new Error(`Invalid score value for scoring method "${scoringMethod.name}": ${JSON.stringify(value)}`);
    }

    // Get or create the score record
    const existingScores = await this.db
      .select()
      .from(schema.participantEventStageScores)
      .where(
        and(
          eq(schema.participantEventStageScores.eventStageId, eventStageId),
          eq(schema.participantEventStageScores.participantId, participantId)
        )
      )
      .limit(1);

    const scoreId = existingScores.length > 0 
      ? existingScores[0].id 
      : generateUUID();

    // Get existing score to preserve baseColumns if it exists
    const existingScore = existingScores.length > 0 ? existingScores[0] : null;
    
    // Update the score value
    await upsertEntity(this.db, schema.participantEventStageScores, {
      id: scoreId,
      name: existingScore?.name || null,
      notes: existingScore?.notes || null,
      lat: existingScore?.lat ?? stage.stage.lat ?? null,
      lng: existingScore?.lng ?? stage.stage.lng ?? null,
      metadata: existingScore?.metadata || null,
      eventStageId,
      participantId,
      scoreFormatId: event.scoreFormat.id,
      value,
      complete: true,
      completedAt: new Date(),
    } as Partial<ParticipantEventStageScoreInsert>, { id: scoreId });

    // Recompute all scores for this stage
    await this.recomputeStageScores(event, eventStageId);
  }

  /**
   * Recompute all scores for a specific stage
   * This updates all participants' scores, points, rankings, etc. for the stage
   */
  private async recomputeStageScores(
    event: EventWithDetails,
    eventStageId: string
  ): Promise<void> {
    const stage = event.stages.find(s => s.stage.id === eventStageId);
    if (!stage || !event.scoreFormat) {
      return;
    }

    const scoringMethod = getScoringMethod(event.scoreFormat.scoringMethodName);
    if (!scoringMethod) {
      return;
    }

    // Get all scores for this stage
    const stageScores = await this.db
      .select()
      .from(schema.participantEventStageScores)
      .where(eq(schema.participantEventStageScores.eventStageId, eventStageId));

    // Build player values map
    const playerValues: Record<string, any> = {};
    for (const score of stageScores) {
      if (score.value !== null && score.value !== undefined) {
        playerValues[score.participantId] = score.value;
      }
    }

    // Get previous stage results for cumulative scoring
    const previousStageResults: GroupResult[] = [];
    const currentStageIndex = event.stages.findIndex(s => s.stage.id === eventStageId);
    
    if (currentStageIndex > 0) {
      // Get all previous stages' results
      for (let i = 0; i < currentStageIndex; i++) {
        const prevStage = event.stages[i];
        const prevStageResult = await this.getStageResult(event, prevStage.stage.id);
        if (prevStageResult) {
          previousStageResults.push(prevStageResult);
        }
      }
    }

    // Precompute stats before calling scoreStage
    const precomputedStats = precomputeStageStats(playerValues, scoringMethod.valueToPoints);

    // Score the stage
    const stageInfo: StageScoringInfo = {
      playerValues,
      previousStageResults,
      stageInfo: {
        stage: stage.stage,
        metadata: stage.stage.metadata || stage.venueEventFormatStage?.metadata || stage.eventFormatStage?.metadata || null,
      },
      eventInfo: {
        eventId: event.event.id,
        metadata: event.event.metadata,
      },
      precomputedStats,
    };

    // Use custom scoreStage if provided, otherwise use default implementation
    let simpleResult = scoringMethod.scoreStage
      ? scoringMethod.scoreStage(stageInfo)
      : defaultScoreStage(scoringMethod, stageInfo);
    
    // Recompute stats after scoreStage (it may have modified points)
    const recomputedStats = recomputeStatsFromResult(simpleResult);
    simpleResult = {
      ...simpleResult,
      stats: {
        ...simpleResult.stats,
        ...recomputedStats, // Override with recomputed stats
      },
    };
    
    const groupResult = computeGroupResult(simpleResult, scoringMethod.higherPointsBetter);

    // Update all scores with computed results
    const scoreUpdates: Partial<ParticipantEventStageScoreInsert>[] = [];
    
    for (const [participantId, playerResult] of Object.entries(groupResult.playerResults)) {
      const existingScore = stageScores.find(s => s.participantId === participantId);
      if (existingScore) {
        scoreUpdates.push({
          id: existingScore.id,
          points: playerResult.points,
          won: playerResult.won,
          lost: playerResult.lost,
          tied: playerResult.place > 1 && !playerResult.won && !playerResult.lost ? true : false,
          metadata: {
            ...(existingScore.metadata || {}),
            place: playerResult.place,
            placeFromEnd: playerResult.placeFromEnd,
            scoreType: playerResult.scoreType,
            stats: playerResult.stats,
          },
        });
      }
    }

    // Batch update scores
    for (const update of scoreUpdates) {
      await upsertEntity(this.db, schema.participantEventStageScores, update, { id: update.id });
    }

    // Always recompute event totals (parent stages are always recomputed)
    await this.recomputeEventTotals(event);

    // If propagatesToSiblingStages is true, recompute all subsequent sibling stages
    if (scoringMethod.propagatesToSiblingStages) {
      // Find all sibling stages (stages that come after this one in the event)
      const currentStageIndex = event.stages.findIndex(s => s.stage.id === eventStageId);
      if (currentStageIndex >= 0) {
        // Recompute all subsequent sibling stages (they may depend on this stage's results)
        for (let i = currentStageIndex + 1; i < event.stages.length; i++) {
          const siblingStage = event.stages[i];
          await this.recomputeStageScores(event, siblingStage.stage.id);
        }
      }
    }
  }

  /**
   * Get the computed result for a stage
   */
  private async getStageResult(
    event: EventWithDetails,
    eventStageId: string
  ): Promise<GroupResult | null> {
    const stage = event.stages.find(s => s.stage.id === eventStageId);
    if (!stage || !event.scoreFormat) {
      return null;
    }

    const scoringMethod = getScoringMethod(event.scoreFormat.scoringMethodName);
    if (!scoringMethod) {
      return null;
    }

    // Get all scores for this stage
    const stageScores = await this.db
      .select()
      .from(schema.participantEventStageScores)
      .where(eq(schema.participantEventStageScores.eventStageId, eventStageId));

    const playerValues: Record<string, any> = {};
    for (const score of stageScores) {
      if (score.value !== null && score.value !== undefined) {
        playerValues[score.participantId] = score.value;
      }
    }

    if (Object.keys(playerValues).length === 0) {
      return null;
    }

    // Get previous stage results
    const previousStageResults: GroupResult[] = [];
    const currentStageIndex = event.stages.findIndex(s => s.stage.id === eventStageId);
    
    if (currentStageIndex > 0) {
      for (let i = 0; i < currentStageIndex; i++) {
        const prevStage = event.stages[i];
        const prevResult = await this.getStageResult(event, prevStage.stage.id);
        if (prevResult) {
          previousStageResults.push(prevResult);
        }
      }
    }

    // Precompute stats before calling scoreStage
    const precomputedStats = precomputeStageStats(playerValues, scoringMethod.valueToPoints);

    const stageInfo: StageScoringInfo = {
      playerValues,
      previousStageResults,
      stageInfo: {
        stage: stage.stage,
        metadata: stage.stage.metadata || stage.venueEventFormatStage?.metadata || stage.eventFormatStage?.metadata || null,
      },
      eventInfo: {
        eventId: event.event.id,
        metadata: event.event.metadata,
      },
      precomputedStats,
    };

    // Use custom scoreStage if provided, otherwise use default implementation
    let simpleResult = scoringMethod.scoreStage
      ? scoringMethod.scoreStage(stageInfo)
      : defaultScoreStage(scoringMethod, stageInfo);
    
    // Recompute stats after scoreStage (it may have modified points)
    const recomputedStats = recomputeStatsFromResult(simpleResult);
    simpleResult = {
      ...simpleResult,
      stats: {
        ...simpleResult.stats,
        ...recomputedStats, // Override with recomputed stats
      },
    };
    
    return computeGroupResult(simpleResult, scoringMethod.higherPointsBetter);
  }

  /**
   * Recompute event totals and all stage scores
   * This is called when a score changes to ensure everything is up to date
   */
  private async recomputeEventTotals(event: EventWithDetails): Promise<void> {
    if (!event.scoreFormat) {
      return;
    }

    const scoringMethod = getScoringMethod(event.scoreFormat.scoringMethodName);
    if (!scoringMethod) {
      return;
    }

    // Get all stage results
    const stageResults: GroupResult[] = [];
    for (const stage of event.stages) {
      const result = await this.getStageResult(event, stage.stage.id);
      if (result) {
        stageResults.push(result);
      }
    }

    let eventResult: GroupResult;

    // Precompute aggregated sums from stage results
    const aggregated = aggregateStageResults(stageResults);

    // Extract precomputed stats from aggregated (already computed in aggregateStageResults)
    const precomputedStats = {
      totalPlayers: aggregated.stats.totalPlayers || 0,
      averageValue: aggregated.stats.averageValue ?? null,
      averagePoints: aggregated.stats.averagePoints ?? null,
    };

    if (scoringMethod.scoreEvent) {
      // Use custom scoreEvent implementation
      const eventInfo: EventScoringInfo = {
        stageResults,
        aggregated,
        eventInfo: {
          eventId: event.event.id,
          metadata: event.event.metadata,
        },
        precomputedStats,
      };

      let simpleEventResult = scoringMethod.scoreEvent(eventInfo);
      
      // Recompute stats after scoreEvent (it may have modified points)
      const recomputedStats = recomputeStatsFromResult(simpleEventResult);
      simpleEventResult = {
        ...simpleEventResult,
        stats: {
          ...simpleEventResult.stats,
          ...recomputedStats, // Override with recomputed stats
        },
      };
      
      eventResult = computeGroupResult(simpleEventResult, scoringMethod.higherPointsBetter, stageResults);
    } else {
      // Automatically aggregate stage results
      eventResult = computeGroupResult(aggregated, scoringMethod.higherPointsBetter, stageResults);
    }

    // Store event-level results in event metadata
    await this.db
      .update(schema.events)
      .set({
        metadata: {
          ...(event.event.metadata || {}),
          scoring: {
            playerResults: eventResult.playerResults,
            winners: eventResult.winners,
            winningPoints: eventResult.winningPoints,
            stats: eventResult.stats,
          },
        },
      })
      .where(eq(schema.events.id, event.event.id));
  }

  /**
   * Get computed scores for an event
   */
  async getEventScores(eventId: string): Promise<{
    stageResults: GroupResult[];
    eventResult: GroupResult | null;
  }> {
    const event = await queryEvents(this.db)
      .withVenueAndFormat()
      .withParticipants()
      .withStages()
      .where(eq(schema.events.id, eventId))
      .execute()
      .then(results => results[0] || null);

    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }

    // Get all stage results
    const stageResults: GroupResult[] = [];
    for (const stage of event.stages) {
      const result = await this.getStageResult(event, stage.stage.id);
      if (result) {
        stageResults.push(result);
      }
    }

    // Get event result
    let eventResult: GroupResult | null = null;
    if (event.scoreFormat && stageResults.length > 0) {
      const scoringMethod = getScoringMethod(event.scoreFormat.scoringMethodName);
      if (scoringMethod) {
        // Precompute aggregated sums from stage results
        const aggregated = aggregateStageResults(stageResults);

        // Extract precomputed stats from aggregated (already computed in aggregateStageResults)
        const precomputedStats = {
          totalPlayers: aggregated.stats.totalPlayers || 0,
          averageValue: aggregated.stats.averageValue ?? null,
          averagePoints: aggregated.stats.averagePoints ?? null,
        };

        if (scoringMethod.scoreEvent) {
          const eventInfo: EventScoringInfo = {
            stageResults,
            aggregated,
            eventInfo: {
              eventId: event.event.id,
              metadata: event.event.metadata,
            },
            precomputedStats,
          };
          
          let simpleEventResult = scoringMethod.scoreEvent(eventInfo);
          
          // Recompute stats after scoreEvent (it may have modified points)
          const recomputedStats = recomputeStatsFromResult(simpleEventResult);
          simpleEventResult = {
            ...simpleEventResult,
            stats: {
              ...simpleEventResult.stats,
              ...recomputedStats, // Override with recomputed stats
            },
          };
          
          eventResult = computeGroupResult(simpleEventResult, scoringMethod.higherPointsBetter, stageResults);
        } else {
          // Automatically aggregate stage results
          eventResult = computeGroupResult(aggregated, scoringMethod.higherPointsBetter, stageResults);
        }
      }
    }

    return { stageResults, eventResult };
  }
}

