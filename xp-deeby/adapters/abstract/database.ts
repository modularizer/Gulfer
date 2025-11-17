/**
 * Base Adapter Class
 *
 * Abstract base class that provides common implementations for all adapters.
 * Subclasses must implement abstract methods, and can use the concrete methods.
 */
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import {
    DeleteQueryBuilder,
    DrizzleDatabase,
    DrizzleTable,
    InsertQueryBuilder,
    QueryResult,
    SelectQueryBuilder,
    UpdateQueryBuilder
} from "./types";
import {AdapterCapabilities, RegistryEntry, AdapterType} from "./capabilities";

export type DrizAndClient = {db: DrizzleDatabase, client: any};
export type CreateDB = (config: RegistryEntry) => Promise<DrizAndClient>;



/**
 * Abstract base class for all database adapters
 * Implements DrizzleDatabase interface by passthrough to this.db
 */
export abstract class Database implements DrizzleDatabase {
    /**
     * The adapter type - set by constructor
     */
    protected readonly adapterType: AdapterType;
    // Cache database connections by connection identifier
    private connectionCache = new Map<string, { db: DrizzleDatabase; client: any }>();

    /**
     * Protected database instance - set by openFromRegistry
     */
    protected db!: DrizzleDatabase;

    constructor(adapterType: AdapterType) {
        this.adapterType = adapterType;
    }




    abstract makeRegistryEntry(name: string, ...args: any[]): Promise<RegistryEntry>;



    async openFromRegistry(entry: RegistryEntry): Promise<this> {
        if (entry.adapterType !== this.adapterType) {
            throw new Error(`${this.adapterType} cannot open ${entry.adapterType} database`);
        }

        const name = entry.name;

        // Return cached connection if available
        if (this.connectionCache.has(name)) {
            this.db = this.connectionCache.get(name)!.db;
            return this;
        }

        const {db, client} = await this._openFromRegistry(entry);

        // Cache the connection
        this.connectionCache.set(name, { db, client });
        this.db = db;

        return this;
    }

    /**
     * Open a database connection from a registry entry
     * Must be implemented by subclasses
     * Sets this.db and returns this adapter instance
     */
    abstract _openFromRegistry(entry: RegistryEntry): Promise<{db: DrizzleDatabase, client: any}>;

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
     * Passthrough DrizzleDatabase methods to this.db
     */
    execute(query: SQL): Promise<QueryResult> {
        return this.db.execute(query);
    }

    select(columns?: Record<string, any> | any[]): SelectQueryBuilder {
        return this.db.select(columns);
    }

    insert<T extends DrizzleTable>(table: T | any): InsertQueryBuilder<T> {
        return this.db.insert(table);
    }

    update<T extends DrizzleTable>(table: T | any): UpdateQueryBuilder<T> {
        return this.db.update(table);
    }

    delete<T extends DrizzleTable>(table: T | any): DeleteQueryBuilder<T> {
        return this.db.delete(table);
    }

    /**
     * Get adapter capabilities
     * Uses the adapterCapabilities record to look up capabilities by adapter type
     */
    abstract getCapabilities(): AdapterCapabilities;

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


    async closeConnection(name: string): Promise<void> {
        const cached = this.connectionCache.get(name);
        if (cached) {
            this._closeConnection(cached.client);
            this.connectionCache.delete(name);
        }
    }

    async _closeConnection(client: any): Promise<void>{

    };

    /**
     * Close all connections
     */
    async closeAllConnections(): Promise<void> {
        const names = Array.from(this.connectionCache.keys());
        await Promise.all(names.map(name => this.closeConnection(name)));
    }

    async deleteDatabase(entry: RegistryEntry): Promise<void> {
        this._deleteDatabase(entry);
        // Close the connection if it's cached
        await this.closeConnection(entry.name);
    }

    abstract _deleteDatabase(entry: RegistryEntry): Promise<void>;
}
