/**
 * SQLite Schema Helpers
 * 
 * SQLite-specific schema building helpers.
 * These are used for defining table schemas in Drizzle ORM when using SQLite.
 */

import { sqliteTable, text, integer, unique, real, index, customType } from 'drizzle-orm/sqlite-core';

// ============================================================================
// SQLite Schema Adapters
// ============================================================================
// These are helper functions for building SQLite schemas
// They wrap Drizzle's SQLite core functions with convenient defaults

// Create a custom varchar type that works with SQLite tables
// SQLite accepts varchar (treats it as text), but we use it for PostgreSQL compatibility
const varchar = customType<{ data: string; config: { length?: number } }>({
  dataType(config) {
    return (config && typeof config.length !== 'undefined') ? `varchar(${config.length})` : 'varchar';
  },
});

const jsonb = (name: string) => text(name, {mode: 'json'});
const bool = (name: string) => integer(name, {mode: 'boolean'});
const timestamp = (name: string) => integer(name, {mode: 'timestamp'});
const table = sqliteTable;

const uuid = (name: string) => text(name);
const uuidDefault = (name: string) => uuid(name);
const uuidPK = (name: string) => uuidDefault(name).primaryKey();

export {
    table, text, varchar, integer, real, timestamp, jsonb, unique, index, bool, uuid, uuidPK, uuidDefault
}