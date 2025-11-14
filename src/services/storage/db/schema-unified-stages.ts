/**
 * Unified Stages Schema
 * 
 * This schema uses a single "stages" table to represent:
 * - Events (rounds, matches, meets, tournaments)
 * - Groupings (rounds within tournaments, games within sets)
 * - Segments (holes, sets, frames, heats, games)
 * 
 * All differentiated by the "type" column and connected via recursive "parent" FK.
 * 
 * Example structures:
 * - Golf: Stage(type="round", parent=null) → Stage(type="hole", parent=roundId)
 * - Tennis: Stage(type="match", parent=null) → Stage(type="set", parent=matchId) → Stage(type="game", parent=setId)
 * - Tournament: Stage(type="tournament", parent=null) → Stage(type="round", parent=tournamentId) → Stage(type="hole", parent=roundId)
 */

import { sqliteTable, text, integer, unique, real, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import type {
  CardModes,
  ColumnVisibilityConfig,
  CornerStatisticsConfig,
  NavigationState,
  ModalStates,
  SettingsOther,
} from './types';

// ============================================================================
// Base Columns (for players, venues, etc.)
// ============================================================================

const baseColumns = {
  id: text('id').primaryKey().notNull(), // 16 hex character UUID
  name: text('name').notNull().unique(),
  notes: text('notes', { length: 200 }),
  lat: real("lat").notNull(),
  lng: real("lng").notNull()
};

// ============================================================================
// Players Table (unchanged)
// ============================================================================

export enum Sex {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  MIXED = 'MIXED',
  UNKNOWN = 'UNKNOWN',
}

export const playerColumns = {
  ...baseColumns,
  sex: text("sex", { enum: [Sex.MALE, Sex.FEMALE, Sex.MIXED, Sex.UNKNOWN],}).notNull().default(Sex.UNKNOWN),
  birthday: text("birthday"),
  isTeam: integer('is_team', { mode: 'boolean' }).default(false),
};

export const players = sqliteTable('players', playerColumns,
  (table) => ({
    latLngIdx: index("lat_lng_idx").on(table.lat, table.lng),
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
// Sports Table
// ============================================================================

export type StageMetadata = Record<string, any>;

export const sports = sqliteTable('sports', {
  ...baseColumns,
  standardNumberOfStages: integer('standard_number_of_stages'), // Was: standardNumberOfHoles
  semiStandardNumberOfStages: integer('semi_standard_number_of_stages'), // Was: semiStandardNumberOfHoles
  stageMetadataDefaults: text('stage_metadata_defaults', {mode: 'json'}).$type<StageMetadata>(), // Was: holeMetadataDefaults
});

// ============================================================================
// Venues Table (replaces Courses)
// ============================================================================

export const venues = sqliteTable('venues', {
  ...baseColumns,
  sportId: text('sport_id').notNull().references(() => sports.id, { onDelete: 'cascade' }),
  venueType: text('venue_type'), // 'course', 'court', 'pool', 'alley', 'stadium', etc.
  metadata: text('metadata', {mode: 'json'}).$type<StageMetadata>(),
}, (table) => ({
  latLngIdx: index("venue_lat_lng_idx").on(table.lat, table.lng),
}));

// ============================================================================
// Unified Stages Table
// 
// This single table represents:
// - Events (rounds, matches, meets, tournaments) - parent is null or tournament
// - Groupings (rounds within tournaments, games within sets) - parent is event/grouping
// - Segments (holes, sets, frames, heats, games) - parent is event/grouping/segment
// 
// The "type" column determines what kind of stage it is (sport-specific terminology)
// Examples: "round", "hole", "match", "set", "game", "tournament", "frame", "heat", etc.
// ============================================================================

export const stages = sqliteTable('stages', {
  id: text('id').primaryKey().notNull(), // 16 hex character UUID
  
  // Basic info
  name: text('name').notNull(),
  notes: text('notes', { length: 200 }),
  lat: real("lat"),
  lng: real("lng"),
  
  // Relationships
  venueId: text('venue_id').references(() => venues.id, { onDelete: 'set null' }),
  playerId: text('player_id').references(() => players.id, { onDelete: 'cascade' }), // For player-specific stages
  
  // Type and hierarchy
  type: text('type').notNull(), // Sport-specific: 'round', 'hole', 'match', 'set', 'game', 'tournament', 'frame', 'heat', etc.
  parentId: text('parent_id').references(() => stages.id, { onDelete: 'cascade' }), // RECURSIVE: FK to same table
  
  // Ordering
  order: integer('order').notNull().default(0), // For ordering within parent
  number: integer('number'), // Optional: for numbered stages (hole 1, frame 1, etc.)
  identifier: text('identifier'), // Optional: for named stages ("Men's 100m", "Singles", etc.)
  
  // Date/time
  date: integer('date'), // For events (rounds, matches, etc.) - stored as milliseconds
  
  // Scoring results (computed/stored per stage)
  value: real('value'), // Primary score value (strokes, time, points, etc.)
  place: integer('place'), // Ranking/place (1st, 2nd, 3rd, etc.)
  placeFromEnd: integer('place_from_end'), // Place from last (for reverse rankings)
  points: integer('points'), // Points awarded for this stage
  won: integer('won', { mode: 'boolean' }), // Did this player/stage win?
  lost: integer('lost', { mode: 'boolean' }), // Did this player/stage lose?
  scoreType: text('score_type'), // Descriptive: 'hole-in-one', 'eagle', 'birdie', 'ace', 'three-pointer', etc.
  
  // Extended storage
  stats: text('stats', {mode: 'json'}).$type<Record<string, any>>(), // Additional statistics/metadata
  metadata: text('metadata', {mode: 'json'}).$type<StageMetadata>(), // Additional flexible metadata
  
  // Timestamps
  recordedAt: integer('recorded_at').notNull().$defaultFn(() => Date.now()), // When this stage was recorded
  complete: integer('complete', { mode: 'boolean' }).default(false).notNull(), // Is this stage complete?
  
  // Legacy/frozen flag (for backward compatibility)
  frozen: integer('frozen', { mode: 'boolean' }).default(false).notNull(),
}, (table) => ({
  // Indexes for common queries
  venueIdx: index("stage_venue_idx").on(table.venueId),
  playerIdx: index("stage_player_idx").on(table.playerId),
  parentIdx: index("stage_parent_idx").on(table.parentId),
  typeIdx: index("stage_type_idx").on(table.type),
  dateIdx: index("stage_date_idx").on(table.date),
  
  // Unique constraints
  // Note: SQLite doesn't support partial unique indexes with WHERE clauses.
  // Uniqueness should be enforced in application logic based on context:
  // - Venue-level stages: unique by (venueId, number) or (venueId, identifier) where parentId IS NULL
  // - Event-level stages: unique by (parentId, number) or (parentId, identifier) where parentId IS NOT NULL
  // - Player-specific stages: unique by (parentId, playerId) where playerId IS NOT NULL
  
  // Basic unique constraint for parent + number (when both are present)
  parentNumberUnique: unique().on(table.parentId, table.number),
  
  // Basic unique constraint for parent + identifier (when both are present)
  parentIdentifierUnique: unique().on(table.parentId, table.identifier),
  
  // Basic unique constraint for parent + player (when both are present)
  parentPlayerUnique: unique().on(table.parentId, table.playerId),
}));

// ============================================================================
// Photos Table (unchanged)
// ============================================================================

export const photos = sqliteTable('photos', {
  id: text('id').primaryKey().notNull(),
  refId: text('ref_id').notNull(), // 16 hex character UUID
  refTable: text('ref_table'),
  refSchema: text('ref_schema'),
  hash: text('hash').notNull().unique(), // SHA256 hash of image
  data: text('data'), // Base64 storage (web) or file path (mobile) - optional, can be stored separately
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

// ============================================================================
// Settings Table (unchanged)
// ============================================================================

export const settings = sqliteTable('settings', {
  userId: text('user_id').primaryKey().notNull().references(() => players.id, { onDelete: 'cascade' }),
  cardModes: text('card_modes', { mode: 'json' }).$type<CardModes>(),
  columnVisibility: text('column_visibility', { mode: 'json' }).$type<ColumnVisibilityConfig>(),
  cornerConfig: text('corner_config', { mode: 'json' }).$type<CornerStatisticsConfig>(),
  navigationState: text('navigation_state', { mode: 'json' }).$type<NavigationState | null>(),
  modalStates: text('modal_states', { mode: 'json' }).$type<ModalStates | null>(),
  other: text('other', { mode: 'json' }).$type<SettingsOther>(),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
});

// ============================================================================
// Merge Entries Table (unchanged)
// ============================================================================

export const mergeEntries = sqliteTable('merge_entries', {
  id: text('id').primaryKey().notNull(),
  foreignStorageId: text('foreign_storage_id').notNull(), // 16 hex characters
  foreignId: text('foreign_id').notNull(), // 16 hex characters
  refTable: text('ref_table').notNull(),
  refSchema: text('ref_schema'),
  localId: text('local_id').notNull().unique(), // 16 hex characters
  mergedAt: integer('merged_at').notNull(), // Stored as milliseconds
}, (table) => ({
  foreignStorageIdForeignIdUnique: unique().on(table.foreignStorageId, table.foreignId),
}));

// ============================================================================
// Relations
// ============================================================================

export const playersRelations = relations(players, ({ many }) => ({
  teamMembersAsTeam: many(teamMembers, { relationName: 'team' }),
  teamMembersAsPlayer: many(teamMembers, { relationName: 'player' }),
  stages: many(stages), // Player-specific stages
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

export const sportsRelations = relations(sports, ({ many }) => ({
  venues: many(venues),
}));

export const venuesRelations = relations(venues, ({ one, many }) => ({
  sport: one(sports, {
    fields: [venues.sportId],
    references: [sports.id],
  }),
  stages: many(stages), // Venue-level stage templates
}));

export const stagesRelations = relations(stages, ({ one, many }) => ({
  venue: one(venues, {
    fields: [stages.venueId],
    references: [venues.id],
  }),
  player: one(players, {
    fields: [stages.playerId],
    references: [players.id],
  }),
  parent: one(stages, {
    fields: [stages.parentId],
    references: [stages.id],
    relationName: 'parent',
  }),
  children: many(stages, {
    relationName: 'parent',
  }),
}));

export const settingsRelations = relations(settings, ({ one }) => ({
  user: one(players, {
    fields: [settings.userId],
    references: [players.id],
  }),
}));

// ============================================================================
// Usage Examples
// ============================================================================

/**
 * Example: Golf Round Structure
 * 
 * 1. Create venue (course):
 *    Stage(id="course1", type="venue", parentId=null, venueId=null)
 * 
 * 2. Create round (event):
 *    Stage(id="round1", type="round", parentId=null, venueId="course1", date=..., playerId=null)
 * 
 * 3. Create holes (segments):
 *    Stage(id="hole1", type="hole", parentId="round1", number=1, playerId=null)
 *    Stage(id="hole2", type="hole", parentId="round1", number=2, playerId=null)
 *    ...
 * 
 * 4. Create player scores (player-specific stages):
 *    Stage(id="score1", type="score", parentId="hole1", playerId="player1", value=4, place=1, ...)
 *    Stage(id="score2", type="score", parentId="hole1", playerId="player2", value=5, place=2, ...)
 */

/**
 * Example: Tennis Match Structure
 * 
 * 1. Create match (event):
 *    Stage(id="match1", type="match", parentId=null, venueId="court1", date=..., playerId=null)
 * 
 * 2. Create sets:
 *    Stage(id="set1", type="set", parentId="match1", number=1, playerId=null)
 *    Stage(id="set2", type="set", parentId="match1", number=2, playerId=null)
 * 
 * 3. Create games within sets:
 *    Stage(id="game1", type="game", parentId="set1", number=1, playerId=null)
 *    Stage(id="game2", type="game", parentId="set1", number=2, playerId=null)
 * 
 * 4. Create player results:
 *    Stage(id="result1", type="result", parentId="set1", playerId="player1", value=6, won=true, ...)
 *    Stage(id="result2", type="result", parentId="set1", playerId="player2", value=4, won=false, ...)
 */

/**
 * Example: Tournament Structure (Multi-round)
 * 
 * 1. Create tournament:
 *    Stage(id="tournament1", type="tournament", parentId=null, venueId="course1", date=..., playerId=null)
 * 
 * 2. Create rounds within tournament:
 *    Stage(id="round1", type="round", parentId="tournament1", number=1, date=..., playerId=null)
 *    Stage(id="round2", type="round", parentId="tournament1", number=2, date=..., playerId=null)
 * 
 * 3. Create holes within rounds:
 *    Stage(id="hole1", type="hole", parentId="round1", number=1, playerId=null)
 *    ...
 */

