import {z} from "zod/index";
import {ColumnConfigBuilder} from "@services/storage/orm/column";


export type ColumnCheck<T = any, R = Record<string, any>> =
    | ((value: T, record: R) => boolean)
    | ((value: T) => boolean)
    | ((value: T, record: R) => Promise<boolean>)
    | ((value: T) => Promise<boolean>);

export type RecordCheck<T = Record<string, any>> =
    | ((record: Record<string, any> | T) => boolean)
    | ((record: Record<string, any> | T) => Promise<boolean>);

/**
 * Serialize a column value before saving to storage
 * Converts from application type to storage format
 */
export type ColumnDump<T = any, R = Record<string, any>, StorageFormat = any> =
    | ((value: T, record: R) => StorageFormat)
    | ((value: T) => StorageFormat)
    | ((value: T, record: R) => Promise<StorageFormat>)
    | ((value: T) => Promise<StorageFormat>);

/**
 * Deserialize a column value after loading from storage
 * Converts from storage format back to application type
 */
export type ColumnLoad<T = any, R = Record<string, any>, StorageFormat = any> =
    | ((value: StorageFormat, record: R) => T)
    | ((value: StorageFormat) => T)
    | ((value: StorageFormat, record: R) => Promise<T>)
    | ((value: StorageFormat) => Promise<T>);

/**
 * Serialize a record before saving to storage
 * Converts from application type to storage format
 */
export type RecordDump<T = Record<string, any>, StorageFormat = any> =
    | ((record: Record<string, any> | T) => StorageFormat)
    | ((record: Record<string, any> | T) => Promise<StorageFormat>);

/**
 * Deserialize a record after loading from storage
 * Converts from storage format back to application type
 */
export type RecordLoad<T = Record<string, any>, StorageFormat = any> =
    | ((record: StorageFormat) => T)
    | ((record: StorageFormat) => Promise<T>);


export type ComputedColumnGenerator<T = any, R = Record<string, any>> = (record: R) => T;
export type ColumnGenerator<T = any> = () => T;



export interface ForeignKeyConfig {

    referencesSchemaName?: string;
    referencesTableName: string;

    referencesColumnName: string;

    cascadeDelete?: boolean;

    column?: ResolvedColumnConfig;
    referencesColumn?: ResolvedColumnConfig;
}

export interface ColumnConfig<T = any> {
    columnName: string;
    schema: z.ZodSchema<T>;
    unique?: boolean;
    enforceUnique?: boolean;
    schemaName?: string;
    tableName?: string;
    dump?: ColumnDump<T>; // serialize value before saving to storage
    load?: ColumnLoad<T>; // deserialize value after loading from storage
    checks?: ColumnCheck[];
    fkConfig?: ForeignKeyConfig;
}
export interface ResolvedColumnConfig<T = any> extends ColumnConfig<T> {
    schemaName?: string;
    tableName: string;
    dump: ColumnDump<T>; // serialize value before saving to storage
    load: ColumnLoad<T>; // deserialize value after loading from storage
    checks: ColumnCheck[];
    unique: boolean;
    enforceUnique: boolean;
}

export interface TableConfig<T = Record<string, any>> {
    tableName: string;
    schemaName?: string;
    schema: z.ZodSchema<T>;
    columns: { [K in keyof T]: ColumnConfig<T[K]> };

    dump?: RecordDump<T>; // serialize record before saving to storage
    load?: RecordLoad<T>; // deserialize record after loading from storage
    checks?: RecordCheck[];

    uniqueFieldCombos?: Array<(keyof T | string)[]>;
}



export interface ResolvedForeignKeyConfig extends ForeignKeyConfig {
    column: ResolvedColumnConfig;
    referencesColumn: ResolvedColumnConfig;

}

export interface UniqueConstraint {
    columnNames: string[];
    enforceUnique: boolean;
}

export interface ResolvedTableConfig<T = Record<string, any>> extends TableConfig<T> {
    columns: { [K in keyof T]: ResolvedColumnConfig<T[K]> };
    foreignKeys: ResolvedForeignKeyConfig[];
    checks: RecordCheck[];
    uniqueFieldCombos: UniqueConstraint[];
}

export interface ComputedColumnConfig<T = any> {
    viewName?: string;
    key: string;
    schema: z.ZodSchema<T>;
    generator: ComputedColumnGenerator<T>;
    dependsOn: (ResolvedColumnConfig | ComputedColumnConfig)[];
}

/**
 * Join type for foreign key relationships
 */
export type JoinType = 'one-to-one' | 'one-to-many' | 'many-to-one';

/**
 * Join configuration
 * Defines how to join related entities based on foreign key relationships
 */
export interface JoinConfig {
    /**
     * The foreign key relationship to join on
     */
    foreignKey: ResolvedForeignKeyConfig;

    /**
     * Type of join
     * - one-to-one: Join a single related entity (e.g., user.profile)
     * - one-to-many: Join an array of related entities (e.g., course.holes)
     * - many-to-one: Join a single related entity from the reverse side (e.g., hole.course)
     */
    type: JoinType;

    /**
     * Optional: Alias for the joined field
     * If not provided, uses the referenced table name
     */
    alias?: string;

    /**
     * Optional: Fields to select from the joined entity
     * Defaults to all fields ('*')
     */
    fields?: string[] | '*';
}

/**
 * Configuration for view operations
 * Views provide computed fields and joins on top of base tables
 */
export interface ViewConfig<T = Record<string, any>> {
    viewName: string;

    /**
     * Optional: Computed fields that are computed from the record on select
     * These fields are not stored but computed dynamically when entities are retrieved
     */
    columns: { [K in keyof T]: ResolvedColumnConfig<T[K]> | ComputedColumnConfig<T[K]> };

    /**
     * Optional: Join configurations
     * Defines how to join related entities based on foreign key relationships
     */
    joins?: JoinConfig[];
}

export type Columns = (ColumnConfig | ColumnConfigBuilder | string)[] | '*';