/**
 * SQLite Mobile Adapter
 * 
 * Uses expo-sqlite for React Native platforms.
 */

import * as SQLite from 'expo-sqlite';
import { drizzle as drizzleExpo } from 'drizzle-orm/expo-sqlite';
import type { SQL } from 'drizzle-orm';
import type { Adapter, DatabaseAdapter, AdapterCapabilities } from './types';
import { PlatformName } from './factory';

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
 */
type SqliteMobileDatabase = ReturnType<typeof drizzleExpo> & DatabaseBase;

/**
 * SQLite Mobile Adapter Implementation
 */
export class SqliteMobileAdapter implements Adapter {
  getCapabilities(): AdapterCapabilities {
    return {
      supportsNamedDatabases: true,
      supportsGetTableNames: true,
      databaseType: 'sqlite',
      platform: PlatformName.MOBILE,
    };
  }

  async getDatabaseByName(name: string): Promise<DatabaseAdapter> {
    const dbName = `${name}.db`;
    const sqlite = await SQLite.openDatabaseAsync(dbName);
    return drizzleExpo(sqlite) as SqliteMobileDatabase;
  }

  async getTableNames(db: DatabaseAdapter): Promise<string[]> {
    // SQLite mobile uses the same sqlite_master table
    try {
      const { sql } = await import('drizzle-orm');
      const result = await db.execute(
        sql`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__%'`
      ) as any[];
      return result.map((row: any) => row.name);
    } catch (error) {
      console.error('Error getting table names:', error);
      return [];
    }
  }

}

