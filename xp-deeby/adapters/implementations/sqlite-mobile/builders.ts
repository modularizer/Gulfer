/**
 * SQLite Mobile Adapter
 * 
 * Uses expo-sqlite for React Native platforms.
 */

import {ColumnBuilder} from 'drizzle-orm';
import { sqliteTable, text, integer, unique, real, index, customType } from 'drizzle-orm/sqlite-core';
import {IndexConstraint, SchemaBuilder, TableConstraints} from "../../abstract/builders";



// SQLite-specific schema adapters
// Create a custom varchar type that works with SQLite tables
const varchar = customType<{ data: string; config: { length?: number } }>({
  dataType(config) {
    return (config && typeof config.length !== 'undefined') ? `varchar(${config.length})` : 'varchar';
  },
});

// jsonb in SQLite is text with mode: 'json'
const jsonb = (name: string) => text(name, {mode: 'json'});

// bool in SQLite is integer with mode: 'boolean'
const bool = (name: string) => integer(name, {mode: 'boolean'});

// timestamp in SQLite is integer with mode: 'timestamp'
const timestamp = (name: string) => integer(name, {mode: 'timestamp'});

// UUID helpers for convenience
const uuid = (name: string) => text(name);
const uuidDefault = (name: string) => uuid(name);
const uuidPK = (name: string) => uuidDefault(name).primaryKey();

/**
 * SQLite Schema Builder
 * Exports schema functions for SQLite dialect
 */
export const schema: SchemaBuilder = {
  table: (
      name: string,
      columns: Record<string, ColumnBuilder>,
      constraints?: TableConstraints
  ) => sqliteTable(name, columns),
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
  index: (name: string) => index(name) as IndexConstraint,
};
