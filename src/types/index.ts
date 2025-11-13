/**
 * Core data types for Gulfer app
 * 
 * Types are now defined in schema.ts with runtime validation.
 * This file re-exports them for backward compatibility.
 */

// Re-export types from schema (which includes runtime validation)
export type {
  BaseEntity,
  Player,
  Hole,
  Score,
  Round,
  UserRound,
  Course,
  User,
  CurrentUser,
  Photo,
  MergeEntry,
  ColumnVisibilityConfig,
} from './schema';

// Re-export orm and validation utilities
export {
  baseEntitySchema,
  playerSchema,
  holeSchema,
  scoreSchema,
  userRoundSchema,
  roundSchema,
  courseSchema,
  userSchema,
  currentUserSchema,
  photoSchema,
  mergeEntrySchema,
  columnVisibilityConfigSchema,
  validateAndParse,
  parseOrThrow,
  validateArray,
  SCHEMA_VERSION,
} from './schema';

