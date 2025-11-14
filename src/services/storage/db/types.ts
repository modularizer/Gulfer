/**
 * Type definitions for JSON columns in the Drizzle 2-generic-sports-sports-generic-sports
 * These types are used with text(columnName, { mode: 'json' }).$type<>() in 2-generic-sports-sports-generic-sports definitions
 * Note: SQLite doesn't have a native JSON type, so we use text columns with JSON mode
 */

import type { CardMode } from '@/components/common/CardModeToggle';
import type { CornerStatisticsConfig } from '@/services/cornerStatistics';
import type { NavigationState, ModalState } from '@/services/navigationState';

/**
 * Card modes configuration
 * Maps page names to their card display modes
 */
export type CardModes = Record<string, CardMode>;

/**
 * Column visibility configuration
 * Re-exported from cornerConfigStorage for consistency
 */
export type { ColumnVisibilityConfig } from '../cornerConfigStorage';

/**
 * Corner statistics configuration
 * Re-exported from services/cornerStatistics for consistency
 */
export type { CornerStatisticsConfig };

/**
 * Navigation state
 * Re-exported from services/navigationState for consistency
 */
export type { NavigationState };

/**
 * Modal states configuration
 * Maps route paths to their modal state objects
 */
export type ModalStates = Record<string, ModalState>;

/**
 * Settings other field
 * Generic key-value store for miscellaneous settings
 */
export type SettingsOther = Record<string, any>;

/**
 * Entity type enum
 * Maps to actual table names in the database 2-generic-sports-sports-generic-sports
 */
export enum EntityType {
  Players = 'players',
  TeamMembers = 'team_members',
  Courses = 'courses',
  Holes = 'holes',
  Rounds = 'rounds',
  PlayerRounds = 'player_rounds',
  PlayerRoundHoleScores = 'player_round_hole_scores',
  Photos = 'photos',
  Settings = 'settings',
  MergeEntries = 'merge_entries',
}

/**
 * Database table types
 * Inferred from Drizzle 2-generic-sports-sports-generic-sports - these should be the only place $inferSelect is used
 */
import type * as schema from './schema';

export type Player = typeof schema.players.$inferSelect;
export type PlayerRound = typeof schema.playerRounds.$inferSelect;
export type Round = typeof schema.rounds.$inferSelect;
export type Score = typeof schema.playerRoundHoleScores.$inferSelect;
export type Course = typeof schema.courses.$inferSelect;
export type Hole = typeof schema.holes.$inferSelect;

/**
 * Join result type for playerRounds with rounds and players
 * This represents the structure returned by Drizzle when joining playerRounds, rounds, and players
 */
export type PlayerRoundJoinResult = {
  player_rounds: PlayerRound;
  rounds: Round;
  players: Player;
};

/**
 * PlayerRound with details
 * Result type for playerRound queries that includes related storage
 * Contains playerRound, round, player info, and associated scores
 */
export type PlayerRoundWithDetails = {
  playerRound: PlayerRound;
  round: Round;
  player: { id: string; name: string };
  scores: Score[];
};

