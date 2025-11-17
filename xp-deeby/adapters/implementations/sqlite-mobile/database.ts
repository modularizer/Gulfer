/**
 * SQLite Mobile Adapter
 * 
 * Uses expo-sqlite for React Native platforms.
 */

import {sql} from 'drizzle-orm';
import {AdapterType} from '../types';
import {Database, DrizAndClient, DrizzleDatabase} from '../../abstract/database';
import {AdapterCapabilities} from "../../abstract/capabilities";
import {adapterName, capabilities, RegistryEntry} from "./capabilities";



/**
 * SQLite Mobile Adapter Implementation
 */
export class SqliteMobileAdapter extends Database {
    getCapabilities(): AdapterCapabilities {
        return capabilities;
    }

    constructor() {
        super(adapterName);
    }

  async makeRegistryEntry(name: string): Promise<RegistryEntry> {
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
  async _openFromRegistry(entry: RegistryEntry): Promise<DrizAndClient> {
    // Dynamically import expo-sqlite and drizzle to avoid loading on incompatible platforms
    const SQLite = await import('expo-sqlite');
    const { drizzle: drizzleExpo } = await import('drizzle-orm/expo-sqlite');

    const dbName = entry.connectionInfo?.fileName || `${entry.name}.db`;
    const sqlite = await SQLite.openDatabaseAsync(dbName);
    //@ts-ignore
    const db = drizzleExpo(sqlite) as DrizzleDatabase;
    return {db, client: sqlite};
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
  async _deleteDatabase(entry: RegistryEntry): Promise<void> {
    const dbName = entry.connectionInfo?.fileName || `${entry.name}.db`;
    const SQLite = await import('expo-sqlite');
    await SQLite.deleteDatabaseAsync(dbName);
  }
}
