/**
 * 2-Participants Query Builder
 * 
 * Builds on events (1-events.ts). Participants depend on events for their participation records.
 * 
 * This file contains:
 * - Meta-types: Raw Drizzle join result types (camelCase)
 * - Result types: Grouped/denormalized structures
 * - Query builder: Type-safe, composable builder
 * 
 * Usage:
 * ```ts
 * const participants = await queryParticipants(db)
 *   .withEvents()
 *   .where(eq(generic-sports.participants.id, participantId))
 *   .execute();
 * ```
 */

import { eq, and, type SQL } from 'drizzle-orm';
import type { Database } from '../../../../xp-deeby/adapters';
import * as schema from '../tables';
import { applyQueryModifiers, type QueryBuilderState } from './base';
import type {
  Participant,
  Event,
  EventParticipant,
  EventStage,
  ParticipantEventStageScore,
  ParticipantInsert,
  EventInsert,
  ParticipantEventStageScoreInsert,
} from '../tables';
import { upsertEntity, upsertEntities } from './upsert';
import { generateUUID } from '@utils/uuid';

// ============================================================================
// Meta-Types: Raw Drizzle Join Result Types (camelCase)
// ============================================================================

/**
 * Base participant join result
 */
export type ParticipantJoinBase = {
  participants: Participant;
};

/**
 * Participant with events join
 */
export type ParticipantJoinWithEvents = ParticipantJoinBase & {
  eventParticipants: EventParticipant | null;
  events: Event | null;
  eventStages: EventStage | null;
  participantEventStageScores: ParticipantEventStageScore | null;
};

/**
 * Full participant join result
 */
export type ParticipantJoinFull = ParticipantJoinWithEvents;

// ============================================================================
// Result Types: Grouped/Denormalized Structures
// ============================================================================

/**
 * Participant with all related storage collected
 */
export type ParticipantWithDetails = {
  participant: Participant;
  
  // Team membership
  teams: Participant[];
  
  // Team members (if this is a team)
  teamMembers: Participant[];
  
  // Events participated in
  events: {
    event: Event;
    scores: ParticipantEventStageScore[];
  }[];
};

// ============================================================================
// Query Builder
// ============================================================================

/**
 * Start building a participant query
 */
export function queryParticipants(db: Database) {
  let selectQuery: any = db.select().from(schema.participants);
  
  let hasTeams = false;
  let hasTeamMembers = false;
  let hasEvents = false;
  const state: QueryBuilderState = {};

  const builder = {
    /**
     * Join team membership (teams this participant belongs to)
     * Note: This uses a subquery approach since Drizzle doesn't easily support table aliases in this context
     */
    withTeams() {
      if (!hasTeams) {
        // For teams, we'll need to handle this differently - might need separate queries
        // This is a simplified version
        hasTeams = true;
      }
      return builder;
    },

    /**
     * Join team members (if this participant is a team)
     */
    withTeamMembers() {
      if (!hasTeamMembers) {
        // Similar limitation - would need separate query or different approach
        hasTeamMembers = true;
      }
      return builder;
    },

    /**
     * Join events and scores
     */
    withEvents() {
      if (!hasEvents) {
        // Use left joins to ensure participants are returned even when they have no events
        selectQuery = selectQuery
          .leftJoin(schema.eventParticipants, eq(schema.participants.id, schema.eventParticipants.participantId))
          .leftJoin(schema.events, eq(schema.eventParticipants.eventId, schema.events.id))
          .leftJoin(schema.eventStages, eq(schema.events.id, schema.eventStages.eventId))
          .leftJoin(schema.participantEventStageScores, and(
            eq(schema.participantEventStageScores.participantId, schema.participants.id),
            eq(schema.participantEventStageScores.eventStageId, schema.eventStages.id)
          ));
        hasEvents = true;
      }
      return builder;
    },

    where(condition: SQL) {
      state.whereCondition = condition;
      return builder;
    },

    limit(n: number) {
      state.limitValue = n;
      return builder;
    },

    offset(n: number) {
      state.offsetValue = n;
      return builder;
    },

    async execute(): Promise<ParticipantWithDetails[]> {
      // Apply query modifiers (where, limit, offset)
      // The where clause should filter on the main table (participants), not joined tables
      selectQuery = applyQueryModifiers(
        selectQuery,
        state,
        (q, cond) => q.where(cond),
        (q, n) => q.limit(n),
        (q, n) => q.offset(n)
      );
      
      const results = await selectQuery;
      
      console.log(`[queryParticipants.execute] Raw query results:`, results);
      console.log(`[queryParticipants.execute] Result count: ${results.length}`);
      if (results.length > 0) {
        console.log(`[queryParticipants.execute] First row keys:`, Object.keys(results[0] || {}));
        console.log(`[queryParticipants.execute] First row sample:`, results[0]);
      }
      
      const participantsMap = new Map<string, ParticipantWithDetails>();
      
      for (const row of results as any) {
        // Drizzle namespaces joined results by table name
        // However, with PGLite/PostgreSQL, Drizzle may return flat column names
        // Try namespaced first, then fall back to flat structure
        let participantData = row.participants || row.Participants || row.participants_table;
        
        // If no namespaced data, check if this row IS the participant data (flat structure)
        // Participant table has: id, name, notes, lat, lng, metadata, sex, birthday, is_team, createdAt, deletedAt
        if (!participantData && row.id && (row.name !== undefined || row.is_team !== undefined)) {
          // This row is the participant data itself (flat structure from PGLite)
          participantData = row;
        }
        
        console.log(`[queryParticipants.execute] Processing row, participantData:`, participantData);
        console.log(`[queryParticipants.execute] Row keys:`, Object.keys(row));
        
        if (!participantData || !participantData.id) {
          // Skip rows without participant data (shouldn't happen with left joins, but be defensive)
          console.warn(`[queryParticipants.execute] Skipping row without participant data:`, row);
          continue;
        }
        
        const participantId = participantData.id;
        
        if (!participantsMap.has(participantId)) {
          participantsMap.set(participantId, {
            participant: participantData,
            teams: [],
            teamMembers: [],
            events: [],
          });
        }
        
        const participant = participantsMap.get(participantId)!;
        
        // Add event if not already added
        // Check for both namespaced and flat column names
        const eventData = row.events || (row.event_id ? {
          id: row.event_id,
          venueEventFormatId: row.venue_event_format_id,
          name: null, // Not available in flat structure
          notes: null,
          startTime: row.start_time,
          endTime: row.end_time,
          active: row.active,
        } : null);
        
        if (eventData && eventData.id) {
          let eventEntry = participant.events.find(e => e.event.id === eventData.id);
          
          if (!eventEntry) {
            eventEntry = {
              event: eventData,
              scores: [],
            };
            participant.events.push(eventEntry);
          }
          
          // Add score if not already added
          // Check for both namespaced and flat column names
          const scoreData = row.participant_event_stage_scores || (row.value !== undefined ? {
            id: null, // May not be available in flat structure
            participantId: participantId,
            eventStageId: row.event_stage_id,
            value: row.value,
            points: row.points,
            won: row.won,
            lost: row.lost,
            tied: row.tied,
            winMargin: row.win_margin,
            lossMargin: row.loss_margin,
            pointsBehindPrevious: row.points_behind_previous,
            pointsAheadOfNext: row.points_ahead_of_next,
            completedAt: row.completed_at,
            complete: row.complete,
          } : null);
          
          if (scoreData && (scoreData.id || scoreData.value !== undefined)) {
            // Only add if not already present (check by id if available, or by eventStageId + value)
            const existingScore = eventEntry.scores.find((s: any) => 
              (scoreData.id && s.id === scoreData.id) ||
              (!scoreData.id && s.eventStageId === scoreData.eventStageId && s.value === scoreData.value)
            );
            
            if (!existingScore) {
              eventEntry.scores.push(scoreData);
            }
          }
        }
      }
      
      return Array.from(participantsMap.values());
    },
  };
  
  return builder;
}

// ============================================================================
// Upsert Functions
// ============================================================================

/**
 * Upsert a participant with all its related storage
 * 
 * This function handles:
 * - Upserts the participant
 * - Upserts events and their scores (if provided)
 * 
 * Usage:
 * ```ts
 * await upsertParticipantWithDetails(db, {
 *   participant: { id: '...', name: '...', ... },
 *   events: [{ event: { id: '...', ... }, scores: [...] }],
 * });
 * ```
 */
export async function upsertParticipantWithDetails(
  db: Database,
  data: ParticipantWithDetails
): Promise<void> {
  // 1. Upsert the participant
  await upsertEntity(db, schema.participants, data.participant as Partial<ParticipantInsert>, { id: data.participant.id });
  
  // 2. Upsert events and scores
  for (const eventData of data.events) {
    // Upsert the event
    await upsertEntity(db, schema.events, eventData.event as Partial<EventInsert>, { id: eventData.event.id });
    
    // Upsert eventParticipant link
    const existingEventParticipant = await db
      .select()
      .from(schema.eventParticipants)
      .where(
        and(
          eq(schema.eventParticipants.eventId, eventData.event.id),
          eq(schema.eventParticipants.participantId, data.participant.id)
        )
      )
      .limit(1);
    
    if (existingEventParticipant.length === 0) {
      // Create link if it doesn't exist
      await db.insert(schema.eventParticipants).values({
        id: generateUUID(),
        eventId: eventData.event.id,
        participantId: data.participant.id,
        lat: null,
        lng: null,
      } as any);
    }
    
    // Upsert scores
    if (eventData.scores.length > 0) {
      // Get event stages for this event
      const eventStages = await db
        .select()
        .from(schema.eventStages)
        .where(eq(schema.eventStages.eventId, eventData.event.id));
      
      const stageMap = new Map(eventStages.map(es => [es.venueEventFormatStageId, es.id]));
      
      const scores = eventData.scores.map(score => {
        // Find the eventStageId for this score
        const eventStageId = score.eventStageId || 
          (score.eventStageId ? stageMap.get(score.eventStageId) : null);
        
        return {
          ...score,
          participantId: data.participant.id,
          eventStageId: eventStageId || null,
        };
      });
      
      await upsertEntities(db, schema.participantEventStageScores, scores as Partial<ParticipantEventStageScoreInsert>[], (score) => ({ id: score.id }));
    }
  }
}

