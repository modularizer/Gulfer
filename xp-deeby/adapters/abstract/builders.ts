/**
 * Schema Builder Interface
 *
 * Defines the interface for dialect-specific schema builders.
 * Each driver implements this interface to provide schema functions
 * that work with its specific database dialect.
 *
 * Uses generic structural types that match Drizzle's builder pattern
 * without importing any platform-specific Drizzle modules.
 */

/**
 * Generic column builder type - matches Drizzle's column builder pattern
 * Columns are chainable builders with methods like .notNull(), .default(), etc.
 */


import {ColumnBuilder} from "drizzle-orm";

/**
 * Generic table type - matches Drizzle's table structure
 * Drizzle tables have inference types and various properties
 */
export interface Table {
    /**
     * Infer the select type from this table
     * Usage: type User = typeof users.$inferSelect;
     */
    $inferSelect: any;

    /**
     * Infer the insert type from this table
     * Usage: type UserInsert = typeof users.$inferInsert;
     */
    $inferInsert: any;

    /**
     * Additional properties and methods
     * Drizzle tables have internal symbols and other properties
     */
    [key: string]: any;


}

/**
 * Generic constraint types
 */
export interface UniqueConstraint {
    name?: string;
    [key: string]: any;
}

export interface IndexConstraint {}

/**
 * Table-level constraints and indexes
 */
export interface TableConstraints {
    unique?: UniqueConstraint | UniqueConstraint[];
    index?: IndexConstraint | IndexConstraint[];
    [key: string]: any;
}

/**
 * Column config that can be passed to column builders
 * Matches Drizzle's column configuration options
 */
export interface ColumnConfig {
    /** Mode for type conversion (e.g., 'json', 'boolean', 'timestamp') */
    mode?: 'json' | 'boolean' | 'timestamp' | 'number' | 'string';
    /** Maximum length for varchar/text columns */
    length?: number;
    /** Enum values for constrained columns */
    enum?: string[];
    /** Additional dialect-specific options */
    [key: string]: any;
}

/**
 * Column builder function types
 * These match Drizzle's column builder functions which return chainable column builders
 *
 * Usage examples:
 * - text('name')
 * - text('data', { mode: 'json' })
 * - varchar('email', { length: 255 })
 * - integer('age')
 * - integer('isActive', { mode: 'boolean' })
 */
export type TextBuilder = (name: string, config?: ColumnConfig) => ColumnBuilder;
export type VarcharBuilder = (name: string, config?: ColumnConfig) => ColumnBuilder;
export type IntegerBuilder = (name: string, config?: ColumnConfig) => ColumnBuilder;
export type RealBuilder = (name: string, config?: ColumnConfig) => ColumnBuilder;
export type NumericBuilder = (name: string, config?: ColumnConfig) => ColumnBuilder;
export type TimestampBuilder = (name: string, config?: ColumnConfig) => ColumnBuilder;
export type JsonBuilder = (name: string, config?: ColumnConfig) => ColumnBuilder;
export type JsonbBuilder = (name: string, config?: ColumnConfig) => ColumnBuilder;
export type BoolBuilder = (name: string, config?: ColumnConfig) => ColumnBuilder;
export type UuidBuilder = (name: string, ...args: any[]) => ColumnBuilder;
export type UuidDefaultBuilder = (name: string, ...args: any[]) => ColumnBuilder;
export type UuidPKBuilder = (name: string, ...args: any[]) => ColumnBuilder;

/**
 * Table builder function type
 * Matches Drizzle's table function signature: (name, columns, constraints?) => Table
 */
export type TableBuilder = (
    name: string,
    columns: Record<string, ColumnBuilder>,
    constraints?: TableConstraints
) => Table;

/**
 * Constraint builder function types
 */
export type UniqueBuilder = (...args: any[]) => UniqueConstraint;
export type IndexBuilder = (name: string) => IndexConstraint;

/**
 * Schema Builder Interface
 *
 * All drivers must export a schema object that implements this interface.
 * This allows schemas to be written once and work with any dialect.
 */
export interface SchemaBuilder {
    /**
     * Create a table
     */
    table: TableBuilder;

    /**
     * Text column
     */
    text: TextBuilder;

    /**
     * Varchar column
     */
    varchar: VarcharBuilder;

    /**
     * Integer column
     */
    integer: IntegerBuilder;

    /**
     * Real (floating point) column
     */
    real: RealBuilder;

    /**
     * Timestamp column
     * In PostgreSQL: TIMESTAMP
     * In SQLite: INTEGER with mode: 'timestamp'
     */
    timestamp: TimestampBuilder;

    /**
     * JSONB column
     * In PostgreSQL: JSONB
     * In SQLite: TEXT with mode: 'json'
     */
    jsonb: JsonbBuilder;

    /**
     * Boolean column
     * In PostgreSQL: BOOLEAN
     * In SQLite: INTEGER with mode: 'boolean'
     */
    bool: BoolBuilder;

    /**
     * UUID column (convenience wrapper)
     * In PostgreSQL: VARCHAR
     * In SQLite: TEXT
     */
    uuid: UuidBuilder;

    /**
     * UUID column with default (convenience wrapper)
     */
    uuidDefault: UuidDefaultBuilder;

    /**
     * UUID primary key (convenience wrapper)
     */
    uuidPK: UuidPKBuilder;

    /**
     * Unique constraint
     */
    unique: UniqueBuilder;

    /**
     * Index constraint
     */
    index: IndexBuilder;
}

