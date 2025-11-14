/**
 * 0-Stages Query Builder
 * 
 * Foundation query builder for stages. Handles recursive stage queries with parent-child relationships.
 * Stages can have many sub-stages, creating a tree structure.
 * 
 * This file contains:
 * - Meta-types: Raw Drizzle join result types (camelCase)
 * - Result types: Grouped/denormalized structures with nested sub-stages
 * - Query builder: Type-safe, composable builder for recursive stages
 * 
 * Usage:
 * ```ts
 * const stages = await queryStages(db)
 *   .forEventFormat(eventFormatId)
 *   .withScores()
 *   .execute();
 * ```
 */

import { eq, type SQL } from 'drizzle-orm';
import type { Database } from '../../../adapters';
import * as schema from '../tables';
import { applyQueryModifiers, type QueryBuilderState } from './base';
import type {
  EventFormatStage,
  VenueEventFormatStage,
  EventStage,
  ParticipantEventStageScore,
  EventFormatStageInsert,
  VenueEventFormatStageInsert,
  EventStageInsert,
  ParticipantEventStageScoreInsert,
} from '../tables';
import { upsertEntity, upsertEntities, deleteMissingChildren } from './upsert';

// ============================================================================
// Meta-Types: Raw Drizzle Join Result Types (camelCase)
// ============================================================================

/**
 * Base stage join result
 */
export type StageJoinBase = {
  eventFormatStages: EventFormatStage | null;
  venueEventFormatStages: VenueEventFormatStage | null;
  eventStages: EventStage | null;
};

/**
 * Stage with scores join
 */
export type StageJoinWithScores = StageJoinBase & {
  participantEventStageScores: ParticipantEventStageScore | null;
};

/**
 * Full stage join result
 */
export type StageJoinFull = StageJoinWithScores;

// ============================================================================
// Result Types: Grouped/Denormalized Structures
// ============================================================================

/**
 * Stage with all related storage and nested sub-stages
 * This is the recursive structure for stages
 */
export type StageWithDetails = {
  // Stage core storage
  eventFormatStage?: EventFormatStage | null;
  venueEventFormatStage?: VenueEventFormatStage | null;
  eventStage?: EventStage | null;
  
  // Scores for this stage
  scores: ParticipantEventStageScore[];
  
  // Recursive: sub-stages (children)
  subStages: StageWithDetails[];
};

// ============================================================================
// Query Builder
// ============================================================================

type JoinFlags = {
  scores: boolean;
};

type StageJoinResult<F extends JoinFlags> = StageJoinBase &
  (F['scores'] extends true ? StageJoinWithScores : {});

type StageBuilder<F extends JoinFlags = JoinFlags> = {
  forEventFormat(eventFormatId: string): StageBuilder<F>;
  forVenueEventFormat(venueEventFormatId: string): StageBuilder<F>;
  forEvent(eventId: string): StageBuilder<F>;
  withScores(): StageBuilder<F & { scores: true }>;
  where(condition: SQL): StageBuilder<F>;
  limit(n: number): StageBuilder<F>;
  offset(n: number): StageBuilder<F>;
  execute(): Promise<StageWithDetails[]>;
  // Meta-type accessor
  $metaType: StageJoinResult<F>;
};

/**
 * Build a tree structure from flat stage results
 * Handles recursive parent-child relationships
 * 
 * This function takes a flat list of stages and organizes them into a tree
 * structure based on the parentId relationships.
 */
function buildStageTree(
  stages: {
    eventFormatStage?: EventFormatStage | null;
    venueEventFormatStage?: VenueEventFormatStage | null;
    eventStage?: EventStage | null;
    scores: ParticipantEventStageScore[];
  }[]
): StageWithDetails[] {
  // Create a map of all stages by their ID
  const stageMap = new Map<string, StageWithDetails>();
  const rootStages: StageWithDetails[] = [];
  
  // First pass: create all stage nodes
  for (const stageData of stages) {
    // Determine the stage ID based on what's available
    // Priority: eventStage > venueEventFormatStage > eventFormatStage
    const stageId = 
      stageData.eventStage?.id ||
      stageData.venueEventFormatStage?.id ||
      stageData.eventFormatStage?.id;
    
    if (!stageId) continue;
    
    // Skip if already processed
    if (stageMap.has(stageId)) {
      // Merge scores if this is a duplicate
      const existing = stageMap.get(stageId)!;
      for (const score of stageData.scores) {
        if (!existing.scores.find(s => s.id === score.id)) {
          existing.scores.push(score);
        }
      }
      continue;
    }
    
    const stage: StageWithDetails = {
      eventFormatStage: stageData.eventFormatStage || null,
      venueEventFormatStage: stageData.venueEventFormatStage || null,
      eventStage: stageData.eventStage || null,
      scores: [...(stageData.scores || [])],
      subStages: [],
    };
    
    stageMap.set(stageId, stage);
  }
  
  // Second pass: build the tree structure by linking children to parents
  for (const [stageId, stage] of stageMap.entries()) {
    // Determine parent ID - check both eventFormatStage and venueEventFormatStage
    const parentId = 
      stage.eventFormatStage?.parentId ||
      stage.venueEventFormatStage?.parentId ||
      null;
    
    if (parentId && stageMap.has(parentId)) {
      // Add as child of parent
      stageMap.get(parentId)!.subStages.push(stage);
    } else {
      // Root level stage (no parent or parent not in this result set)
      rootStages.push(stage);
    }
  }
  
  return rootStages;
}

/**
 * Start building a stage query
 */
export function queryStages(db: Database): StageBuilder<{
  scores: false;
}> {
  let selectQuery: any = null;
  let queryType: 'eventFormat' | 'venueEventFormat' | 'event' | null = null;
  let queryId: string | null = null;
  
  const flags: JoinFlags = {
    scores: false,
  };
  const state: QueryBuilderState = {};
  
  const createBuilder = <F extends JoinFlags>(): StageBuilder<F> => ({
    forEventFormat(eventFormatId: string) {
      queryType = 'eventFormat';
      queryId = eventFormatId;
      // Fetch ALL eventFormatStages for this eventFormat (including all nested children via parentId)
      // We'll build the tree structure in memory
      selectQuery = db.select()
        .from(schema.eventFormatStages)
        .leftJoin(schema.venueEventFormatStages, eq(schema.eventFormatStages.id, schema.venueEventFormatStages.eventFormatStageId))
        .leftJoin(schema.eventStages, eq(schema.venueEventFormatStages.id, schema.eventStages.venueEventFormatStageId))
        .where(eq(schema.eventFormatStages.eventFormatId, eventFormatId));
      // Note: This will fetch all stages for the eventFormat, including nested ones
      // The tree building logic will organize them by parentId
      return createBuilder<F>() as any;
    },
    
    forVenueEventFormat(venueEventFormatId: string) {
      queryType = 'venueEventFormat';
      queryId = venueEventFormatId;
      // Fetch ALL venueEventFormatStages for this venueEventFormat (including all nested children)
      selectQuery = db.select()
        .from(schema.venueEventFormatStages)
        .leftJoin(schema.eventFormatStages, eq(schema.venueEventFormatStages.eventFormatStageId, schema.eventFormatStages.id))
        .leftJoin(schema.eventStages, eq(schema.venueEventFormatStages.id, schema.eventStages.venueEventFormatStageId))
        .where(eq(schema.venueEventFormatStages.venueEventFormatId, venueEventFormatId));
      return createBuilder<F>() as any;
    },
    
    forEvent(eventId: string) {
      queryType = 'event';
      queryId = eventId;
      // Fetch ALL eventStages for this event (including all nested children via venueEventFormatStages)
      selectQuery = db.select()
        .from(schema.eventStages)
        .leftJoin(schema.venueEventFormatStages, eq(schema.eventStages.venueEventFormatStageId, schema.venueEventFormatStages.id))
        .leftJoin(schema.eventFormatStages, eq(schema.venueEventFormatStages.eventFormatStageId, schema.eventFormatStages.id))
        .where(eq(schema.eventStages.eventId, eventId));
      return createBuilder<F>() as any;
    },
    
    withScores() {
      if (!flags.scores && selectQuery) {
        selectQuery = selectQuery
          .leftJoin(schema.participantEventStageScores, eq(schema.eventStages.id, schema.participantEventStageScores.eventStageId));
        flags.scores = true;
      }
      return createBuilder<F & { scores: true }>() as any;
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
    
    async execute(): Promise<StageWithDetails[]> {
      if (!selectQuery) {
        throw new Error('Must specify forEventFormat, forVenueEventFormat, or forEvent before executing');
      }
      
      // Apply where, limit, offset
      selectQuery = applyQueryModifiers(
        selectQuery,
        state,
        (q, cond) => q.where(cond),
        (q, n) => q.limit(n),
        (q, n) => q.offset(n)
      );
      
      const results = await selectQuery;
      
      // Debug: Log raw query results
      if (queryType === 'venueEventFormat') {
        console.log(`[queryStages] Raw query returned ${results.length} rows for venueEventFormatId: ${queryId}`);
        const uniqueVenueStageIds = new Set<string>();
        for (const row of results as any) {
          if (row.venue_event_format_stages?.id) {
            uniqueVenueStageIds.add(row.venue_event_format_stages.id);
          }
        }
        console.log(`[queryStages] Found ${uniqueVenueStageIds.size} unique venueEventFormatStages in results`);
      }
      
      // Group results by stage ID and collect scores
      // We need to handle all stages, including nested ones
      const stagesMap = new Map<string, {
        eventFormatStage?: EventFormatStage | null;
        venueEventFormatStage?: VenueEventFormatStage | null;
        eventStage?: EventStage | null;
        scores: ParticipantEventStageScore[];
      }>();
      
      for (const row of results as any) {
        // Process eventFormatStage if present
        if (row.event_format_stages) {
          const stageId = row.event_format_stages.id;
          if (!stagesMap.has(stageId)) {
            stagesMap.set(stageId, {
              eventFormatStage: row.event_format_stages,
              venueEventFormatStage: null,
              eventStage: null,
              scores: [],
            });
          }
        }
        
        // Process venueEventFormatStage if present
        if (row.venue_event_format_stages) {
          const stageId = row.venue_event_format_stages.id;
          if (!stagesMap.has(stageId)) {
            stagesMap.set(stageId, {
              eventFormatStage: row.event_format_stages || null,
              venueEventFormatStage: row.venue_event_format_stages,
              eventStage: null,
              scores: [],
            });
          } else {
            // Update existing entry
            const existing = stagesMap.get(stageId)!;
            existing.venueEventFormatStage = row.venue_event_format_stages;
            if (row.event_format_stages) {
              existing.eventFormatStage = row.event_format_stages;
            }
          }
        }
        
        // Process eventStage if present
        if (row.event_stages) {
          const stageId = row.event_stages.id;
          if (!stagesMap.has(stageId)) {
            stagesMap.set(stageId, {
              eventFormatStage: row.event_format_stages || null,
              venueEventFormatStage: row.venue_event_format_stages || null,
              eventStage: row.event_stages,
              scores: [],
            });
          } else {
            // Update existing entry
            const existing = stagesMap.get(stageId)!;
            existing.eventStage = row.event_stages;
            if (row.venue_event_format_stages) {
              existing.venueEventFormatStage = row.venue_event_format_stages;
            }
            if (row.event_format_stages) {
              existing.eventFormatStage = row.event_format_stages;
            }
          }
        }
        
        // Add score if present
        if (row.participant_event_stage_scores && row.event_stages) {
          const stageId = row.event_stages.id;
          const stage = stagesMap.get(stageId);
          if (stage && !stage.scores.find((s: any) => s.id === row.participant_event_stage_scores.id)) {
            stage.scores.push(row.participant_event_stage_scores);
          }
        }
      }
      
      // The initial query should have fetched all stages for the eventFormat/venueEventFormat/event
      // including nested ones (since we filter by eventFormatId/venueEventFormatId/eventId, not parentId)
      // Now we just need to build the tree structure
      const flatStages = Array.from(stagesMap.values());
      return buildStageTree(flatStages);
    },
    
    $metaType: null as any as StageJoinResult<F>,
  } as StageBuilder<F>);
  
  return createBuilder();
}

// ============================================================================
// Upsert Functions
// ============================================================================

/**
 * Upsert stages with recursive sub-stages
 */
export async function upsertStagesWithDetails(
  db: Database,
  stages: StageWithDetails[],
  parentId: string | null = null,
  eventId?: string
): Promise<void> {
  for (const stageData of stages) {
    // Upsert eventFormatStage if provided
    if (stageData.eventFormatStage) {
      const eventFormatStage = {
        ...stageData.eventFormatStage,
        parentId: parentId || stageData.eventFormatStage.parentId || null,
      } as Partial<EventFormatStageInsert>;
      
      // Build condition - check by name first (if not empty), then by composite key
      let condition: Record<string, any> = {};
      if (eventFormatStage.name != null && eventFormatStage.name !== '') {
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
    
    // Upsert venueEventFormatStage if provided
    if (stageData.venueEventFormatStage) {
      const venueEventFormatStage = {
        ...stageData.venueEventFormatStage,
        parentId: parentId || stageData.venueEventFormatStage.parentId || null,
      } as Partial<VenueEventFormatStageInsert>;
      
      // Build condition - check by name first, then by composite key
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
    }
    
    // Upsert eventStage if provided
    if (stageData.eventStage && eventId) {
      const eventStageId = stageData.eventStage.id;
      await upsertEntity(db, schema.eventStages, {
        ...stageData.eventStage,
        eventId,
      } as Partial<EventStageInsert>, { id: eventStageId });
      
      // Upsert scores for this stage
      if (stageData.scores.length > 0) {
        const scores = stageData.scores.map(score => ({
          ...score,
          eventStageId,
        }));
        await upsertEntities(db, schema.participantEventStageScores, scores as Partial<ParticipantEventStageScoreInsert>[], (score) => ({ id: score.id }));
        
        // Delete scores that are no longer in the list
        const keepScoreIds = stageData.scores.map(s => s.id).filter((id): id is string => !!id);
        await deleteMissingChildren(
          db,
          schema.participantEventStageScores,
          schema.participantEventStageScores.eventStageId,
          eventStageId,
          keepScoreIds
        );
      }
    }
    
    // Recursively upsert sub-stages
    if (stageData.subStages.length > 0) {
      const currentParentId = 
        stageData.eventStage?.id ||
        stageData.venueEventFormatStage?.id ||
        stageData.eventFormatStage?.id ||
        parentId;
      
      await upsertStagesWithDetails(db, stageData.subStages, currentParentId, eventId);
    }
  }
}

