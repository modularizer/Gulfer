import {SQL} from "drizzle-orm";

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