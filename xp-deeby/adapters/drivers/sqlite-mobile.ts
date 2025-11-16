/**
 * SQLite Mobile Adapter
 * 
 * Uses expo-sqlite for React Native platforms.
 */

import {ColumnBuilder, sql} from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import {AdapterType, RegistryEntry} from '../types';
import {Database, DrizzleDatabase} from '../database';
import {IndexConstraint, SchemaBuilder, TableConstraints} from '../schema-builder';
import { sqliteTable, text, integer, unique, real, index, customType } from 'drizzle-orm/sqlite-core';

/**
 * Base interface for database operations
 */
interface DatabaseBase {
  execute: (query: SQL) => Promise<any>;
  select: () => any;
  insert: (table: any) => any;
  update: (table: any) => any;
  delete: (table: any) => any;
}

/**
 * Database type for SQLite Mobile
 * Note: drizzleExpo is imported dynamically, so we use a generic type here
 */
type SqliteMobileDatabase = DatabaseBase;

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

/**
 * SQLite Mobile Adapter Implementation
 */
export class SqliteMobileAdapter extends Database {

  constructor() {
    super(AdapterType.SQLITE_MOBILE);
  }

  /**
   * Get registry entry for a database
   */
  async getRegistryEntry(name: string): Promise<RegistryEntry> {
    return {
      name,
      adapterType: AdapterType.SQLITE_MOBILE,
      connectionInfo: {
        // SQLite mobile uses file name, no additional connection info needed
        fileName: `${name}.db`
      }
    };
  }

  /**
   * Open a database connection from a registry entry
   * Sets this.db and returns this adapter instance
   */
  async openFromRegistry(entry: RegistryEntry): Promise<this> {
    if (entry.adapterType !== AdapterType.SQLITE_MOBILE) {
      throw new Error(`SqliteMobileAdapter cannot open ${entry.adapterType} database`);
    }

    // Dynamically import expo-sqlite and drizzle to avoid loading on incompatible platforms
    const SQLite = await import('expo-sqlite');
    const { drizzle: drizzleExpo } = await import('drizzle-orm/expo-sqlite');

    const dbName = entry.connectionInfo?.fileName || `${entry.name}.db`;
    const sqlite = await SQLite.openDatabaseAsync(dbName);
    this.db = drizzleExpo(sqlite) as DrizzleDatabase;
    return this;
  }

  async getTableNames(): Promise<string[]> {
    try {
      const result = await this.db.execute(
        sql`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__%'`
      ) as any[];
      return result.map((row: any) => row.name);
    } catch (error) {
      console.error('Error getting table names:', error);
      return [];
    }
  }


  /**
   * Delete a SQLite mobile database
   */
  async deleteDatabase(entry: RegistryEntry): Promise<void> {
    const dbName = entry.connectionInfo?.fileName || `${entry.name}.db`;
    const SQLite = await import('expo-sqlite');
    await SQLite.deleteDatabaseAsync(dbName);
  }
}
