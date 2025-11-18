/**
 * PostgreSQL Remote Adapter
 * 
 * Connects to remote PostgreSQL databases over the internet.
 * Uses the 'postgres' package for connections.
 */

import {AdapterType} from '../types';
import {Database, DrizAndClient} from '../../../../xp/xp-sql-tools/database';
import { sql } from 'drizzle-orm';
import {AdapterCapabilities} from "../../abstract/capabilities";
import {adapterName, capabilities, PostgresConnectionConfig, RegistryEntry} from "./capabilities";


/**
 * PostgreSQL Remote Adapter Implementation
 */
export class PostgresAdapter extends Database {
    getCapabilities(): AdapterCapabilities {
        return capabilities;
    }

    constructor() {
        super(adapterName);
    }

  async makeRegistryEntry(name: string, config: PostgresConnectionConfig): Promise<RegistryEntry> {
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
  async _openFromRegistry(entry: RegistryEntry): Promise<DrizAndClient> {
    // Get connection config from registry entry
    const connectionInfo = entry.connectionInfo!;
    const config: PostgresConnectionConfig = {
      host: connectionInfo.host as string,
      port: connectionInfo.port as number,
      database: connectionInfo.database as string,
      user: connectionInfo.user as string,
      password: connectionInfo.password as string,
      ssl: connectionInfo.ssl as boolean | 'prefer' | undefined,
    };

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
      //@ts-ignore
    const db = drizzle(client) as DrizzleDatabase;

    // Cache the connection
    return { db, client }
  }

  /**
   * Close a database connection
   */
  async _closeConnection(client: any): Promise<void> {
    await client.end();
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
  async _deleteDatabase(entry: RegistryEntry): Promise<void> {
    // Close the connection if it's cached
  }
}
