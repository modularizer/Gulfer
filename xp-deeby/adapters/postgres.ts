/**
 * PostgreSQL Schema Helpers
 * 
 * PostgreSQL-specific schema building helpers.
 * These are used for defining table schemas in Drizzle ORM when using PostgreSQL.
 */

import { pgTable, varchar, integer, unique, real, index, text } from 'drizzle-orm/pg-core';

// ============================================================================
// PostgreSQL Schema Adapters
// ============================================================================
// These are helper functions for building PostgreSQL schemas
// They wrap Drizzle's PostgreSQL core functions with convenient defaults

const jsonb = (name: string) => text(name, {mode: 'json'});
const bool = (name: string) => integer(name, {mode: 'boolean'});
const timestamp = (name: string) => integer(name, {mode: 'timestamp'});
const table = pgTable;

const uuid = (name: string) => varchar(name);
const uuidDefault = (name: string) => uuid(name);
const uuidPK = (name: string) => uuidDefault(name).primaryKey();

export {
    table, text, varchar, integer, real, timestamp, jsonb, unique, index, bool, uuid, uuidPK, uuidDefault
}
