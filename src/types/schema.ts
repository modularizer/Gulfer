/**
 * Runtime schema definitions using Zod
 * Provides both TypeScript types and runtime validation
 */

import { z } from 'zod';

/**
 * UUID validation - 16 hex characters
 */
const uuidSchema = z.string().regex(/^[0-9a-f]{16}$/i, 'Must be a 16 character hex UUID');

/**
 * Base entity schema
 * Shared fields for entities that have id, name, notes, and location
 */
export const baseEntitySchema = z.object({
  id: uuidSchema,
  name: z.string().min(1, 'Name cannot be empty').max(50, 'Name too long'),
  notes: z.string().max(200, 'Notes too long').optional(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
});

export type BaseEntity = z.infer<typeof baseEntitySchema>;

/**
 * Player schema
 * Extends base entity schema
 */
export const playerSchema = baseEntitySchema;

export type Player = z.infer<typeof playerSchema>;

/**
 * Hole schema
 * Holes are stored in their own table for better query performance
 * Extends base entity schema with hole-specific fields
 */
export const holeSchema = baseEntitySchema.extend({
  courseId: uuidSchema, // Course this hole belongs to
  number: z.number().int().positive('Hole number must be positive'),
  par: z.number().int().positive('Par must be positive').optional(),
  distance: z.number().nonnegative('Distance cannot be negative').optional(),
});

export type Hole = z.infer<typeof holeSchema>;

/**
 * Score schema
 * Note: userId and roundId are denormalized here for faster queries
 */
export const scoreSchema = z.object({
  id: uuidSchema, // Unique ID for this score record
  holeNumber: z.number().int().positive('Hole number must be positive'),
  throws: z.number().int(),
  complete: z.boolean().default(true), // Whether the hole is complete (default true for backward compatibility)
  userId: uuidSchema,
  roundId: uuidSchema,
});

export type Score = z.infer<typeof scoreSchema>;

/**
 * UserRound schema
 * Links a user to a round
 * Note: Scores are stored separately in their own table for better query performance
 * Extends base entity schema with relationship fields
 */
export const userRoundSchema = baseEntitySchema.extend({
  userId: uuidSchema,
  roundId: uuidSchema,
  frozen: z.boolean().default(false), // Whether this UserRound is frozen (locked from further edits)
});

export type UserRound = z.infer<typeof userRoundSchema>;

// Note: GPS and gesture tracking features (Phase 2 & 3) are not yet implemented.
// These relations can be added back when those features are implemented.

/**
 * Round schema
 * Note: Scores are now stored separately in UserRound entities
 * Note: Players are computed from UserRound entities, not stored here
 * Extends base entity schema with round-specific fields
 * Uses 'name' from baseEntitySchema as the display name
 */
export const roundSchema = baseEntitySchema.extend({
  date: z.number().nonnegative('Date must be a valid timestamp'),
  courseId: uuidSchema.optional(),
});

export type Round = z.infer<typeof roundSchema>;

/**
 * Course schema
 * Note: Holes are stored separately in their own table for better query performance
 * Extends base entity schema
 */
export const courseSchema = baseEntitySchema;

export type Course = z.infer<typeof courseSchema>;

/**
 * User schema
 * Note: User and Player are the same - both extend baseEntitySchema
 * They are stored in the same table (players/users table)
 */
export const userSchema = baseEntitySchema;

export type User = z.infer<typeof userSchema>;

/**
 * Current user schema
 * Stores the current user ID in a separate table
 */
export const currentUserSchema = z.object({
  id: uuidSchema, // Unique ID for this record (only one should exist)
  playerId: uuidSchema, // The player/user ID that is the current user
});

export type CurrentUser = z.infer<typeof currentUserSchema>;

/**
 * Photo schema
 * Photos are stored in their own table and can reference any entity via refId
 * This allows photos to be associated with rounds, courses, users, etc. without
 * requiring each entity to store a photos array
 */
export const photoSchema = z.object({
  id: uuidSchema, // Unique ID for this photo record
  refId: uuidSchema, // UUID of the entity this photo belongs to (can be from any table)
  hash: z.string().min(1, 'Hash cannot be empty'), // Image hash (for deduplication)
});

export type Photo = z.infer<typeof photoSchema>;

/**
 * Merge entry schema
 * Supports all entity types that can be merged between storage instances
 */
export const mergeEntrySchema = z.object({
  foreignStorageId: uuidSchema,
  foreignEntityUuid: uuidSchema,
  localEntityUuid: uuidSchema,
  entityType: z.enum(['course', 'round', 'player', 'user', 'userround', 'hole', 'score', 'photo']),
  mergedAt: z.number().nonnegative(),
});

export type MergeEntry = z.infer<typeof mergeEntrySchema>;

/**
 * Column visibility config schema
 */
export const columnVisibilityConfigSchema = z.object({
  distance: z.boolean().optional(),
  par: z.boolean().optional(),
  gStats: z.boolean().optional(),
  showUnderlines: z.boolean().optional(),
  showFontSizeAdjustments: z.boolean().optional(),
  showFontColorAdjustments: z.boolean().optional(),
}).passthrough(); // Allow additional properties for future columns

export type ColumnVisibilityConfig = z.infer<typeof columnVisibilityConfigSchema>;

/**
 * Storage schema version
 */
export const SCHEMA_VERSION = 2; // Incremented for UserRound split

/**
 * Validate and parse data with error handling
 */
export function validateAndParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): { success: true; data: T } | { success: false; error: string } {
  try {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      const errorMessage = result.error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join('; ');
      return {
        success: false,
        error: context
          ? `${context}: ${errorMessage}`
          : errorMessage,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown validation error',
    };
  }
}

/**
 * Validate and parse with throwing behavior (for use in try-catch blocks)
 */
export function parseOrThrow<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): T {
  const result = validateAndParse(schema, data, context);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data;
}

/**
 * Validate array of entities
 */
export function validateArray<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): { success: true; data: T[] } | { success: false; error: string } {
  if (!Array.isArray(data)) {
    return {
      success: false,
      error: context ? `${context}: Expected array` : 'Expected array',
    };
  }

  const results: T[] = [];
  const errors: string[] = [];

  for (let i = 0; i < data.length; i++) {
    const result = validateAndParse(schema, data[i], `${context || 'Item'}[${i}]`);
    if (result.success) {
      results.push(result.data);
    } else {
      errors.push(result.error);
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: `Validation errors: ${errors.join('; ')}`,
    };
  }

  return { success: true, data: results };
}

