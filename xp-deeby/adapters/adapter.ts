/**
 * Base Adapter Class
 *
 * Abstract base class that provides common implementations for all adapters.
 * Subclasses must implement abstract methods, and can use the concrete methods.
 */

import {AdapterType, RegistryEntry, AdapterCapabilities, adapterCapabilities} from './types';
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import {getAdapter} from "./factory";

// All Drizzle database objects implement the same interface
// We use a type alias to represent any Drizzle database instance
export type DrizzleDatabase = {
    execute(query: SQL): Promise<any>;
    select(): any;
    insert(table: any): any;
    update(table: any): any;
    delete(table: any): any;
};

/**
 * Abstract base class for all database adapters
 */
export abstract class Adapter {
    /**
     * The adapter type - set by constructor
     */
    protected readonly adapterType: AdapterType;

    /**
     * Protected database instance - set by openFromRegistry
     */
    protected db!: DrizzleDatabase;

    constructor(adapterType: AdapterType) {
        this.adapterType = adapterType;
    }

    static async getAdapter(type?: AdapterType): Promise<Adapter> {
        return await getAdapter(type);
    }


    /**
     * Get registry entry for a database
     * Must be implemented by subclasses
     */
    abstract getRegistryEntry(name: string, ...args: any[]): Promise<RegistryEntry>;



    /**
     * Open a database connection from a registry entry
     * Must be implemented by subclasses
     * Sets this.db and returns this adapter instance
     */
    abstract openFromRegistry(entry: RegistryEntry): Promise<this>;

    /**
     * Get all table names in the database
     * Must be implemented by subclasses
     */
    abstract getTableNames(): Promise<string[]>;

    /**
     * Get the current database instance
     * Returns the database that was opened via openFromRegistry
     */
    getDatabase(): DrizzleDatabase {
        return this.db;
    }

    /**
     * Get adapter capabilities
     * Uses the adapterCapabilities record to look up capabilities by adapter type
     */
    getCapabilities(): AdapterCapabilities {
        return adapterCapabilities[this.adapterType];
    }

    /**
     * Get row count for a specific table
     * Concrete implementation that works with any adapter
     * Uses Drizzle's sql template tag for dynamic table names
     */
    async getRowCount(tableName: string): Promise<number> {
        try {
            // Use Drizzle's sql template tag for dynamic table names
            const result = await this.db.execute(
                sql`SELECT COUNT(*) as count FROM ${sql.identifier(tableName)}`
            ) as any[];
            
            const rowCount = result[0]?.count;
            if (typeof rowCount === 'number') {
                return rowCount;
            } else if (rowCount !== null && rowCount !== undefined) {
                return parseInt(String(rowCount), 10) || 0;
            }
            return 0;
        } catch (err) {
            // Table might not exist or be accessible
            console.warn(`Could not count rows in table ${tableName}:`, err);
            return 0;
        }
    }

    /**
     * Get metadata for a database (table count, total row count, and row counts per table)
     * Concrete implementation that works with any adapter
     */
    async getMetadata(): Promise<{
        tableCount: number;
        totalRowCount: number;
        tableRowCounts: Record<string, number>;
    }> {
        // Get table names
        const tableNames = await this.getTableNames();

        if (tableNames.length === 0) {
            return { tableCount: 0, totalRowCount: 0, tableRowCounts: {} };
        }

        // Count rows in each table
        let totalRowCount = 0;
        const tableRowCounts: Record<string, number> = {};

        for (const tableName of tableNames) {
            const count = await this.getRowCount(tableName);
            tableRowCounts[tableName] = count;
            totalRowCount += count;
        }

        return {
            tableCount: tableNames.length,
            totalRowCount,
            tableRowCounts,
        };
    }

    /**
     * Delete a database by name
     * Optional - not all adapters may support deletion
     */
    deleteDatabase?(entry: RegistryEntry): Promise<void>;

    /**
     * Get all view names in the database
     * Optional - only available if the database supports views
     */
    getViewNames?(): Promise<string[]>;

    /**
     * Get all materialized view names in the database
     * Optional - only available if the database supports materialized views (e.g., PostgreSQL)
     */
    getMaterializedViewNames?(): Promise<string[]>;

    /**
     * Get column information for a table
     * Optional - returns column names and data types in a dialect-agnostic format
     */
    getTableColumns?(tableName: string): Promise<Array<{
        name: string;
        dataType: string;
        isNullable: boolean;
    }>>;
}
