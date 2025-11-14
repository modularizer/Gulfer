/**
 * Schema-Only Adapter Exports
 * 
 * This file exports ONLY the schema building functions needed for table definitions.
 * It does NOT export runtime adapter implementations, which prevents expo-sqlite
 * from being imported when drizzle-kit reads schema files.
 * 
 * Use this for schema definitions that will be read by drizzle-kit.
 */

// Export schema building helpers (these are pure functions, no runtime dependencies)
export {
    table, text, integer, real, timestamp, jsonb, unique, index, bool, uuid, uuidPK, uuidDefault
} from './sqlite';

