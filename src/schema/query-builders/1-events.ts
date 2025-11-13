/**
 * 1-Events Query Builder
 * 
 * Query builder for events. Depends on stages. Other builders (participants, venues) may depend on this.
 * 
 * This file contains:
 * - Meta-types: Raw Drizzle join result types (camelCase)
 * - Result types: Grouped/denormalized structures
 * - Query builder: Type-safe, composable builder
 * 
 * Usage:
 * ```ts
 * const events = await queryEvents(db)
 *   .withVenueAndFormat()
 *   .withParticipants()
 *   .withStages()
 *   .where(eq(schema.events.id, eventId))
 *   .execute();
 * ```
 */

import { eq, and, sql, type SQL } from 'drizzle-orm';
import type { Database } from '@services/storage/db';
import * as schema from '../tables';
import { applyQueryModifiers, type QueryBuilderState } from './base';
import type {
  Event,
  Venue,
  VenueEventFormat,
  EventFormat,
  Sport,
  ScoreFormat,
  Participant,
  EventParticipant,
  EventStage,
  VenueEventFormatStage,
  EventFormatStage,
  ParticipantEventStageScore,
  Photo,
  EventInsert,
  VenueInsert,
  VenueEventFormatInsert,
  EventFormatInsert,
  SportInsert,
  ScoreFormatInsert,
  ParticipantInsert,
  EventParticipantInsert,
  EventStageInsert,
  VenueEventFormatStageInsert,
  EventFormatStageInsert,
  ParticipantEventStageScoreInsert,
  PhotoInsert,
} from '../tables';
import { upsertEntity, upsertEntities, deleteMissingChildren } from './upsert';
import { generateUUID } from '@/utils/uuid';

// ============================================================================
// Meta-Types: Raw Drizzle Join Result Types (camelCase)
// ============================================================================

/**
 * Base event join result (just events table)
 */
export type EventJoinBase = {
  events: Event;
};

/**
 * Event with venue and format joins
 */
export type EventJoinWithVenueAndFormat = EventJoinBase & {
  venueEventFormats: VenueEventFormat | null;
  venues: Venue | null;
  eventFormats: EventFormat | null;
  sports: Sport | null;
  scoreFormats: ScoreFormat | null;
};

/**
 * Event with participants join
 */
export type EventJoinWithParticipants = EventJoinBase & {
  eventParticipants: EventParticipant | null;
  participants: Participant | null;
};

/**
 * Event with stages join
 */
export type EventJoinWithStages = EventJoinBase & {
  eventStages: EventStage | null;
  venueEventFormatStages: VenueEventFormatStage | null;
  eventFormatStages: EventFormatStage | null;
  participantEventStageScores: ParticipantEventStageScore | null;
};

/**
 * Event with photos join
 */
export type EventJoinWithPhotos = EventJoinBase & {
  photos: Photo | null;
};

/**
 * Full event join result (all joins)
 */
export type EventJoinFull = EventJoinWithVenueAndFormat &
  EventJoinWithParticipants &
  EventJoinWithStages &
  EventJoinWithPhotos;

// ============================================================================
// Result Types: Grouped/Denormalized Structures
// ============================================================================

/**
 * Event with all related data collected
 * This is the "view-like" structure for events
 */
export type EventWithDetails = {
  // Event core
  event: Event;
  
  // Venue and format info
  venue?: Venue | null;
  venueEventFormat?: VenueEventFormat | null;
  eventFormat?: EventFormat | null;
  sport?: Sport | null;
  scoreFormat?: ScoreFormat | null;
  
  // Participants
  participants: Participant[];
  
  // Stages with their scores
  stages: {
    stage: EventStage;
    venueEventFormatStage?: VenueEventFormatStage | null;
    eventFormatStage?: EventFormatStage | null;
    scores: ParticipantEventStageScore[];
  }[];
  
  // Photos
  photos: Photo[];
};

// ============================================================================
// Query Builder
// ============================================================================

type JoinFlags = {
  venueAndFormat: boolean;
  participants: boolean;
  stages: boolean;
  photos: boolean;
};

type EventJoinResult<F extends JoinFlags> = EventJoinBase &
  (F['venueAndFormat'] extends true ? EventJoinWithVenueAndFormat : {}) &
  (F['participants'] extends true ? EventJoinWithParticipants : {}) &
  (F['stages'] extends true ? EventJoinWithStages : {}) &
  (F['photos'] extends true ? EventJoinWithPhotos : {});

type EventBuilder<F extends JoinFlags = JoinFlags> = {
  withVenueAndFormat(): EventBuilder<F & { venueAndFormat: true }>;
  withParticipants(): EventBuilder<F & { participants: true }>;
  withStages(): EventBuilder<F & { stages: true }>;
  withPhotos(): EventBuilder<F & { photos: true }>;
  where(condition: SQL): EventBuilder<F>;
  limit(n: number): EventBuilder<F>;
  offset(n: number): EventBuilder<F>;
  execute(): Promise<EventWithDetails[]>;
  // Meta-type accessor - get the raw join result type
  $metaType: EventJoinResult<F>;
};

/**
 * Start building an event query
 * Returns a type-safe builder that tracks which joins are included
 */
export function queryEvents(db: Database): EventBuilder<{
  venueAndFormat: false;
  participants: false;
  stages: false;
  photos: false;
}> {
  let selectQuery: any = db.select().from(schema.events);
  
  const flags: JoinFlags = {
    venueAndFormat: false,
    participants: false,
    stages: false,
    photos: false,
  };
  const state: QueryBuilderState = {};

  const createBuilder = <F extends JoinFlags>(): EventBuilder<F> => ({
    withVenueAndFormat() {
      if (!flags.venueAndFormat) {
        selectQuery = selectQuery
          .leftJoin(schema.venueEventFormats, eq(schema.events.venueEventFormatId, schema.venueEventFormats.id))
          .leftJoin(schema.venues, eq(schema.venueEventFormats.venueId, schema.venues.id))
          .leftJoin(schema.eventFormats, eq(schema.venueEventFormats.eventFormatId, schema.eventFormats.id))
          .leftJoin(schema.sports, eq(schema.eventFormats.sportId, schema.sports.id))
          .leftJoin(schema.scoreFormats, eq(schema.eventFormats.scoreFormatId, schema.scoreFormats.id));
        flags.venueAndFormat = true;
      }
      return createBuilder<F & { venueAndFormat: true }>() as any;
    },

    withParticipants() {
      if (!flags.participants) {
        selectQuery = selectQuery
          .leftJoin(schema.eventParticipants, eq(schema.events.id, schema.eventParticipants.eventId))
          .leftJoin(schema.participants, eq(schema.eventParticipants.participantId, schema.participants.id));
        flags.participants = true;
      }
      return createBuilder<F & { participants: true }>() as any;
    },

    withStages() {
      if (!flags.stages) {
        selectQuery = selectQuery
          .leftJoin(schema.eventStages, eq(schema.events.id, schema.eventStages.eventId))
          .leftJoin(schema.venueEventFormatStages, eq(schema.eventStages.venueEventFormatStageId, schema.venueEventFormatStages.id))
          .leftJoin(schema.eventFormatStages, eq(schema.venueEventFormatStages.eventFormatStageId, schema.eventFormatStages.id))
          .leftJoin(schema.participantEventStageScores, eq(schema.eventStages.id, schema.participantEventStageScores.eventStageId));
        flags.stages = true;
      }
      return createBuilder<F & { stages: true }>() as any;
    },

    withPhotos() {
      if (!flags.photos) {
        selectQuery = selectQuery
          .leftJoin(schema.photos, and(
            eq(schema.photos.refId, schema.events.id),
            eq(schema.photos.refTable, sql`'events'`)
          ));
        flags.photos = true;
      }
      return createBuilder<F & { photos: true }>() as any;
    },

    where(condition: SQL) {
      state.whereCondition = condition;
      return createBuilder<F>();
    },

    limit(n: number) {
      state.limitValue = n;
      return createBuilder<F>();
    },

    offset(n: number) {
      state.offsetValue = n;
      return createBuilder<F>();
    },

    async execute(): Promise<EventWithDetails[]> {
      // Apply where, limit, offset
      selectQuery = applyQueryModifiers(
        selectQuery,
        state,
        (q, cond) => q.where(cond),
        (q, n) => q.limit(n),
        (q, n) => q.offset(n)
      );
      
      const results = await selectQuery;
      
      // Group results by event ID
      const eventsMap = new Map<string, EventWithDetails>();
      
      for (const row of results as any) {
        // Drizzle returns snake_case keys, but we map to camelCase to match meta-types
        const eventData = row.events;
        if (!eventData) continue;
        
        const eventId = eventData.id;
        
        if (!eventsMap.has(eventId)) {
          eventsMap.set(eventId, {
            event: eventData,
            venue: row.venues || null,
            venueEventFormat: row.venue_event_formats || null,
            eventFormat: row.event_formats || null,
            sport: row.sports || null,
            scoreFormat: row.score_formats || null,
            participants: [],
            stages: [],
            photos: [],
          });
        }
        
        const event = eventsMap.get(eventId)!;
        
        // Add participant if not already added
        if (row.participants && !event.participants.find((p: any) => p.id === row.participants.id)) {
          event.participants.push(row.participants);
        }
        
        // Add stage if not already added
        if (row.event_stages) {
          const stageId = row.event_stages.id;
          let stageEntry = event.stages.find(s => s.stage.id === stageId);
          
          if (!stageEntry) {
            stageEntry = {
              stage: row.event_stages,
              venueEventFormatStage: row.venue_event_format_stages || null,
              eventFormatStage: row.event_format_stages || null,
              scores: [],
            };
            event.stages.push(stageEntry);
          }
          
          // Add score if not already added
          if (row.participant_event_stage_scores && 
              !stageEntry.scores.find((s: any) => s.id === row.participant_event_stage_scores.id)) {
            stageEntry.scores.push(row.participant_event_stage_scores);
          }
        }
        
        // Add photo if not already added
        if (row.photos && !event.photos.find((p: any) => p.id === row.photos.id)) {
          event.photos.push(row.photos);
        }
      }
      
      return Array.from(eventsMap.values());
    },

    // Meta-type accessor - this is a type-only property
    // Access via: type MetaType = typeof builder.$metaType
    $metaType: null as any as EventJoinResult<F>,
  } as EventBuilder<F>);

  return createBuilder();
}

// ============================================================================
// Upsert Functions
// ============================================================================

/**
 * Upsert an event with all its related data
 * 
 * This function handles the full denormalized structure:
 * - Upserts venue/format hierarchy (sport, scoreFormat, eventFormat, venue, venueEventFormat)
 * - Upserts the event
 * - Upserts participants (if provided)
 * - Links participants to event via eventParticipants
 * - Upserts stages and their related entities
 * - Upserts scores for each stage
 * - Upserts photos
 * 
 * Usage:
 * ```ts
 * await upsertEventWithDetails(db, {
 *   event: { id: '...', venueEventFormatId: '...', ... },
 *   venue: { id: '...', name: '...', ... },
 *   participants: [{ id: '...', name: '...' }],
 *   stages: [{ stage: { id: '...', ... }, scores: [...] }],
 *   photos: [{ id: '...', ... }],
 * });
 * ```
 */
export async function upsertEventWithDetails(
  db: Database,
  data: EventWithDetails
): Promise<void> {
  // 1. Upsert venue/format hierarchy (bottom-up)
  if (data.sport) {
    await upsertEntity(db, schema.sports, data.sport as Partial<SportInsert>);
  }
  
  if (data.scoreFormat) {
    await upsertEntity(db, schema.scoreFormats, data.scoreFormat as Partial<ScoreFormatInsert>);
  }
  
  if (data.eventFormat) {
    await upsertEntity(db, schema.eventFormats, data.eventFormat as Partial<EventFormatInsert>);
  }
  
  if (data.venue) {
    await upsertEntity(db, schema.venues, data.venue as Partial<VenueInsert>);
  }
  
  if (data.venueEventFormat) {
    await upsertEntity(db, schema.venueEventFormats, data.venueEventFormat as Partial<VenueEventFormatInsert>);
  }
  
  // 2. Upsert the event
  await upsertEntity(db, schema.events, data.event as Partial<EventInsert>);
  
  // 3. Upsert participants
  if (data.participants.length > 0) {
    await upsertEntities(db, schema.participants, data.participants as Partial<ParticipantInsert>[]);
    
    // Get existing eventParticipants to preserve their IDs
    const existingEventParticipants = await db
      .select()
      .from(schema.eventParticipants)
      .where(eq(schema.eventParticipants.eventId, data.event.id));
    
    const existingMap = new Map(
      existingEventParticipants.map(ep => [`${ep.eventId}:${ep.participantId}`, ep])
    );
    
    // Link participants to event (preserve existing IDs or create new ones)
    const eventParticipants = data.participants.map(p => {
      const key = `${data.event.id}:${p.id}`;
      const existing = existingMap.get(key);
      return {
        id: existing?.id || generateUUID(), // Use existing ID or generate new UUID
        eventId: data.event.id,
        participantId: p.id,
      };
    });
    
    await upsertEntities(db, schema.eventParticipants, eventParticipants as Partial<EventParticipantInsert>[]);
    
    // Delete eventParticipants that are no longer linked
    const keepEventParticipantIds = eventParticipants.map(ep => ep.id).filter((id): id is string => !!id);
    await deleteMissingChildren(
      db,
      schema.eventParticipants,
      schema.eventParticipants.eventId,
      data.event.id,
      keepEventParticipantIds
    );
  } else {
    // Delete all event participants if none provided
    await db.delete(schema.eventParticipants)
      .where(eq(schema.eventParticipants.eventId, data.event.id));
  }
  
  // 4. Upsert stages and their related entities
  const stageIds: string[] = [];
  for (const stageData of data.stages) {
    // Upsert venueEventFormatStage if provided
    if (stageData.venueEventFormatStage) {
      await upsertEntity(
        db,
        schema.venueEventFormatStages,
        stageData.venueEventFormatStage as Partial<VenueEventFormatStageInsert>
      );
    }
    
    // Upsert eventFormatStage if provided
    if (stageData.eventFormatStage) {
      await upsertEntity(
        db,
        schema.eventFormatStages,
        stageData.eventFormatStage as Partial<EventFormatStageInsert>
      );
    }
    
    // Upsert the event stage
    await upsertEntity(db, schema.eventStages, {
      ...stageData.stage,
      eventId: data.event.id,
    } as Partial<EventStageInsert>);
    
    stageIds.push(stageData.stage.id);
    
    // 5. Upsert scores for this stage
    if (stageData.scores.length > 0) {
      const scores = stageData.scores.map(score => ({
        ...score,
        eventStageId: stageData.stage.id,
      }));
      await upsertEntities(db, schema.participantEventStageScores, scores as Partial<ParticipantEventStageScoreInsert>[]);
      
      // Delete scores that are no longer in the list
      const keepScoreIds = stageData.scores.map(s => s.id).filter((id): id is string => !!id);
      await deleteMissingChildren(
        db,
        schema.participantEventStageScores,
        schema.participantEventStageScores.eventStageId,
        stageData.stage.id,
        keepScoreIds
      );
    } else {
      // Delete all scores for this stage if none provided
      await db.delete(schema.participantEventStageScores)
        .where(eq(schema.participantEventStageScores.eventStageId, stageData.stage.id));
    }
  }
  
  // Delete stages that are no longer in the list
  await deleteMissingChildren(
    db,
    schema.eventStages,
    schema.eventStages.eventId,
    data.event.id,
    stageIds
  );
  
  // 6. Upsert photos
  if (data.photos.length > 0) {
    const photos = data.photos.map(photo => ({
      ...photo,
      refId: data.event.id,
      refTable: 'events',
    }));
    await upsertEntities(db, schema.photos, photos as Partial<PhotoInsert>[]);
    
    // Delete photos that are no longer in the list
    const keepPhotoIds = data.photos.map(p => p.id).filter((id): id is string => !!id);
    if (keepPhotoIds.length > 0) {
      await db.delete(schema.photos)
        .where(
          and(
            eq(schema.photos.refId, data.event.id),
            eq(schema.photos.refTable, 'events'),
            sql`${schema.photos.id} NOT IN ${sql.raw(`(${keepPhotoIds.map(() => '?').join(',')})`)}`
          )
        );
    }
  } else {
    // Delete all photos for this event if none provided
    await db.delete(schema.photos)
      .where(
        and(
          eq(schema.photos.refId, data.event.id),
          eq(schema.photos.refTable, 'events')
        )
      );
  }
}

