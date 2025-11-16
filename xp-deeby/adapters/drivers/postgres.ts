/**
 * PostgreSQL Remote Adapter
 * 
 * Connects to remote PostgreSQL databases over the internet.
 * Uses the 'postgres' package for connections.
 */

import {AdapterType, RegistryEntry} from '../types';
import {Database, DrizzleDatabase} from '../database';
import { sql } from 'drizzle-orm';
import type { SchemaBuilder } from '../schema-builder';
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

/**
 * PostgreSQL Remote Adapter Implementation
 */
export class PostgresAdapter extends Database {
  // Cache database connections by connection identifier
  private connectionCache = new Map<string, { db: DrizzleDatabase; client: any }>();

  constructor() {
    super(AdapterType.POSTGRES);
  }

  /**
   * Get registry entry for a database
   */
  async getRegistryEntry(name: string, config: PostgresConnectionConfig): Promise<RegistryEntry> {
    return {
      name,
      adapterType: AdapterType.POSTGRES,
      connectionInfo: {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        ssl: config.ssl,
      }
    };
  }

  /**
   * Open a database connection from a registry entry
   * Sets this.db and returns this adapter instance
   */
  async openFromRegistry(entry: RegistryEntry): Promise<this> {
    if (entry.adapterType !== AdapterType.POSTGRES) {
      throw new Error(`PostgresAdapter cannot open ${entry.adapterType} database`);
    }

    const name = entry.name;
    
    // Return cached connection if available
    if (this.connectionCache.has(name)) {
      this.db = this.connectionCache.get(name)!.db;
      return this;
    }

    // Get connection config from registry entry
    const connectionInfo = entry.connectionInfo;
    if (!connectionInfo) {
      throw new Error(`No connection info found in registry entry for: ${name}`);
    }

    const config: PostgresConnectionConfig = {
      host: connectionInfo.host as string,
      port: connectionInfo.port as number,
      database: connectionInfo.database as string,
      user: connectionInfo.user as string,
      password: connectionInfo.password as string,
      ssl: connectionInfo.ssl as boolean | 'prefer' | undefined,
    };

    try {
      // Dynamically import postgres and drizzle to avoid loading on incompatible platforms
      const postgresModule = await import('postgres');
      const postgres = postgresModule.default;
      const { drizzle } = await import('drizzle-orm/postgres-js');
      
      // Create postgres client
      const connectionString = `postgresql://${encodeURIComponent(config.user)}:${encodeURIComponent(config.password)}@${config.host}:${config.port}/${encodeURIComponent(config.database)}`;
      
      const client = postgres(connectionString, {
        ssl: config.ssl === true ? 'require' : config.ssl === 'prefer' ? 'prefer' : false,
        max: 1, // Use a single connection for now
      });

      // Test the connection
      await client`SELECT 1`;

      // Create Drizzle database instance
      const db = drizzle(client);

      // Cache the connection
      this.connectionCache.set(name, { db, client });
      this.db = db;

      return this;
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'object' && error !== null
        ? JSON.stringify(error, Object.getOwnPropertyNames(error))
        : String(error);
      
      throw new Error(
        `Failed to connect to PostgreSQL database ${name}.\n` +
        `Error: ${errorMessage}`
      );
    }
  }

  /**
   * Close a database connection
   */
  async closeConnection(name: string): Promise<void> {
    const cached = this.connectionCache.get(name);
    if (cached) {
      await cached.client.end();
      this.connectionCache.delete(name);
    }
  }

  /**
   * Close all connections
   */
  async closeAllConnections(): Promise<void> {
    const names = Array.from(this.connectionCache.keys());
    await Promise.all(names.map(name => this.closeConnection(name)));
  }

  async getTableNames(): Promise<string[]> {
    try {
      const result = await this.db.execute(
        sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`
      ) as any[];

      return result.map((row: any) => row.table_name || row.table_name);
    } catch (error) {
      console.error('[postgres.getTableNames] Error getting table names:', error);
      return [];
    }
  }


  async getViewNames(): Promise<string[]> {
    try {
      const result = await this.db.execute(
        sql`SELECT table_name FROM information_schema.views WHERE table_schema = 'public' ORDER BY table_name`
      ) as any[];

      return result.map((row: any) => row.table_name || row.table_name);
    } catch (error) {
      console.error('[postgres.getViewNames] Error getting view names:', error);
      return [];
    }
  }

  async getMaterializedViewNames(): Promise<string[]> {
    try {
      const result = await this.db.execute(
        sql`SELECT matviewname FROM pg_matviews WHERE schemaname = 'public' ORDER BY matviewname`
      ) as any[];

      return result.map((row: any) => row.matviewname || row.matviewname);
    } catch (error) {
      console.error('[postgres.getMaterializedViewNames] Error getting materialized view names:', error);
      return [];
    }
  }

  async getTableColumns(tableName: string): Promise<Array<{
    name: string;
    dataType: string;
    isNullable: boolean;
  }>> {
    try {
      const result = await this.db.execute(
        sql`
          SELECT 
            column_name as name,
            data_type as "dataType",
            is_nullable = 'YES' as "isNullable"
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = ${tableName}
          ORDER BY ordinal_position
        `
      ) as any[];

      return result.map((row: any) => ({
        name: row.name || row.name,
        dataType: row.dataType || row.data_type || 'unknown',
        isNullable: row.isNullable !== undefined ? row.isNullable : row.is_nullable === 'YES',
      }));
    } catch (error) {
      console.error('[postgres.getTableColumns] Error getting table columns:', error);
      return [];
    }
  }

  /**
   * Delete a Postgres connection
   * Note: This doesn't delete the remote database, just closes and removes the connection
   */
  async deleteDatabase(entry: RegistryEntry): Promise<void> {
    // Close the connection if it's cached
    await this.closeConnection(entry.name);
    // Note: We don't delete the remote database itself, just the local connection
  }
}
