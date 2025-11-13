/**
 * Drizzle ORM schema definitions
 * Converted from custom ORM to Drizzle format
 */

import { sqliteTable, text, integer, unique } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';
import type {
  CardModes,
  ColumnVisibilityConfig,
  CornerStatisticsConfig,
  NavigationState,
  ModalStates,
  SettingsOther,
} from './types';

/**
 * Players table
 * Stores both players and users (they share the same schema)
 */
export const players = sqliteTable('players', {
  id: text('id').primaryKey().notNull(), // 16 hex character UUID
  name: text('name').notNull().unique(),
  notes: text('notes', { length: 200 }),
  latitude: integer('latitude'), // Stored as integer (multiply by 1e6 for precision)
  longitude: integer('longitude'), // Stored as integer (multiply by 1e6 for precision)
  isTeam: integer('is_team', { mode: 'boolean' }).default(false),
});

/**
 * Team members table
 * Links teams to players
 */
export const teamMembers = sqliteTable('team_members', {
  id: text('id').primaryKey().notNull(),
  teamId: text('team_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
}, (table) => ({
  teamPlayerUnique: unique().on(table.teamId, table.playerId),
}));

/**
 * Courses table
 */
export const courses = sqliteTable('courses', {
  id: text('id').primaryKey().notNull(), // 16 hex character UUID
  name: text('name').notNull().unique(),
  notes: text('notes', { length: 200 }),
  latitude: integer('latitude'), // Stored as integer (multiply by 1e6 for precision)
  longitude: integer('longitude'), // Stored as integer (multiply by 1e6 for precision)
});

/**
 * Holes table
 */
export const holes = sqliteTable('holes', {
  id: text('id').primaryKey().notNull(), // 16 hex character UUID
  name: text('name').notNull(),
  notes: text('notes', { length: 200 }),
  latitude: integer('latitude'), // Stored as integer (multiply by 1e6 for precision)
  longitude: integer('longitude'), // Stored as integer (multiply by 1e6 for precision)
  courseId: text('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  par: integer('par'),
  distance: integer('distance'),
}, (table) => ({
  courseNumberUnique: unique().on(table.courseId, table.number),
}));

/**
 * Rounds table
 */
export const rounds = sqliteTable('rounds', {
  id: text('id').primaryKey().notNull(), // 16 hex character UUID
  name: text('name').notNull(),
  notes: text('notes', { length: 200 }),
  latitude: integer('latitude'), // Stored as integer (multiply by 1e6 for precision)
  longitude: integer('longitude'), // Stored as integer (multiply by 1e6 for precision)
  courseId: text('course_id').references(() => courses.id, { onDelete: 'set null' }),
  date: integer('date').notNull(), // Stored as milliseconds (timestamp)
}, (table) => ({
  courseDateUnique: unique().on(table.courseId, table.date),
}));

/**
 * Player rounds table (UserRound)
 * Links players to rounds
 */
export const playerRounds = sqliteTable('player_rounds', {
  id: text('id').primaryKey().notNull(), // 16 hex character UUID
  name: text('name').notNull(),
  notes: text('notes', { length: 200 }),
  latitude: integer('latitude'), // Stored as integer (multiply by 1e6 for precision)
  longitude: integer('longitude'), // Stored as integer (multiply by 1e6 for precision)
  playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  roundId: text('round_id').notNull().references(() => rounds.id, { onDelete: 'cascade' }),
  frozen: integer('frozen', { mode: 'boolean' }).default(false).notNull(),
}, (table) => ({
  roundPlayerUnique: unique().on(table.roundId, table.playerId),
}));

/**
 * Player round hole scores table
 * Note: Score type uses userId/throws, but database uses playerId/score
 * This table does NOT extend baseColumns (scores don't have name/notes/location)
 */
export const playerRoundHoleScores = sqliteTable('player_round_hole_scores', {
  id: text('id').primaryKey().notNull(), // 16 hex character UUID
  playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  roundId: text('round_id').notNull().references(() => rounds.id, { onDelete: 'cascade' }),
  holeId: text('hole_id').notNull().references(() => holes.id, { onDelete: 'cascade' }),
  holeNumber: integer('hole_number').notNull(),
  score: integer('score').notNull(), // Number of throws (mapped to Score.throws)
  recordedAt: integer('recorded_at').notNull().$defaultFn(() => Date.now()), // Stored as milliseconds
  complete: integer('complete', { mode: 'boolean' }).default(true).notNull(),
}, (table) => ({
  roundPlayerHoleUnique: unique().on(table.roundId, table.playerId, table.holeId),
  roundPlayerHoleNumberUnique: unique().on(table.roundId, table.playerId, table.holeNumber),
}));


/**
 * Photos table
 * Stores photo references and image data
 */
export const photos = sqliteTable('photos', {
  id: text('id').primaryKey().notNull(),
  refId: text('ref_id').notNull(), // 16 hex character UUID
  refTable: text('ref_table'),
  refSchema: text('ref_schema'),
  hash: text('hash').notNull().unique(), // SHA256 hash of image
  data: text('data'), // Base64 data (web) or file path (mobile) - optional, can be stored separately
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

/**
 * Settings table
 * Stores application settings - one record per user
 * Contains all settings including currentUser
 */
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

/**
 * Merge entries table
 */
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

/**
 * Relations
 */
export const playersRelations = relations(players, ({ many }) => ({
  teamMembersAsTeam: many(teamMembers, { relationName: 'team' }),
  teamMembersAsPlayer: many(teamMembers, { relationName: 'player' }),
  playerRounds: many(playerRounds),
  scores: many(playerRoundHoleScores),
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

export const coursesRelations = relations(courses, ({ many }) => ({
  holes: many(holes),
  rounds: many(rounds),
}));

export const holesRelations = relations(holes, ({ one, many }) => ({
  course: one(courses, {
    fields: [holes.courseId],
    references: [courses.id],
  }),
  scores: many(playerRoundHoleScores),
}));

export const roundsRelations = relations(rounds, ({ one, many }) => ({
  course: one(courses, {
    fields: [rounds.courseId],
    references: [courses.id],
  }),
  playerRounds: many(playerRounds),
  scores: many(playerRoundHoleScores),
}));

export const playerRoundsRelations = relations(playerRounds, ({ one }) => ({
  player: one(players, {
    fields: [playerRounds.playerId],
    references: [players.id],
  }),
  round: one(rounds, {
    fields: [playerRounds.roundId],
    references: [rounds.id],
  }),
}));

export const playerRoundHoleScoresRelations = relations(playerRoundHoleScores, ({ one }) => ({
  player: one(players, {
    fields: [playerRoundHoleScores.playerId],
    references: [players.id],
  }),
  round: one(rounds, {
    fields: [playerRoundHoleScores.roundId],
    references: [rounds.id],
  }),
  hole: one(holes, {
    fields: [playerRoundHoleScores.holeId],
    references: [holes.id],
  }),
}));

export const settingsRelations = relations(settings, ({ one }) => ({
  user: one(players, {
    fields: [settings.userId],
    references: [players.id],
  }),
}));

