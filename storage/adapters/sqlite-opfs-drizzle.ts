/**
 * SQLite OPFS Drizzle Driver
 * 
 * Implements Drizzle ORM's SQLiteSession interface for SQLite WASM with OPFS.
 * This is the bridge between @sqlite.org/sqlite-wasm and Drizzle ORM.
 * 
 * This file handles:
 * - OpfsPreparedQuery (implements SQLitePreparedQuery)
 * - OpfsSession (implements SQLiteSession)
 * - OpfsTransaction (implements SQLiteTransaction)
 * 
 * The Adapter implementation (sqlite-opfs.ts) uses this driver.
 */

import { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core/db';
import { SQLitePreparedQuery, SQLiteSession } from 'drizzle-orm/sqlite-core/session';
import { SQLiteTransaction } from 'drizzle-orm/sqlite-core';
import { SQLiteAsyncDialect } from 'drizzle-orm/sqlite-core/dialect';
import { entityKind } from 'drizzle-orm/entity';
import { fillPlaceholders, sql } from 'drizzle-orm';
// mapResultRow is @internal, so we import from the internal path like sql-js adapter does
import { mapResultRow } from 'drizzle-orm/utils.js';
import type { 
  Query 
} from 'drizzle-orm';
import type { 
  SelectedFieldsOrdered 
} from 'drizzle-orm/sqlite-core/query-builders/select.types';
import type { 
  SQLiteExecuteMethod, 
  SQLiteTransactionConfig,
  PreparedQueryConfig 
} from 'drizzle-orm/sqlite-core/session';
import type { 
  RelationalSchemaConfig, 
  TablesRelationalConfig 
} from 'drizzle-orm/relations';
import type { Logger } from 'drizzle-orm/logger';
import { NoopLogger } from 'drizzle-orm/logger';

/**
 * OPFS Prepared Query
 * Implements Drizzle's SQLitePreparedQuery interface for OPFS
 */
class OpfsPreparedQuery<T extends PreparedQueryConfig = PreparedQueryConfig> 
  extends SQLitePreparedQuery<{
    type: 'async';
    run: { changes: number; lastInsertRowid: number };
    all: T['all'];
    get: T['get'];
    values: T['values'];
    execute: T['execute'];
  }> {
  static readonly [entityKind] = 'OpfsPreparedQuery';

  private promiser: any;
  private dbId: number;
  private logger: Logger;
  private fields: SelectedFieldsOrdered | undefined;
  private _isResponseInArrayMode: boolean;
  private customResultMapper?: (rows: unknown[][], mapColumnValue?: (value: unknown) => unknown) => unknown;

  constructor(
    promiser: any,
    dbId: number,
    query: Query,
    logger: Logger,
    fields: SelectedFieldsOrdered | undefined,
    executeMethod: SQLiteExecuteMethod,
    isResponseInArrayMode: boolean,
    customResultMapper?: (rows: unknown[][], mapColumnValue?: (value: unknown) => unknown) => unknown
  ) {
    super('async', executeMethod, query);
    this.promiser = promiser;
    this.dbId = dbId;
    this.logger = logger;
    this.fields = fields;
    this._isResponseInArrayMode = isResponseInArrayMode;
    this.customResultMapper = customResultMapper;
  }

  async run(placeholderValues?: Record<string, unknown>): Promise<{ changes: number; lastInsertRowid: number }> {
    const params = fillPlaceholders(this.query.params, placeholderValues ?? {});
    this.logger.logQuery(this.query.sql, params);

    const result = await this.promiser('exec', {
      dbId: this.dbId,
      sql: this.query.sql,
      bind: params.length > 0 ? params : undefined,
    });

    // OPFS automatically persists - no manual save needed!
    return {
      changes: result.changes || 0,
      lastInsertRowid: result.lastInsertRowid || 0,
    };
  }

  async all(placeholderValues?: Record<string, unknown>): Promise<T['all']> {
    const params = fillPlaceholders(this.query.params, placeholderValues ?? {});
    this.logger.logQuery(this.query.sql, params);

    const result = await this.promiser('exec', {
      dbId: this.dbId,
      sql: this.query.sql,
      bind: params.length > 0 ? params : undefined,
      returnValue: 'resultRows',
    });

    const rows = result.result || [];

    // Convert to array of arrays for processing
    const rowsArray: unknown[][] = Array.isArray(rows) 
      ? rows.map((row: any) => Array.isArray(row) ? row : Object.values(row))
      : [];

    if (this.customResultMapper) {
      return this.customResultMapper(rowsArray, normalizeFieldValue) as T['all'];
    }

    if (!this.fields) {
      // No fields mapping, return raw rows
      return rowsArray.map((row) => 
        row.reduce((obj: any, val: any, idx: number) => {
          obj[`column${idx}`] = normalizeFieldValue(val);
          return obj;
        }, {})
      ) as T['all'];
    }

    return rowsArray.map((row) => 
      mapResultRow(this.fields!, row.map((v) => normalizeFieldValue(v)), {})
    ) as T['all'];
  }

  async get(placeholderValues?: Record<string, unknown>): Promise<T['get']> {
    const params = fillPlaceholders(this.query.params, placeholderValues ?? {});
    this.logger.logQuery(this.query.sql, params);

    const result = await this.promiser('exec', {
      dbId: this.dbId,
      sql: this.query.sql,
      bind: params.length > 0 ? params : undefined,
      returnValue: 'resultRows',
    });

    const rows = result.result || [];
    if (!Array.isArray(rows) || rows.length === 0) {
      return undefined as T['get'];
    }

    const firstRow = Array.isArray(rows[0]) ? rows[0] : Object.values(rows[0]);

    if (this.customResultMapper) {
      return this.customResultMapper([firstRow], normalizeFieldValue) as T['get'];
    }

    if (!this.fields) {
      return firstRow.reduce((obj: any, val: any, idx: number) => {
        obj[`column${idx}`] = normalizeFieldValue(val);
        return obj;
      }, {}) as T['get'];
    }

    return mapResultRow(this.fields, firstRow.map((v) => normalizeFieldValue(v)), {}) as T['get'];
  }

  async values(placeholderValues?: Record<string, unknown>): Promise<T['values']> {
    const params = fillPlaceholders(this.query.params, placeholderValues ?? {});
    this.logger.logQuery(this.query.sql, params);

    const result = await this.promiser('exec', {
      dbId: this.dbId,
      sql: this.query.sql,
      bind: params.length > 0 ? params : undefined,
      returnValue: 'resultRows',
    });

    const rows = result.result || [];
    return (Array.isArray(rows) 
      ? rows.map((row: any) => Array.isArray(row) ? row : Object.values(row))
      : []) as T['values'];
  }

  /** @internal */
  isResponseInArrayMode(): boolean {
    return this._isResponseInArrayMode;
  }
}

/**
 * OPFS Session
 * Implements Drizzle's SQLiteSession interface for OPFS
 */
class OpfsSession<TFullSchema extends Record<string, unknown>, TSchema extends TablesRelationalConfig> 
  extends SQLiteSession<'async', { changes: number; lastInsertRowid: number }, TFullSchema, TSchema> {
  static readonly [entityKind] = 'OpfsSession';

  private promiser: any;
  private dbId: number;
  private schema: RelationalSchemaConfig<TSchema> | undefined;
  private logger: Logger;

  constructor(
    promiser: any,
    dbId: number,
    dialect: SQLiteAsyncDialect,
    schema: RelationalSchemaConfig<TSchema> | undefined,
    options?: { logger?: Logger }
  ) {
    super(dialect);
    this.promiser = promiser;
    this.dbId = dbId;
    this.schema = schema;
    this.logger = options?.logger ?? new NoopLogger();
  }

  prepareQuery<T extends Omit<PreparedQueryConfig, 'run'>>(
    query: Query,
    fields: SelectedFieldsOrdered | undefined,
    executeMethod: SQLiteExecuteMethod,
    isResponseInArrayMode: boolean,
    customResultMapper?: (rows: unknown[][], mapColumnValue?: (value: unknown) => unknown) => unknown,
    queryMetadata?: {
      type: 'select' | 'update' | 'delete' | 'insert';
      tables: string[];
    },
    cacheConfig?: any
  ): OpfsPreparedQuery<T> {
    return new OpfsPreparedQuery<T>(
      this.promiser,
      this.dbId,
      query,
      this.logger,
      fields,
      executeMethod,
      isResponseInArrayMode,
      customResultMapper
    );
  }

  async transaction<T>(
    transaction: (tx: OpfsTransaction<TFullSchema, TSchema>) => Promise<T>,
    config?: SQLiteTransactionConfig
  ): Promise<T> {
    const tx = new OpfsTransaction('async', this.dialect, this, this.schema);
    
    // Begin transaction
    await this.run(sql.raw(`begin${config?.behavior ? ` ${config.behavior}` : ''}`));
    
    try {
      const result = await transaction(tx);
      await this.run(sql`commit`);
      return result;
    } catch (err) {
      await this.run(sql`rollback`);
      throw err;
    }
  }
}

/**
 * OPFS Transaction
 * Implements Drizzle's SQLiteTransaction interface for OPFS
 */
class OpfsTransaction<TFullSchema extends Record<string, unknown>, TSchema extends TablesRelationalConfig> 
  extends SQLiteTransaction<'async', { changes: number; lastInsertRowid: number }, TFullSchema, TSchema> {
  static readonly [entityKind] = 'OpfsTransaction';

  async transaction<T>(
    transaction: (tx: OpfsTransaction<TFullSchema, TSchema>) => Promise<T>
  ): Promise<T> {
    const savepointName = `sp${this.nestedIndex + 1}`;
    const tx = new OpfsTransaction('async', this.dialect, this.session, this.schema, this.nestedIndex + 1);
    
    await tx.run(sql.raw(`savepoint ${savepointName}`));
    try {
      const result = await transaction(tx);
      await tx.run(sql.raw(`release savepoint ${savepointName}`));
      return result;
    } catch (err) {
      await tx.run(sql.raw(`rollback to savepoint ${savepointName}`));
      throw err;
    }
  }
}

/**
 * Normalize field values (convert Uint8Array to appropriate format)
 */
function normalizeFieldValue(value: unknown): unknown {
  if (value instanceof Uint8Array) {
    if (typeof Buffer !== 'undefined') {
      if (!(value instanceof Buffer)) {
        return Buffer.from(value);
      }
      return value;
    }
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder().decode(value);
    }
    throw new Error('TextDecoder is not available. Please provide either Buffer or TextDecoder polyfill.');
  }
  return value;
}

/**
 * Create a Drizzle database instance from an OPFS database
 * 
 * @param promiser - The SQLite WASM promiser instance
 * @param dbId - The database ID from OPFS
 * @param dialect - The SQLite async dialect
 * @param schema - Optional relational schema
 * @param options - Optional logger
 * @returns A Drizzle database instance
 */
export function createOpfsDrizzleDatabase(
  promiser: any,
  dbId: number,
  dialect: SQLiteAsyncDialect,
  schema?: RelationalSchemaConfig<any>,
  options?: { logger?: Logger }
): BaseSQLiteDatabase<'async', any, any, any> {
  // Create OPFS session
  const session = new OpfsSession(
    promiser,
    dbId,
    dialect,
    schema,
    options
  );

  // Create Drizzle database instance
  const db = new BaseSQLiteDatabase('async', dialect, session, schema);

  // Store OPFS-specific references for getTableNames
  (db as any)._opfsDbId = dbId;
  (db as any)._opfsPromiser = promiser;

  return db;
}

