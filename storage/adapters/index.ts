export {
    table, text, integer, real, timestamp, jsonb, unique, index, bool, uuid, uuidPK, uuidDefault
} from './sqlite';

/**
 * Database type for SQLite
 * Supports expo-sqlite and sql.js adapters
 * Matches the type from @services/storage/db
 */
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sql-js';

export type Database = ExpoSQLiteDatabase<any> | BaseSQLiteDatabase<any, any, any>;