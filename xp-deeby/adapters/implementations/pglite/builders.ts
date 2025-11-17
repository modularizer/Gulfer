/**
 * SQLite PGlite Adapter
 * 
 * Uses PGlite (PostgreSQL in WebAssembly) for persistent SQL databases in the browser.
 * 
 * ✅ Real persistent database (uses IndexedDB for storage)
 * ✅ Automatic persistence (PGlite handles it - NO EXPORTS NEEDED!)
 * ✅ Efficient incremental writes
 * ✅ Full Drizzle ORM support (built-in PGlite driver)
 * ✅ NO COOP/COEP headers required!
 * 
 * PGlite is PostgreSQL in WASM, which means:
 * - Full SQL support (PostgreSQL dialect)
 * - Automatic persistence to IndexedDB
 * - No special server headers needed
 * - Works out of the box with Expo dev server
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





