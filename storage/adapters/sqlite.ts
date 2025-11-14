/**
 * SQLite Schema Helpers
 * 
 * SQLite-specific schema building helpers.
 * These can be used regardless of which adapter driver is selected.
 * They are used for defining table schemas in Drizzle ORM.
 */

import { sqliteTable, text, integer, unique, real, index } from 'drizzle-orm/sqlite-core';

// ============================================================================
// SQLite Schema Adapters
// ============================================================================
// These are helper functions for building SQLite schemas
// They wrap Drizzle's SQLite core functions with convenient defaults

const jsonb = (name: string) => text(name, {mode: 'json'});
const bool = (name: string) => integer(name, {mode: 'boolean'});
const timestamp = (name: string) => integer(name, {mode: 'timestamp'});
const table = sqliteTable;

const uuid = (name: string) => text(name);
const uuidDefault = (name: string) => uuid(name);
const uuidPK = (name: string) => uuidDefault(name).primaryKey();

export {
    table, text, integer, real, timestamp, jsonb, unique, index, bool, uuid, uuidPK, uuidDefault
}