/**
 * EXAMPLE: Generic generic-sports implementation
 * This is a reference implementation showing how the generic-sports could be refactored
 * to support multiple sports. DO NOT use directly - this is for planning purposes.
 * 
 * Key changes:
 * - "Round" → "Event"
 * - "Hole" → "Segment" (with recursive support)
 * - "Course" → "Venue"
 * - "PlayerRound" → "PlayerEvent"
 * - Enhanced scoring with flexible JSON storage
 */

import { sqliteTable, text, integer, unique, real, index, sql } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// Base Types
// ============================================================================

const baseColumns = {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull().unique(),
  notes: text('notes', { length: 200 }),
  lat: real("lat").notNull(),
  lng: real("lng").notNull()
};

export type VenueMetadata = Record<string, any>;
export type EventMetadata = Record<string, any>;
export type SegmentMetadata = Record<string, any>;
export type PlayerEventMetadata = Record<string, any>;
export type ScoreMetadata = Record<string, any>;

// Scoring storage types
export type ScoringData = 
  | { type: 'simple'; value: number; unit?: string }
  | { type: 'time'; timeMs: number; timeDisplay: string; place?: number; lane?: number }
  | { type: 'set-based'; setsWon: number; setsLost: number; games?: Array<{ gamesWon: number; gamesLost: number; points?: number[] }> }
  | { type: 'multi-metric'; metrics: Record<string, number>; primaryMetric: string }
  | { type: 'custom'; sportType: string; data: Record<string, any> };

// ============================================================================
// Sports Table (unchanged)
// ============================================================================

export const sports = sqliteTable('sports', {
  ...baseColumns,
  standardNumberOfSegments: integer('standard_number_of_segments'), // Was: standardNumberOfHoles
  semiStandardNumberOfSegments: integer('semi_standard_number_of_segments'), // Was: semiStandardNumberOfHoles
  segmentMetadataDefaults: text('segment_metadata_defaults', {mode: 'json'}).$type<SegmentMetadata>(), // Was: holeMetadataDefaults
});

// ============================================================================
// Venues Table (replaces Courses)
// ============================================================================

export const venues = sqliteTable('venues', {
  ...baseColumns,
  sportId: text('sport_id').notNull().references(() => sports.id, { onDelete: 'cascade' }),
  venueType: text('venue_type'), // 'course', 'court', 'pool', 'alley', 'stadium', etc.
  metadata: text('metadata', {mode: 'json'}).$type<VenueMetadata>(),
}, (table) => ({
  latLngIdx: index("venue_lat_lng_idx").on(table.lat, table.lng),
}));

// ============================================================================
// Events Table (replaces Rounds)
// ============================================================================

export const events = sqliteTable('events', {
  ...baseColumns,
  venueId: text('venue_id').references(() => venues.id, { onDelete: 'set null' }),
  sportId: text('sport_id').notNull().references(() => sports.id, { onDelete: 'cascade' }),
  eventType: text('event_type'), // 'round', 'match', 'meet', 'series', 'tournament', etc.
  date: integer('date').notNull(), // Stored as milliseconds (timestamp)
  metadata: text('metadata', {mode: 'json'}).$type<EventMetadata>(),
}, (table) => ({
  venueDateUnique: unique().on(table.venueId, table.date),
  latLngIdx: index("event_lat_lng_idx").on(table.lat, table.lng),
}));

// ============================================================================
// Segments Table (replaces Holes) - RECURSIVE STRUCTURE
// ============================================================================

export const segments = sqliteTable('segments', {
  ...baseColumns,
  sportId: text('sport_id').notNull().references(() => sports.id, { onDelete: 'cascade' }),
  venueId: text('venue_id').references(() => venues.id, { onDelete: 'cascade' }),
  eventId: text('event_id').references(() => events.id, { onDelete: 'cascade' }),
  
  // RECURSIVE: Allows nesting (e.g., Tennis: Match → Set → Game)
  parentSegmentId: text('parent_segment_id').references(() => segments.id, { onDelete: 'cascade' }),
  
  segmentType: text('segment_type'), // 'hole', 'set', 'frame', 'heat', 'game', 'race', etc.
  
  // Flexible identification: use either number OR identifier
  number: integer('number'), // For numbered segments (holes, frames, etc.)
  identifier: text('identifier'), // For named segments ("Men's 100m", "Singles", etc.)
  
  order: integer('order').notNull().default(0), // For ordering within parent/event/venue
  
  metadata: text('metadata', {mode: 'json'}).$type<SegmentMetadata>(),
}, (table) => ({
  // Unique constraints depend on context
  // Venue-level segments (templates)
  venueNumberUnique: unique().on(table.venueId, table.number)
    .where(sql`parent_segment_id IS NULL AND event_id IS NULL`),
  venueIdentifierUnique: unique().on(table.venueId, table.identifier)
    .where(sql`parent_segment_id IS NULL AND event_id IS NULL AND identifier IS NOT NULL`),
  
  // Event-level segments
  eventNumberUnique: unique().on(table.eventId, table.number)
    .where(sql`parent_segment_id IS NULL AND event_id IS NOT NULL`),
  eventIdentifierUnique: unique().on(table.eventId, table.identifier)
    .where(sql`parent_segment_id IS NULL AND event_id IS NOT NULL AND identifier IS NOT NULL`),
  
  // Nested segments (within parent)
  parentNumberUnique: unique().on(table.parentSegmentId, table.number)
    .where(sql`parent_segment_id IS NOT NULL`),
  parentIdentifierUnique: unique().on(table.parentSegmentId, table.identifier)
    .where(sql`parent_segment_id IS NOT NULL AND identifier IS NOT NULL`),
  
  // Indexes for common queries
  eventIdx: index("segment_event_idx").on(table.eventId),
  parentIdx: index("segment_parent_idx").on(table.parentSegmentId),
  venueIdx: index("segment_venue_idx").on(table.venueId),
}));

// ============================================================================
// Player Events Table (replaces PlayerRounds)
// ============================================================================

export const playerEvents = sqliteTable('player_events', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  notes: text('notes', { length: 200 }),
  latitude: integer('latitude'),
  longitude: integer('longitude'),
  playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  frozen: integer('frozen', { mode: 'boolean' }).default(false).notNull(),
  metadata: text('metadata', {mode: 'json'}).$type<PlayerEventMetadata>(),
}, (table) => ({
  eventPlayerUnique: unique().on(table.eventId, table.playerId),
  eventIdx: index("player_event_event_idx").on(table.eventId),
  playerIdx: index("player_event_player_idx").on(table.playerId),
}));

// ============================================================================
// Scores Table (replaces PlayerRoundHoleScores) - FLEXIBLE SCORING
// ============================================================================

export const scores = sqliteTable('scores', {
  id: text('id').primaryKey().notNull(),
  playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  segmentId: text('segment_id').notNull().references(() => segments.id, { onDelete: 'cascade' }),
  
  // Primary score value (for backward compatibility and simple cases)
  // Use REAL instead of INTEGER to support time-based scoring
  value: real('value'), // Can be integer (strokes, pins) or float (time in seconds)
  
  // Extended scoring (JSON for complex cases)
  // Examples:
  // - Golf: { type: 'simple', value: 4, unit: 'strokes' }
  // - Tennis: { type: 'set-based', setsWon: 2, games: [...] }
  // - Swimming: { type: 'time', timeMs: 45230, timeDisplay: '45.23', place: 1 }
  scoringData: text('scoring_data', {mode: 'json'}).$type<ScoringData>(),
  
  recordedAt: integer('recorded_at').notNull().$defaultFn(() => Date.now()),
  complete: integer('complete', { mode: 'boolean' }).default(true).notNull(),
  metadata: text('metadata', {mode: 'json'}).$type<ScoreMetadata>(),
}, (table) => ({
  // One score per player per segment per event
  eventPlayerSegmentUnique: unique().on(table.eventId, table.playerId, table.segmentId),
  
  // Indexes for common queries
  eventIdx: index("score_event_idx").on(table.eventId),
  playerIdx: index("score_player_idx").on(table.playerId),
  segmentIdx: index("score_segment_idx").on(table.segmentId),
  eventPlayerIdx: index("score_event_player_idx").on(table.eventId, table.playerId),
}));

// ============================================================================
// Players Table (unchanged, but shown for reference)
// ============================================================================

export enum Sex {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  MIXED = 'MIXED',
  UNKNOWN = 'UNKNOWN',
}

export const playerColumns = {
  ...baseColumns,
  sex: text("sex", {
    enum: [Sex.MALE, Sex.FEMALE, Sex.MIXED, Sex.UNKNOWN],
  }).notNull().default(Sex.UNKNOWN),
  isTeam: integer('is_team', { mode: 'boolean' }).default(false),
};

export const players = sqliteTable('players', playerColumns,
  (table) => ({
    latLngIdx: index("player_lat_lng_idx").on(table.lat, table.lng),
  })
);

export const teamMembers = sqliteTable('team_members', {
  id: text('id').primaryKey().notNull(),
  teamId: text('team_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
}, (table) => ({
  teamPlayerUnique: unique().on(table.teamId, table.playerId),
}));

// ============================================================================
// Relations
// ============================================================================

export const sportsRelations = relations(sports, ({ many }) => ({
  venues: many(venues),
  events: many(events),
  segments: many(segments),
}));

export const venuesRelations = relations(venues, ({ one, many }) => ({
  sport: one(sports, {
    fields: [venues.sportId],
    references: [sports.id],
  }),
  events: many(events),
  segments: many(segments),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  venue: one(venues, {
    fields: [events.venueId],
    references: [venues.id],
  }),
  sport: one(sports, {
    fields: [events.sportId],
    references: [sports.id],
  }),
  playerEvents: many(playerEvents),
  segments: many(segments),
  scores: many(scores),
}));

export const segmentsRelations = relations(segments, ({ one, many }) => ({
  sport: one(sports, {
    fields: [segments.sportId],
    references: [sports.id],
  }),
  venue: one(venues, {
    fields: [segments.venueId],
    references: [venues.id],
  }),
  event: one(events, {
    fields: [segments.eventId],
    references: [events.id],
  }),
  parent: one(segments, {
    fields: [segments.parentSegmentId],
    references: [segments.id],
    relationName: 'parent',
  }),
  children: many(segments, {
    relationName: 'parent',
  }),
  scores: many(scores),
}));

export const playerEventsRelations = relations(playerEvents, ({ one }) => ({
  player: one(players, {
    fields: [playerEvents.playerId],
    references: [players.id],
  }),
  event: one(events, {
    fields: [playerEvents.eventId],
    references: [events.id],
  }),
}));

export const scoresRelations = relations(scores, ({ one }) => ({
  player: one(players, {
    fields: [scores.playerId],
    references: [players.id],
  }),
  event: one(events, {
    fields: [scores.eventId],
    references: [events.id],
  }),
  segment: one(segments, {
    fields: [scores.segmentId],
    references: [segments.id],
  }),
}));

export const playersRelations = relations(players, ({ many }) => ({
  teamMembersAsTeam: many(teamMembers, { relationName: 'team' }),
  teamMembersAsPlayer: many(teamMembers, { relationName: 'player' }),
  playerEvents: many(playerEvents),
  scores: many(scores),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(players, {
    fields: [teamMembers.teamId],
    references: [players.id],
    relationName: 'team',
  }),
  player: one(players, {
    fields: [teamMembers.playerId],
    references: [players.id],
    relationName: 'player',
  }),
}));

// ============================================================================
// Helper Queries Examples
// ============================================================================

/**
 * Get all top-level segments for an event (e.g., all sets in a tennis match)
 */
export async function getTopLevelSegmentsForEvent(eventId: string) {
  // This would be in a storage file, not generic-sports
  // Shown here for reference
  /*
  return await db
    .select()
    .from(segments)
    .where(
      and(
        eq(segments.eventId, eventId),
        isNull(segments.parentSegmentId)
      )
    )
    .orderBy(segments.order);
  */
}

/**
 * Get all nested segments for a parent segment (e.g., all games in a set)
 */
export async function getNestedSegmentsForParent(parentSegmentId: string) {
  /*
  return await db
    .select()
    .from(segments)
    .where(eq(segments.parentSegmentId, parentSegmentId))
    .orderBy(segments.order);
  */
}

/**
 * Get all scores for a player in an event, with segment information
 */
export async function getPlayerScoresForEvent(eventId: string, playerId: string) {
  /*
  return await db
    .select({
      score: scores,
      segment: segments,
    })
    .from(scores)
    .innerJoin(segments, eq(scores.segmentId, segments.id))
    .where(
      and(
        eq(scores.eventId, eventId),
        eq(scores.playerId, playerId)
      )
    )
    .orderBy(segments.order);
  */
}


