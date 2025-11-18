import {errors} from "@ts-morph/common";
import NotImplementedError = errors.NotImplementedError;
import {DrizzleDatabaseConnectionDriver} from "../drivers/types";
import type {ColumnBuilder, Table, Column} from "drizzle-orm";


export interface ColumnLevelEntity {}
export interface Column extends ColumnLevelEntity {}
export interface Index extends ColumnLevelEntity {}
export interface Constraint extends ColumnLevelEntity {}

/**
 * ColumnBuilder with .references() method added
 */
export type ColumnBuilderWithReferences = ColumnBuilder & {
    /**
     * Add a foreign key reference to another column
     * @param refFn Function that returns the column to reference
     */
    references(refFn: () => Column): ColumnBuilderWithReferences;
};

/**
 * Timestamp ColumnBuilder with .defaultNow() method added
 */
export type TimestampColumnBuilderWithDefaultNow = ColumnBuilderWithReferences & {
    /**
     * Set the default value to the current timestamp
     */
    defaultNow(): TimestampColumnBuilderWithDefaultNow;
};

export type Columns = Record<string, ColumnBuilder>;



export type ColumnOpts<T extends Record<string, any> = Record<string, any>> = T | undefined;
export type IndexOpts<T extends Record<string, any> = Record<string, any>> = T | undefined;
export type ConstraintOpts<T extends Record<string, any> = Record<string, any>> = T | undefined;

export const notImplemented = (msg: string = "Not Implemented") => {
    return () => {
        throw new NotImplementedError(msg)
    }
}
export const notImplementedForDialect = (feature: string = "Feature", dialect: string) => {
    return notImplemented(`${feature} has not been implemented for dialect "${dialect}"`)
}
export type TableBuilderFn<T extends Columns = Columns> = (name: string, columns: T, constraintBuilder?: (table: Table) => (Constraint | Index)[]) => Table;
export type ColumnBuilderFn<T extends ColumnOpts = ColumnOpts> = (name: string, opts?: T) => ColumnBuilderWithReferences;
export type TimestampColumnBuilderFn<T extends ColumnOpts = ColumnOpts> = (name: string, opts?: T) => TimestampColumnBuilderWithDefaultNow;
export type IndexBuilderFn<T extends IndexOpts = IndexOpts> = (name: string, opts: T) => Index;
export type UniqueConstraintBuilderFn<T extends ConstraintOpts = ConstraintOpts> = (name: string, opts: T) => Constraint;
export type CheckConstraintBuilderFn<T extends ConstraintOpts = ConstraintOpts> = (name: string, opts: T) => Constraint;





// ============================================================================
// Column Option Types
// ============================================================================

/**
 * Common column options used across multiple column types
 */
export interface BaseColumnOptions {
    /** Mode for type conversion (e.g., 'json', 'boolean', 'timestamp', 'number', 'string') */
    mode?: 'buffer' | 'bigint' | 'date' | 'time' | 'json' | 'boolean' | 'timestamp' | 'number' | 'string';
}

/**
 * Text column options
 */
export interface TextOptions extends BaseColumnOptions {
}

/**
 * Varchar column options
 */
export interface VarcharConfig<TEnum extends readonly string[] | string[] | undefined = readonly string[] | string[] | undefined, TLength extends number | undefined = number | undefined> {
    enum?: TEnum;
    length?: TLength;
}

/**
 * Integer column options
 */
export interface IntegerOptions extends BaseColumnOptions {
    mode: 'boolean' | 'timestamp' | 'number';
}

/**
 * Real (floating point) column options
 */
export interface RealOptions extends BaseColumnOptions {
}

/**
 * Timestamp column options
 */
export interface TimestampOptions extends BaseColumnOptions {
    mode: 'timestamp' | 'string' | 'date';
    withTimezone?: boolean;
}

/**
 * Date column options
 */
export interface DateOptions extends BaseColumnOptions {
    mode: 'date' | 'string';
}

/**
 * Time column options
 */
export interface TimeOptions extends BaseColumnOptions {
    mode?: 'time' | 'string';
    withTimezone?: boolean;
}

/**
 * Blob column options
 */
export interface BlobOptions extends BaseColumnOptions {
    mode: 'buffer' | 'json' | 'bigint';
}

/**
 * Numeric column options
 */
export type NumericConfig<T extends 'string' | 'number' | 'bigint' = 'string' | 'number' | 'bigint'> = {
    precision: number;
    scale?: number;
    mode?: T;
} | {
    precision?: number;
    scale: number;
    mode?: T;
} | {
    precision?: number;
    scale?: number;
    mode: T;
};

/**
 * Bigint column options
 */
export interface BigintOptions extends BaseColumnOptions {
    mode: 'bigint' | 'string' | 'number';
}

/**
 * Smallint column options
 */
export interface SmallintOptions extends BaseColumnOptions {
    mode: 'boolean' | 'number';
}

/**
 * Boolean column options
 */
export interface BooleanOptions extends BaseColumnOptions {
    mode?: 'boolean' | 'number' | 'string';
}

/**
 * JSON/JSONB column options
 */
export interface JsonOptions extends BaseColumnOptions {
}



export interface DialectColumnBuilders  {
    text: ColumnBuilderFn<TextOptions>;
    varchar: ColumnBuilderFn<VarcharConfig>;
    json: ColumnBuilderFn<JsonOptions>;
    jsonb: ColumnBuilderFn<JsonOptions>;
    integer: ColumnBuilderFn<IntegerOptions>;
    bigint: ColumnBuilderFn<BigintOptions>;
    smallint: ColumnBuilderFn<SmallintOptions>;
    pkserial: ColumnBuilderFn;
    real: ColumnBuilderFn<RealOptions>;
    doublePrecision: ColumnBuilderFn<RealOptions>;
    numeric: ColumnBuilderFn<NumericConfig>;
    bool: ColumnBuilderFn<BooleanOptions>;
    boolean: ColumnBuilderFn<BooleanOptions>;
    date: ColumnBuilderFn<DateOptions>;
    time: ColumnBuilderFn<TimeOptions>;
    timestamp: TimestampColumnBuilderFn<TimestampOptions>;
    blob: ColumnBuilderFn<BlobOptions>;
}
export type ColumnType = keyof DialectColumnBuilders;

export interface DialectConstraintBuilders {
    unique: UniqueConstraintBuilderFn;
    check: CheckConstraintBuilderFn;
}
export type ConstraintType = keyof DialectConstraintBuilders;

export interface DialectTableLevelEntityBuilders extends DialectColumnBuilders, DialectConstraintBuilders {
    table: TableBuilderFn;
    index: IndexBuilderFn;
}
export type TableLevelEntityType = keyof DialectTableLevelEntityBuilders;


export interface DialectBuilders extends DialectColumnBuilders, DialectConstraintBuilders, DialectTableLevelEntityBuilders {

}

export type BuilderType = keyof DialectBuilders;

export interface ColumnInfo{
    name: string;
    dataType: string;
    isNullable: boolean;
}
export interface DrizzleColumnInfo extends ColumnInfo{
    drizzleColumn: any;
}

export interface SQLDialect extends DialectBuilders{
    dialectName: string;


    getTableNames: (db: DrizzleDatabaseConnectionDriver, schemaName?: string) => Promise<string[]>;
    getSchemaNames: (db: DrizzleDatabaseConnectionDriver, options?: { excludeBuiltins?: boolean }) => Promise<string[]>;
    getTableColumns: (
        db: DrizzleDatabaseConnectionDriver,
        tableName: string,
        schemaName?: string
    ) => Promise<DrizzleColumnInfo[]>;
    getRuntimeTable: (
        db: DrizzleDatabaseConnectionDriver,
        tableName: string,
        schemaName?: string,
    ) => Promise<Table>;
}

