/**
 * Base Adapter Class
 *
 * Abstract base class that provides common implementations for all adapters.
 * Subclasses must implement abstract methods, and can use the concrete methods.
 */
import {and, count, eq, isNull, sql} from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import {
    DeleteQueryBuilder,
    DrizzleDatabase,
    DrizzleTable,
    InsertQueryBuilder,
    QueryResult,
    SelectQueryBuilder,
    UpdateQueryBuilder
} from "../../xp-deeby/adapters/abstract/types";
import {AdapterCapabilities, RegistryEntry, AdapterType} from "../../xp-deeby/adapters/abstract/capabilities";
import {Table} from "../../xp-deeby/adapters/abstract/builders";
import {DatabaseTable} from "./database-table";
import {XPDatabaseConnection} from "../xp-sql/connection";

export type DrizAndClient = {db: DrizzleDatabase, client: any};
export type CreateDB = (config: RegistryEntry) => Promise<DrizAndClient>;



export function isRecord(obj: unknown): obj is Record<string, any> {
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
        return false;
    }

    return Object.keys(obj).every(key => typeof key === "string");
}


export type ResolvedCondition = SQL | Record<string, any> | SQL[];
export type UnresolvedCondition = string | string[];
export type Condition = ResolvedCondition | UnresolvedCondition;

export type UpsertActionType = 'inserted' | 'updated' | 'unchanged';

export const UpsertAction = 'upsert-action';


/**
 * Abstract base class for all database adapters
 * Implements DrizzleDatabase interface by passthrough to this.db
 */
export abstract class Database extends XPDatabaseConnection {

    buildCondition(table: any, condition?: Condition, value?: Record<string, any>): SQL {
        if (!condition) {
            return sql`true`;
        }
        if (Array.isArray(condition)) {
            if (condition.length === 0) {
                return sql`true`;
            }else if (condition.length === 1){
                return this.buildCondition(table, condition, value);
            }else{
                return and(...condition.map((c: Condition) => this.buildCondition(table, c, value))) as SQL;
            }
        }
        if (typeof condition === "string"){
            if (!value){
                throw new Error("value must be specified when using string conditions")
            }
            condition = {[condition]: value[condition]}
        }
        if (isRecord(condition)) {
            const conditions = Object.entries(condition).map(([key, value]) => {
                const column = table[key];
                if (!column) {
                    throw new Error(`Column "${key}" not found in table`);
                }
                if (value === null || value === undefined) {
                    return isNull(column);
                }
                return eq(column, value);
            });
            if (conditions.length === 1) {
                return conditions[0];
            }
            if (conditions.length === 0) {
                return sql`true`;
            }
            return and(...conditions) as SQL;
        }else{
            throw new Error("Unknown condition");
        }
    }

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

    getSchema(tables: Record<string, Table>){
        return Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, this.getTable(v)]));
    }

    getTable(table: Table): DatabaseTable {
        return new DatabaseTable(this, table);
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
    selectWhere<T extends DrizzleTable>(table: T | any, condition?: ResolvedCondition, columns?: Record<string, any> | any[]): SelectQueryBuilder {
        const w = this.buildCondition(table, condition);
        return this.db.select(columns).from(table).where(w);
    }
    deleteWhere<T extends DrizzleTable>(table: T | any, condition?: ResolvedCondition): DeleteQueryBuilder<T> {
        const w = this.buildCondition(table, condition);
        return this.db.delete(table).where(w);
    }
    async countWhere<T extends DrizzleTable>(table: T | any, condition?: ResolvedCondition): Promise<number> {
        const w = this.buildCondition(table, condition);
        const r = await this.db.select({ count: count() }).from(table).where(w);
        return r[0].count as number;
    }
    updateWhere<T extends DrizzleTable>(table: T | any, condition: ResolvedCondition): UpdateQueryBuilder<T> {
        const w = this.buildCondition(table, condition);
        return this.db.update<T>(table).where(w);
    }

    upsertWhere<T extends DrizzleTable>(table: T | any, values: Record<string, any>[], condition: UnresolvedCondition): Promise<any>;
    upsertWhere<T extends DrizzleTable>(table: T | any, value: Record<string, any>, condition: Condition): Promise<any>;
    async upsertWhere<T extends DrizzleTable>(table: T | any, value: Record<string, any> | Record<string, any>[], condition: Condition): Promise<any> {
        if (Array.isArray(value)) {
            let p = Promise.all(value.map((v: Record<string, any>) => (this.upsertWhere(table, v, condition))));
            p.returning = (columns?: Record<string, any | UpsertActionType> | string | UpsertActionType) => Promise.all(p.then((q) => q.returning(columns).then((r: any)=> r[0])));
            return p;
        }

        const w = this.buildCondition(table, condition, value);



        return this.select().from(table).where(w).limit(2).then(
            (existing) => {
                let query: any;
                let action: UpsertActionType;

                if (existing.length === 2){
                    throw new Error("More than one existing record meets the specified condition");
                }else if (!existing.length){
                    query = this.insert(table).values(value);
                    action = 'inserted' as UpsertActionType;
                }else{
                    const hasChanges = Object.keys(value).some(k => value[k] !== existing[0][k]);
                    if (hasChanges){
                        query = this.update(table).set(value).where(w);
                        action = 'updated' as UpsertActionType;
                    }else{
                        query = new Promise((resolve, reject) => resolve(existing));
                        action = 'unchanged' as UpsertActionType;
                    }
                }


                query.returning = (columns?: Record<string, any | UpsertActionType> | string | UpsertActionType) => {
                    if (columns === UpsertAction) {
                        return query.then((_: any) => action) as Promise<UpsertActionType>;
                    }
                    else if (isRecord(columns) && Object.values(columns).some( v => v === UpsertAction)){
                        const nonUpsertColumns = Object.fromEntries(Object.entries(columns).filter(([k, v]) => v !== UpsertAction));
                        const uk = Object.keys(columns).find(k => columns[k] === UpsertAction)!;
                        if (action === 'unchanged'){
                            return query.then((existing: Record<string, any>[]) => existing.map(o => ({
                                    ...Object.fromEntries(nonUpsertColumns.map(([columnName, column]: [string, any]) => [columnName, existing[column.name]])),
                                    [uk]: action
                                })
                            ))
                        }else{
                            return query.returning(nonUpsertColumns).then((results: Record<string, any>[]) => results.map((o: Record<string, any>) => ({...o, [uk]: action})))
                        }
                    }else{
                        return query.returning(columns);
                    }
                }
                return query;
            }
        )
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




