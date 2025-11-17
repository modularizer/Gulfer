/**
 * PostgreSQL Remote Adapter
 * 
 * Connects to remote PostgreSQL databases over the internet.
 * Uses the 'postgres' package for connections.
 */

import { 
  pgTable as pgTableFn, 
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
import {SchemaBuilder} from "../../abstract/builders";



// UUID helpers for convenience (using varchar since PostgreSQL doesn't have a native UUID type in drizzle)
const uuid = (name: string) => varchar(name);
const uuidDefault = (name: string) => uuid(name);
const uuidPK = (name: string) => uuidDefault(name).primaryKey();

/**
 * PostgreSQL Schema Builder
 * Exports schema functions for PostgreSQL dialect
 */
export const schema: SchemaBuilder = {
  table: pgTableFn,
  text,
  varchar,
  integer,
  real,
  timestamp,
  jsonb,
  bool,
  uuid,
  uuidDefault,
  uuidPK,
  unique,
  index,
};
