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

/**
 * Table type - represents any Drizzle table
 */
export type DrizzleTable = {
    _: {
        name: string;
        schema: string | undefined;
        [key: string]: any;
    };
    [key: string]: any;
};

/**
 * Query result row type
 */
export type QueryResultRow = Record<string, unknown>;

/**
 * Query result type
 */
export type QueryResult<T = QueryResultRow> = T[];

/**
 * Select query builder - returned by db.select()
 */
export interface SelectQueryBuilder {
    /**
     * Specify the table to select from
     */
    from<T extends DrizzleTable>(table: T | any): SelectQueryBuilder;
    
    /**
     * Add a WHERE condition
     */
    where(condition: SQL | undefined): SelectQueryBuilder;
    
    /**
     * Add an INNER JOIN
     */
    innerJoin<T extends DrizzleTable>(table: T | any, condition: SQL): SelectQueryBuilder;
    
    /**
     * Add a LEFT JOIN
     */
    leftJoin<T extends DrizzleTable>(table: T | any, condition: SQL): SelectQueryBuilder;
    
    /**
     * Add a RIGHT JOIN
     */
    rightJoin<T extends DrizzleTable>(table: T | any, condition: SQL): SelectQueryBuilder;
    
    /**
     * Add a FULL JOIN
     */
    fullJoin<T extends DrizzleTable>(table: T | any, condition: SQL): SelectQueryBuilder;
    
    /**
     * Limit the number of results
     */
    limit(count: number): SelectQueryBuilder;
    
    /**
     * Skip a number of results (pagination)
     */
    offset(count: number): SelectQueryBuilder;
    
    /**
     * Order results by columns
     */
    orderBy(...columns: any[]): SelectQueryBuilder;
    
    /**
     * Group results by columns
     */
    groupBy(...columns: any[]): SelectQueryBuilder;
    
    /**
     * Add a HAVING condition (for use with GROUP BY)
     */
    having(condition: SQL): SelectQueryBuilder;
    
    /**
     * Execute the query (Promise interface)
     */
    then<TResult1 = QueryResult, TResult2 = never>(
        onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | undefined | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ): Promise<TResult1 | TResult2>;
}

/**
 * Insert query builder - returned by db.insert(table)
 */
export interface InsertQueryBuilder<T extends DrizzleTable> {
    /**
     * Set values to insert
     * @param values - Single record or array of records to insert
     */
    values(values: Record<string, any> | Record<string, any>[]): InsertQueryBuilder<T>;
    
    /**
     * Handle conflicts (upsert) - update on conflict
     * @param config - Conflict resolution configuration with target and set values
     */
    onConflictDoUpdate(config: {
        target: any | any[];
        set: Partial<Record<string, any>>;
    }): InsertQueryBuilder<T>;
    
    /**
     * Handle conflicts (upsert) - do nothing on conflict
     * @param target - Column(s) that define the conflict target
     */
    onConflictDoNothing(target?: any | any[]): InsertQueryBuilder<T>;
    
    /**
     * Return inserted rows
     */
    returning(): SelectQueryBuilder;
    
    /**
     * Execute the query (Promise interface)
     */
    then<TResult1 = void, TResult2 = never>(
        onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | undefined | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ): Promise<TResult1 | TResult2>;
}

/**
 * Update query builder - returned by db.update(table)
 */
export interface UpdateQueryBuilder<T extends DrizzleTable> {
    set(values: Partial<Record<string, any>>): UpdateQueryBuilder<T>;
    where(condition: SQL): UpdateQueryBuilder<T>;
    returning(): SelectQueryBuilder;
    then<TResult1 = void, TResult2 = never>(
        onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | undefined | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ): Promise<TResult1 | TResult2>;
}

/**
 * Delete query builder - returned by db.delete(table)
 */
export interface DeleteQueryBuilder<T extends DrizzleTable> {
    where(condition: SQL): DeleteQueryBuilder<T>;
    returning(): SelectQueryBuilder;
    then<TResult1 = void, TResult2 = never>(
        onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | undefined | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ): Promise<TResult1 | TResult2>;
}

/**
 * All Drizzle database objects implement the same interface
 * We use a type alias to represent any Drizzle database instance
 */
export type DrizzleDatabase = {
    /**
     * Execute a raw SQL query
     * @param query - SQL query object (created with sql template tag)
     * @returns Promise resolving to query results as an array of rows
     */
    execute(query: SQL): Promise<QueryResult>;
    
    /**
     * Start a SELECT query
     * @param columns - Optional columns to select (object with column references or array of columns)
     * @returns Select query builder
     * @example
     * ```ts
     * // Select all columns
     * const users = await db.select().from(usersTable).where(eq(usersTable.id, 1));
     * 
     * // Select specific columns
     * const users = await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable);
     * ```
     */
    select(columns?: Record<string, any> | any[]): SelectQueryBuilder;
    
    /**
     * Start an INSERT query
     * @param table - The table to insert into
     * @returns Insert query builder
     * @example
     * ```ts
     * await db.insert(usersTable).values({ name: 'John', email: 'john@example.com' });
     * ```
     */
    insert<T extends DrizzleTable>(table: T): InsertQueryBuilder<T>;
    
    /**
     * Start an UPDATE query
     * @param table - The table to update
     * @returns Update query builder
     * @example
     * ```ts
     * await db.update(usersTable).set({ name: 'Jane' }).where(eq(usersTable.id, 1));
     * ```
     */
    update<T extends DrizzleTable>(table: T): UpdateQueryBuilder<T>;
    
    /**
     * Start a DELETE query
     * @param table - The table to delete from
     * @returns Delete query builder
     * @example
     * ```ts
     * await db.delete(usersTable).where(eq(usersTable.id, 1));
     * ```
     */
    delete<T extends DrizzleTable>(table: T): DeleteQueryBuilder<T>;
};

/**
 * Abstract base class for all database adapters
 * Implements DrizzleDatabase interface by passthrough to this.db
 */
export abstract class Database implements DrizzleDatabase {
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

    static async getAdapter(type?: AdapterType): Promise<Database> {
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
