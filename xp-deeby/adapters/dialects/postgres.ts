/**
 * PostgreSQL Schema Helpers
 * 
 * PostgreSQL-specific schema building helpers.
 * These are used for defining table schemas in Drizzle ORM when using PostgreSQL.
 */

import { 
  pgTable as table, 
  varchar, 
  integer, 
  unique, 
  real, 
  index, 
  text,
  jsonb,
  boolean as bool,
  timestamp
} from 'drizzle-orm/pg-core';

// UUID helpers for convenience (using varchar since PostgreSQL doesn't have a native UUID type in drizzle)
const uuid = (name: string) => varchar(name);
const uuidDefault = (name: string) => uuid(name);
const uuidPK = (name: string) => uuidDefault(name).primaryKey();

export {
  table, text, varchar, integer, real, timestamp, jsonb, unique, index, bool, uuid, uuidPK, uuidDefault
}
