/**
 * Unbound Dialect Implementation
 * 
 * Implements SQLDialect interface but returns unbound columns and tables
 * that can be bound to any dialect when used with a database.
 */

import type {ColumnBuilder, Table} from 'drizzle-orm';
import {sql} from 'drizzle-orm';
import {
    DialectBuilders,
    DialectColumnBuilders,
    SQLDialect,
    NumericConfig,
    VarcharConfig,
    TextOptions,
    IntegerOptions,
    RealOptions,
    TimestampOptions,
    DateOptions,
    TimeOptions,
    BlobOptions,
    BigintOptions,
    SmallintOptions,
    BooleanOptions,
    JsonOptions,
    notImplementedForDialect, DrizzleColumnInfo,
} from "../types";
import {DrizzleDatabaseConnectionDriver} from "../../drivers/types";
import {errors} from "@ts-morph/common";
import NotImplementedError = errors.NotImplementedError;

// ============================================================================
// Unbound Column
// ============================================================================

/**
 * Unbound column definition
 * Stores the column type and options, but not yet bound to a dialect
 */
export interface UnboundColumnData {
  readonly __unbound: true;
  readonly type: string;
  readonly name: string;
  readonly options?: any;
  readonly modifiers: Array<{ method: string; args: any[] }>;
}

/**
 * Chainable unbound column builder
 * Mimics Drizzle's ColumnBuilder API but stores modifiers instead of applying them
 */
export class UnboundColumnBuilder {
  private data: UnboundColumnData;

  constructor(type: string, name: string, options?: any) {
    this.data = {
      __unbound: true,
      type,
      name,
      options,
      modifiers: [],
    };
  }

  /**
   * Get the underlying data
   */
  getData(): UnboundColumnData {
    return this.data;
  }

  /**
   * Add .notNull() modifier
   */
  notNull(): this {
    this.data = {
      ...this.data,
      modifiers: [...this.data.modifiers, { method: 'notNull', args: [] }],
    };
    return this;
  }

  /**
   * Add .primaryKey() modifier
   */
  primaryKey(): this {
    this.data = {
      ...this.data,
      modifiers: [...this.data.modifiers, { method: 'primaryKey', args: [] }],
    };
    return this;
  }

  /**
   * Add .default() modifier
   */
  default(value: any): this {
    this.data = {
      ...this.data,
      modifiers: [...this.data.modifiers, { method: 'default', args: [value] }],
    };
    return this;
  }

  /**
   * Add .$type() modifier (for TypeScript type inference)
   * Usage: text('data').$type<MyType>()
   */
  $type<T>(): this {
    // $type doesn't take arguments in Drizzle, it's just for TypeScript
    // We'll store a marker to indicate type inference is desired
    this.data = {
      ...this.data,
      modifiers: [...this.data.modifiers, { method: '$type', args: [] }],
    };
    return this;
  }

  /**
   * Add .references() modifier for foreign key constraints
   * Usage: text('user_id').references(() => usersTable.id)
   */
  references(refFn: () => any): this {
    this.data = {
      ...this.data,
      modifiers: [...this.data.modifiers, { method: 'references', args: [refFn] }],
    };
    return this;
  }

  /**
   * Add .defaultNow() modifier (for timestamp columns)
   * Usage: timestamp('created_at').defaultNow()
   */
  defaultNow(): this {
    this.data = {
      ...this.data,
      modifiers: [...this.data.modifiers, { method: 'defaultNow', args: [] }],
    };
    return this;
  }

  /**
   * Bind this column to a dialect
   * Returns a Drizzle ColumnBuilder
   */
  bind(dialect: SQLDialect): ColumnBuilder {
    return bindColumn(this.data, dialect);
  }

  /**
   * Support any other method that might be called
   */
  [key: string]: any;
}

/**
 * Check if a column is already bound (is a ColumnBuilder, not UnboundColumnData)
 */
function isBoundColumn(column: any): column is ColumnBuilder {
  // If it has __unbound, it's unbound
  if (column && typeof column === 'object' && column.__unbound === true) {
    return false;
  }
  // If it's a ColumnBuilder, it should have certain properties
  // Drizzle ColumnBuilders have _ property and config
  return column && typeof column === 'object' && ('_' in column || 'config' in column);
}

/**
 * Try to infer the dialect from a bound column
 * Returns dialect name or null if cannot determine
 */
function getDialectFromBoundColumn(column: ColumnBuilder): string | null {
  const col = column as any;
  
  // Check the column's constructor name or prototype chain
  const constructorName = col.constructor?.name || '';
  
  // Drizzle column builders have dialect-specific class names
  // PostgreSQL: PgColumnBuilder, PgText, PgInteger, etc.
  // SQLite: SQLiteColumnBuilder, SQLiteText, SQLiteInteger, etc.
  if (constructorName.includes('Pg') || constructorName.includes('pg')) {
    return 'pg';
  }
  if (constructorName.includes('SQLite') || constructorName.includes('sqlite')) {
    return 'sqlite';
  }
  
  // Check internal config structure
  if (col._) {
    // Try to infer from internal structure
    // This is a fallback heuristic
  }
  
  // If we still can't determine, return null
  // The caller will handle this case
  return null;
}

/**
 * Bind an unbound column to a dialect
 * Also accepts already bound columns - if dialect matches, returns as-is
 */
export function bindColumn(
  column: UnboundColumnData | ColumnBuilder,
  dialect: SQLDialect
): ColumnBuilder {
  // Check if already bound
  if (isBoundColumn(column)) {
    // Try to determine the dialect
    const existingDialect = getDialectFromBoundColumn(column);
    
    // If we can determine the dialect and it matches, return as-is
    if (existingDialect && existingDialect === dialect.dialectName) {
      return column;
    }
    
    // If we can determine the dialect and it doesn't match, throw error
    if (existingDialect && existingDialect !== dialect.dialectName) {
      throw new Error(
        `Column is already bound to dialect "${existingDialect}", but requested dialect is "${dialect.dialectName}"`
      );
    }
    
    // If we can't determine the dialect, we can't verify compatibility
    // In this case, we'll return the column but log a warning
    // The user should ensure they're using the correct dialect
    console.warn(
      `Cannot determine dialect of bound column. Assuming it matches requested dialect "${dialect.dialectName}". ` +
      `If you encounter errors, ensure the column is bound to the correct dialect.`
    );
    return column;
  }

  // Not bound - proceed with binding
  const unboundColumn = column as UnboundColumnData;
  
  // Get the column builder function from dialect
  const builderFn = (dialect as any)[unboundColumn.type];
  if (!builderFn || typeof builderFn !== 'function') {
    throw new Error(`Column type "${unboundColumn.type}" not found in dialect "${dialect.dialectName}"`);
  }

  // Create the column builder
  let builder = builderFn(unboundColumn.name, unboundColumn.options);

  // Apply modifiers (e.g., .notNull(), .primaryKey())
  for (const modifier of unboundColumn.modifiers) {
    if (modifier.method === 'primaryKey') {
      builder = builder.primaryKey();
    } else if (modifier.method === 'notNull') {
      builder = builder.notNull();
    } else if (modifier.method === 'default' && typeof builder.default === 'function') {
      builder = builder.default(...modifier.args);
    } else if (modifier.method === 'defaultNow') {
      // defaultNow() is equivalent to default(sql`CURRENT_TIMESTAMP`)
      // We'll use the default() method with a SQL function
      if (typeof builder.default === 'function') {
        builder = builder.default(sql`CURRENT_TIMESTAMP`);
      } else {
        console.warn(`defaultNow() not available on column builder, skipping`);
      }
    } else if (modifier.method === 'references' && typeof builder.references === 'function') {
      builder = builder.references(...modifier.args);
    } else if (modifier.method === '$type' && typeof builder.$type === 'function') {
      // $type is a TypeScript-only method, but we still need to call it
      // It takes no runtime arguments
      builder = builder.$type();
    } else if (typeof builder[modifier.method] === 'function') {
      builder = builder[modifier.method](...modifier.args);
    } else {
      console.warn(`Modifier "${modifier.method}" not available on column builder, skipping`);
    }
  }

  return builder;
}

// ============================================================================
// Unbound Table
// ============================================================================

/**
 * Unbound table definition
 * Stores table name and column definitions, but not yet bound to a dialect
 */
export interface UnboundTable {
  readonly __unbound: true;
  readonly name: string;
  readonly columns: Record<string, UnboundColumnData>;
  readonly constraints?: (table: Table) => any[];
}

/**
 * Create an unbound table
 */
export function unboundTable(
  name: string,
  columns: Record<string, UnboundColumnBuilder | UnboundColumnData | ColumnBuilder>,
  constraints?: (table: Table) => any[]
): UnboundTable {
  // Convert UnboundColumnBuilder instances to data
  const columnData: Record<string, UnboundColumnData> = {};
  for (const [key, column] of Object.entries(columns)) {
    // Check if it's a bound column - if so, throw error
    if (isBoundColumn(column)) {
      throw new Error(
        `Cannot create unbound table "${name}" with bound column "${key}". ` +
        `Unbound tables can only contain unbound columns. ` +
        `If you need to use bound columns, create the table directly with the dialect's table builder.`
      );
    }
    
    if (column instanceof UnboundColumnBuilder) {
      columnData[key] = column.getData();
    } else {
      // Must be UnboundColumnData at this point
      columnData[key] = column as UnboundColumnData;
    }
  }

  return {
    __unbound: true,
    name,
    columns: columnData,
    constraints,
  };
}

/**
 * Try to infer the dialect from a bound table
 * Returns dialect name or null if cannot determine
 */
function getDialectFromBoundTable(table: Table): string | null {
  const tbl = table as any;
  
  // Check the table's constructor name or prototype chain
  const constructorName = tbl.constructor?.name || '';
  
  // Drizzle tables have dialect-specific class names
  // PostgreSQL: PgTable, PgTableExtraConfig, etc.
  // SQLite: SQLiteTable, SQLiteTableExtraConfig, etc.
  if (constructorName.includes('Pg') || constructorName.includes('pg')) {
    return 'pg';
  }
  if (constructorName.includes('SQLite') || constructorName.includes('sqlite')) {
    return 'sqlite';
  }
  
  // Check internal structure for dialect hints
  if (tbl._) {
    // Try to check internal properties
    // PostgreSQL tables might have schema info
    if (tbl._.schema !== undefined) {
      return 'pg';
    }
  }
  
  // Try to infer from the table's columns if available
  // Check a sample column to see if we can determine dialect
  if (tbl[Symbol.for('drizzle:Columns')] || tbl._?.columns) {
    const columns = tbl[Symbol.for('drizzle:Columns')] || tbl._?.columns;
    if (columns && typeof columns === 'object') {
      // Get first column and check its dialect
      const firstColumnKey = Object.keys(columns)[0];
      if (firstColumnKey) {
        const firstColumn = columns[firstColumnKey];
        const columnDialect = getDialectFromBoundColumn(firstColumn);
        if (columnDialect) {
          return columnDialect;
        }
      }
    }
  }
  
  // If we still can't determine, return null
  return null;
}

/**
 * Bind an unbound table to a dialect
 * Also accepts already bound tables - if dialect matches, returns as-is
 */
export function bindTable(
  table: UnboundTable | Table,
  dialect: SQLDialect
): Table {
  // Check if already bound
  if (!isUnboundTable(table)) {
    const boundTable = table as Table;
    
    // Try to determine the dialect
    const existingDialect = getDialectFromBoundTable(boundTable);
    
    // If we can determine the dialect and it matches, return as-is
    if (existingDialect && existingDialect === dialect.dialectName) {
      return boundTable;
    }
    
    // If we can determine the dialect and it doesn't match, throw error
    if (existingDialect && existingDialect !== dialect.dialectName) {
      throw new Error(
        `Table is already bound to dialect "${existingDialect}", but requested dialect is "${dialect.dialectName}"`
      );
    }
    
    // If we can't determine the dialect, we can't verify compatibility
    // In this case, we'll return the table but log a warning
    // The user should ensure they're using the correct dialect
    console.warn(
      `Cannot determine dialect of bound table. Assuming it matches requested dialect "${dialect.dialectName}". ` +
      `If you encounter errors, ensure the table is bound to the correct dialect.`
    );
    return boundTable;
  }

  // Not bound - proceed with binding
  const unboundTable = table as UnboundTable;
  
  // Bind all columns
  const boundColumns: Record<string, ColumnBuilder> = {};
  for (const [key, column] of Object.entries(unboundTable.columns)) {
    boundColumns[key] = bindColumn(column, dialect);
  }

  // Create the table using the dialect's table builder
  const tableBuilder = dialect.table;
  return tableBuilder(unboundTable.name, boundColumns, unboundTable.constraints);
}

/**
 * Check if a value is an unbound table
 */
export function isUnboundTable(value: any): value is UnboundTable {
  return value && typeof value === 'object' && value.__unbound === true && value.name !== undefined;
}




// ============================================================================
// Unbound Dialect Implementation
// ============================================================================

const unboundColumnBuilders: DialectColumnBuilders = {
    text: (name: string, opts?: TextOptions) => new UnboundColumnBuilder('text', name, opts) as any,
    varchar: (name: string, opts?: VarcharConfig) => new UnboundColumnBuilder('varchar', name, opts) as any,
    json: (name: string, opts?: JsonOptions) => new UnboundColumnBuilder('json', name, opts) as any,
    jsonb: (name: string, opts?: JsonOptions) => new UnboundColumnBuilder('jsonb', name, opts) as any,
    integer: (name: string, opts?: IntegerOptions) => new UnboundColumnBuilder('integer', name, opts) as any,
    real: (name: string, opts?: RealOptions) => new UnboundColumnBuilder('real', name, opts) as any,
    doublePrecision: (name: string, opts?: RealOptions) => new UnboundColumnBuilder('doublePrecision', name, opts) as any,
    bigint: (name: string, opts?: BigintOptions) => new UnboundColumnBuilder('bigint', name, opts) as any,
    smallint: (name: string, opts?: SmallintOptions) => new UnboundColumnBuilder('smallint', name, opts) as any,
    pkserial: (name: string) => new UnboundColumnBuilder('pkserial', name) as any,
    blob: (name: string, opts?: BlobOptions) => new UnboundColumnBuilder('blob', name, opts) as any,
    numeric: (name: string, opts?: NumericConfig) => new UnboundColumnBuilder('numeric', name, opts) as any,
    bool: (name: string, opts?: BooleanOptions) => new UnboundColumnBuilder('bool', name, opts) as any,
    boolean: (name: string, opts?: BooleanOptions) => new UnboundColumnBuilder('boolean', name, opts) as any,
    date: (name: string, opts?: DateOptions) => new UnboundColumnBuilder('date', name, opts) as any,
    time: (name: string, opts?: TimeOptions) => new UnboundColumnBuilder('time', name, opts) as any,
    timestamp: (name: string, opts?: TimestampOptions) => new UnboundColumnBuilder('timestamp', name, opts) as any,
};


const unboundBuilders: DialectBuilders = {
    table: unboundTable as any,
    ...unboundColumnBuilders,
    unique: notImplementedForDialect("unique constraint", "unbound"),
    index: notImplementedForDialect("index", "unbound"),
    check: notImplementedForDialect("check constraint", "unbound"),
};

const dialectName = "unbound";
const unboundDialect: SQLDialect = {
    dialectName,
    ...unboundBuilders,

    getTableNames: async (db: DrizzleDatabaseConnectionDriver, schemaName: string = 'public'): Promise<string[]> => {
        throw new NotImplementedError("getTableNames not implemented for unbound dialect");
    },

    getSchemaNames: async (
        db: DrizzleDatabaseConnectionDriver,
        options?: { excludeBuiltins?: boolean }
    ): Promise<string[]> => {
        throw new NotImplementedError("getSchemaNames not implemented for unbound dialect");
    },

    getTableColumns: async (
        db: DrizzleDatabaseConnectionDriver,
        tableName: string,
        schemaName: string = 'public'
    ): Promise<DrizzleColumnInfo[]> => {
        throw new NotImplementedError("getTableColumns not implemented for unbound dialect");
    },
    getRuntimeTable: async (
        db: DrizzleDatabaseConnectionDriver,
        tableName: string,
        schemaName?: string,
    ): Promise<Table> => {
    throw new NotImplementedError("getRuntimeTable not implemented for unbound dialect");
    }
};


// Export the dialect and all builders
export default unboundDialect;

// Export all column builders
export const text = unboundColumnBuilders.text;
export const varchar = unboundColumnBuilders.varchar;
export const json = unboundColumnBuilders.json;
export const jsonb = unboundColumnBuilders.jsonb;
export const integer = unboundColumnBuilders.integer;
export const real = unboundColumnBuilders.real;
export const doublePrecision = unboundColumnBuilders.doublePrecision;
export const bigint = unboundColumnBuilders.bigint;
export const smallint = unboundColumnBuilders.smallint;
export const pkserial = unboundColumnBuilders.pkserial;
export const blob = unboundColumnBuilders.blob;
export const numeric = unboundColumnBuilders.numeric;
export const bool = unboundColumnBuilders.bool;
export const boolean = unboundColumnBuilders.boolean;
export const timestamp = unboundColumnBuilders.timestamp;
export const time = unboundColumnBuilders.time;
export const date = unboundColumnBuilders.date;

// Export table builder
export const table = unboundTable;

// Export constraint builders (not implemented for unbound, but exported for API consistency)
// Note: These will throw errors if used - they're exported for type compatibility
export const unique = unboundBuilders.unique;
export const index = unboundBuilders.index;
export const check = unboundBuilders.check;
