/**
 * 4-Venues Query Builder
 * 
 * Builds on events (1-events.ts). Venues connect to events via venueEventFormats.
 * 
 * This file contains:
 * - Meta-types: Raw Drizzle join result types (camelCase)
 * - Result types: Grouped/denormalized structures
 * - Query builder: Type-safe, composable builder
 * 
 * Usage:
 * ```ts
 * const venues = await queryVenues(db)
 *   .withEventFormats()
 *   .withEvents()
 *   .where(eq(generic-sports.venues.id, venueId))
 *   .execute();
 * ```
 */

import { eq, type SQL } from 'drizzle-orm';
import type { Database } from '../../../../xp-deeby/adapters';
import * as schema from '../tables';
import { applyQueryModifiers, type QueryBuilderState } from '../../../../xp-deeby/utils';
import type {
  Venue,
  VenueEventFormat,
  EventFormat,
  Sport,
  ScoreFormat,
  VenueEventFormatStage,
  EventFormatStage,
  Event,
  VenueInsert,
  VenueEventFormatInsert,
  EventFormatInsert,
  SportInsert,
  ScoreFormatInsert,
  VenueEventFormatStageInsert,
  EventFormatStageInsert,
  EventInsert,
} from '../tables';
import { upsertEntity, upsertEntities, deleteMissingChildren } from '../../../../xp-deeby/utils';

// ============================================================================
// Meta-Types: Raw Drizzle Join Result Types (camelCase)
// ============================================================================

/**
 * Base venue join result
 */
export type VenueJoinBase = {
  venues: Venue;
};

/**
 * Venue with event formats join
 */
export type VenueJoinWithEventFormats = VenueJoinBase & {
  venueEventFormats: VenueEventFormat | null;
  eventFormats: EventFormat | null;
  sports: Sport | null;
  scoreFormats: ScoreFormat | null;
  venueEventFormatStages: VenueEventFormatStage | null;
  eventFormatStages: EventFormatStage | null;
};

/**
 * Venue with events join
 */
export type VenueJoinWithEvents = VenueJoinBase & {
  venueEventFormats: VenueEventFormat | null;
  events: Event | null;
};

/**
 * Full venue join result
 */
export type VenueJoinFull = VenueJoinWithEventFormats & VenueJoinWithEvents;

// ============================================================================
// Result Types: Grouped/Denormalized Structures
// ============================================================================

/**
 * Venue with all related storage collected
 */
export type VenueWithDetails = {
  venue: Venue;
  
  // Event formats available at this venue
  eventFormats: {
    venueEventFormat: VenueEventFormat;
    eventFormat: EventFormat;
    sport?: Sport | null;
    scoreFormat?: ScoreFormat | null;
    stages: {
      venueEventFormatStage: VenueEventFormatStage;
      eventFormatStage: EventFormatStage;
    }[];
  }[];
  
  // Events at this venue
  events: Event[];
};

// ============================================================================
// Query Builder
// ============================================================================

/**
 * Start building a venue query
 */
export function queryVenues(db: Database) {
  let selectQuery: any = db.select().from(schema.venues);
  
  let hasEventFormats = false;
  let hasEvents = false;
  const state: QueryBuilderState = {};

  const builder = {
    /**
     * Join event formats and their stages
     */
    withEventFormats() {
      if (!hasEventFormats) {
        selectQuery = selectQuery
          .leftJoin(schema.venueEventFormats, eq(schema.venues.id, schema.venueEventFormats.venueId))
          .leftJoin(schema.eventFormats, eq(schema.venueEventFormats.eventFormatId, schema.eventFormats.id))
          .leftJoin(schema.sports, eq(schema.eventFormats.sportId, schema.sports.id))
          .leftJoin(schema.scoreFormats, eq(schema.eventFormats.scoreFormatId, schema.scoreFormats.id))
          .leftJoin(schema.venueEventFormatStages, eq(schema.venueEventFormats.id, schema.venueEventFormatStages.venueEventFormatId))
          .leftJoin(schema.eventFormatStages, eq(schema.venueEventFormatStages.eventFormatStageId, schema.eventFormatStages.id));
        hasEventFormats = true;
      }
      return builder;
    },

    /**
     * Join events
     */
    withEvents() {
      if (!hasEvents) {
        // Only join venueEventFormats if it hasn't been joined already by withEventFormats()
        if (!hasEventFormats) {
          selectQuery = selectQuery
            .leftJoin(schema.venueEventFormats, eq(schema.venues.id, schema.venueEventFormats.venueId));
        }
        // Always join events
        selectQuery = selectQuery
          .leftJoin(schema.events, eq(schema.venueEventFormats.id, schema.events.venueEventFormatId));
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

    async execute(): Promise<VenueWithDetails[]> {
      selectQuery = applyQueryModifiers(
        selectQuery,
        state,
        (q, cond) => q.where(cond),
        (q, n) => q.limit(n),
        (q, n) => q.offset(n)
      );
      
      const results = await selectQuery;
      
      console.log(`[queryVenues.execute] Raw query results:`, results);
      console.log(`[queryVenues.execute] Result count: ${results.length}`);
      if (results.length > 0) {
        console.log(`[queryVenues.execute] First row keys:`, Object.keys(results[0] || {}));
        console.log(`[queryVenues.execute] First row sample:`, results[0]);
      }
      
      const venuesMap = new Map<string, VenueWithDetails>();
      
      for (const row of results as any) {
        // Drizzle namespaces joined results by table name
        // However, with PGLite/PostgreSQL, Drizzle may return flat column names
        // Try namespaced first, then fall back to flat structure
        let venueData = row.venues || row.Venues || row.venues_table;
        
        // If no namespaced data, check if this row IS the venue data (flat structure)
        // Venue table has: id, name, notes, lat, lng, metadata
        if (!venueData && row.id && (row.name !== undefined || row.notes !== undefined)) {
          // This row is the venue data itself (flat structure from PGLite)
          venueData = row;
        }
        
        console.log(`[queryVenues.execute] Processing row, venueData:`, venueData);
        console.log(`[queryVenues.execute] Row keys:`, Object.keys(row));
        
        if (!venueData || !venueData.id) {
          // Skip rows without venue data (shouldn't happen with left joins, but be defensive)
          console.warn(`[queryVenues.execute] Skipping row without venue data:`, row);
          continue;
        }
        
        const venueId = venueData.id;
        
        if (!venuesMap.has(venueId)) {
          venuesMap.set(venueId, {
            venue: venueData,
            eventFormats: [],
            events: [],
          });
        }
        
        const venue = venuesMap.get(venueId)!;
        
        // Add event format if not already added
        if (row.venue_event_formats) {
          const vefId = row.venue_event_formats.id;
          let formatEntry = venue.eventFormats.find(f => f.venueEventFormat.id === vefId);
          
          if (!formatEntry) {
            formatEntry = {
              venueEventFormat: row.venue_event_formats,
              eventFormat: row.event_formats,
              sport: row.sports || null,
              scoreFormat: row.score_formats || null,
              stages: [],
            };
            venue.eventFormats.push(formatEntry);
          }
          
          // Add stage if not already added
          if (row.venue_event_format_stages) {
            const stageId = row.venue_event_format_stages.id;
            if (!formatEntry.stages.find(s => s.venueEventFormatStage.id === stageId)) {
              formatEntry.stages.push({
                venueEventFormatStage: row.venue_event_format_stages,
                eventFormatStage: row.event_format_stages,
              });
            }
          }
        }
        
        // Add event if not already added
        if (row.events && !venue.events.find((e: any) => e.id === row.events.id)) {
          venue.events.push(row.events);
        }
      }
      
      return Array.from(venuesMap.values());
    },
  };
  
  return builder;
}

// ============================================================================
// Upsert Functions
// ============================================================================

/**
 * Upsert a venue with all its related storage
 * 
 * This function handles:
 * - Upserts venue/format hierarchy (sport, scoreFormat, eventFormat, venueEventFormat)
 * - Upserts the venue
 * - Upserts event formats and their stages
 * - Upserts events (if provided)
 * 
 * Usage:
 * ```ts
 * await upsertVenueWithDetails(db, {
 *   venue: { id: '...', name: '...', ... },
 *   eventFormats: [{
 *     venueEventFormat: { id: '...', ... },
 *     eventFormat: { id: '...', ... },
 *     stages: [...]
 *   }],
 *   events: [{ id: '...', ... }],
 * });
 * ```
 */
export async function upsertVenueWithDetails(
  db: Database,
  data: VenueWithDetails
): Promise<void> {
  // 1. Upsert the venue
  await upsertEntity(db, schema.venues, data.venue as Partial<VenueInsert>, { id: data.venue.id });
  
  // 2. Upsert event formats and their hierarchy
  const venueEventFormatIds: string[] = [];
  
  for (const formatData of data.eventFormats) {
    // Upsert sport if provided
    if (formatData.sport) {
      const sport = formatData.sport as Partial<SportInsert>;
      await upsertEntity(db, schema.sports, sport, { name: sport.name });
    }
    
    // Upsert scoreFormat if provided
    if (formatData.scoreFormat) {
      const scoreFormat = formatData.scoreFormat as Partial<ScoreFormatInsert>;
      const condition: Record<string, any> = {};
      if (scoreFormat.name) condition.name = scoreFormat.name;
      if (scoreFormat.sportId) condition.sportId = scoreFormat.sportId;
      if (scoreFormat.scoringMethodName) condition.scoringMethodName = scoreFormat.scoringMethodName;
      await upsertEntity(db, schema.scoreFormats, scoreFormat, condition);
    }
    
    // Upsert eventFormat
    if (formatData.eventFormat) {
      const eventFormat = formatData.eventFormat as Partial<EventFormatInsert>;
      await upsertEntity(db, schema.eventFormats, eventFormat, {
        name: eventFormat.name,
        sportId: eventFormat.sportId,
      });
    }
    
    // Upsert venueEventFormat
    const venueEventFormat = {
      ...formatData.venueEventFormat,
      venueId: data.venue.id,
      eventFormatId: formatData.eventFormat?.id,
    } as Partial<VenueEventFormatInsert>;
    await upsertEntity(db, schema.venueEventFormats, venueEventFormat, { id: venueEventFormat.id });
    
    if (formatData.venueEventFormat?.id) {
      venueEventFormatIds.push(formatData.venueEventFormat.id);
    }
    
    // Upsert stages
    const stageIds: string[] = [];
    for (const stageData of formatData.stages) {
      // Upsert eventFormatStage if provided
      if (stageData.eventFormatStage) {
        const eventFormatStage = stageData.eventFormatStage as Partial<EventFormatStageInsert>;
        let condition: Record<string, any> = {};
        if (eventFormatStage.name != null) {
          condition = { name: eventFormatStage.name };
        } else if (eventFormatStage.eventFormatId !== undefined && eventFormatStage.number !== undefined) {
          condition = {
            eventFormatId: eventFormatStage.eventFormatId,
            parentId: eventFormatStage.parentId ?? null,
            number: eventFormatStage.number,
          };
        }
        await upsertEntity(db, schema.eventFormatStages, eventFormatStage, condition);
      }
      
      // Upsert venueEventFormatStage
      if (stageData.venueEventFormatStage) {
        const venueEventFormatStage = {
          ...stageData.venueEventFormatStage,
          venueEventFormatId: formatData.venueEventFormat?.id,
          eventFormatStageId: stageData.eventFormatStage?.id,
        } as Partial<VenueEventFormatStageInsert>;
        let condition: Record<string, any> = {};
        if (venueEventFormatStage.name != null && venueEventFormatStage.name !== '') {
          condition = { name: venueEventFormatStage.name };
        } else if (venueEventFormatStage.venueEventFormatId !== undefined && venueEventFormatStage.number !== undefined) {
          condition = {
            venueEventFormatId: venueEventFormatStage.venueEventFormatId,
            parentId: venueEventFormatStage.parentId ?? null,
            number: venueEventFormatStage.number,
          };
        }
        await upsertEntity(db, schema.venueEventFormatStages, venueEventFormatStage, condition);
        
        if (stageData.venueEventFormatStage.id) {
          stageIds.push(stageData.venueEventFormatStage.id);
        }
      }
    }
    
    // Delete stages that are no longer in the list
    if (formatData.venueEventFormat?.id) {
      await deleteMissingChildren(
        db,
        schema.venueEventFormatStages,
        schema.venueEventFormatStages.venueEventFormatId,
        formatData.venueEventFormat.id,
        stageIds
      );
    }
  }
  
  // Delete venueEventFormats that are no longer in the list
  await deleteMissingChildren(
    db,
    schema.venueEventFormats,
    schema.venueEventFormats.venueId,
    data.venue.id,
    venueEventFormatIds
  );
  
  // 3. Upsert events if provided
  if (data.events.length > 0) {
    await upsertEntities(db, schema.events, data.events as Partial<EventInsert>[], (event) => ({ id: event.id }));
  }
}

