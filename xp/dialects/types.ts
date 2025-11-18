import {errors} from "@ts-morph/common";
import NotImplementedError = errors.NotImplementedError;
import {DrizzleDatabaseConnection} from "../drivers/types";
import {number} from "zod";
import type {ColumnBuilder} from "drizzle-orm";


export interface ColumnLevelEntity {}
export interface Column extends ColumnLevelEntity {}
export interface Index extends ColumnLevelEntity {}
export interface Constraint extends ColumnLevelEntity {}


export interface TableLevelEntity {}
export interface Table extends TableLevelEntity {}
export interface View extends TableLevelEntity{}
export interface MaterializedView extends TableLevelEntity{}

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
export type ColumnBuilderFn<T extends ColumnOpts = ColumnOpts> = (name: string, opts?: T) => ColumnBuilder;
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
    mode?: 'json' | 'boolean' | 'timestamp' | 'number' | 'string';
}

/**
 * Text column options
 */
export interface TextOptions extends BaseColumnOptions {
    mode?: 'json' | 'string';
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
    mode?: 'boolean' | 'timestamp' | 'number' | 'string';
}

/**
 * Real (floating point) column options
 */
export interface RealOptions extends BaseColumnOptions {
    mode?: 'number' | 'string';
}

/**
 * Timestamp column options
 */
export interface TimestampOptions extends BaseColumnOptions {
    mode?: 'timestamp' | 'string' | 'date';
    withTimezone?: boolean;
}

/**
 * Date column options
 */
export interface DateOptions extends BaseColumnOptions {
    mode?: 'date' | 'string';
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
    mode?: 'bigint' | 'buffer' | 'string';
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
    mode?: 'bigint' | 'string' | 'number';
}

/**
 * Smallint column options
 */
export interface SmallintOptions extends BaseColumnOptions {
    mode?: 'boolean' | 'number' | 'string';
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
    mode?: 'json';
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
    timestamp: ColumnBuilderFn<TimestampOptions>;
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


export interface SQLDialect extends DialectBuilders{
    dialectName: string;


    getTableNames: (db: DrizzleDatabaseConnection, schemaName?: string) => Promise<string[]>;
    getSchemaNames: (db: DrizzleDatabaseConnection, options?: { excludeBuiltins?: boolean }) => Promise<string[]>;
    getTableColumns: (
        db: DrizzleDatabaseConnection,
        tableName: string,
        schemaName?: string
    ) => Promise<
        {
            name: string;
            dataType: string;
            isNullable: boolean;
        }[]
    >
}

