import {sqliteTable, type SQLiteTableWithColumns, text as drizzleText, integer as drizzleInteger, unique, real as drizzleReal, index, customType, blob as drizzleBlob} from 'drizzle-orm/sqlite-core';
import {
    DialectBuilders,
    DialectColumnBuilders,
    notImplementedForDialect,
    NumericConfig,
    SQLDialect,
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
    JsonOptions, ColumnInfo, DrizzleColumnInfo, ColumnBuilderFn,
    TimestampColumnBuilderWithDefaultNow,
} from "../types";
import {DrizzleDatabaseConnectionDriver} from "../../drivers/types";
import {sql} from "drizzle-orm";
import type {Table, ColumnBuilder} from "drizzle-orm";
import {ColData} from "./unbound";

// Type alias for extended column builder (used for type compatibility)
type ExtendedColumnBuilder<TColData = any> = ColumnBuilder;




type NumericMode = "string" | "number" | "bigint";


const sqliteNumericImpl = <TMode extends NumericMode = "string">(
    name: string,
    config?: NumericConfig<TMode>,
) => {
    const mode = config?.mode ?? ("string" as NumericMode);

    // 1) STRING MODE – recommended default: exact decimal as string
    if (mode === "string") {
        return customType<{ data: string; driverData: string }>({
            dataType() {
                return "numeric";
            },
            toDriver(value) {
                // value like "123.456789"
                return value;
            },
            fromDriver(value) {
                return value;
            },
        })(name);
    }

    const scale = config?.scale ?? 2;
    const factor = BigInt(10 ** scale);

    // 2) NUMBER MODE – store scaled integer in TEXT, return JS number
    if (mode === "number") {
        return customType<{ data: number; driverData: string }>({
            dataType() {
                return "numeric";
            },
            toDriver(value) {
                // e.g. 12.34 with scale 2 -> "1234"
                const scaled = BigInt(Math.round(value * 10 ** scale));
                return scaled.toString();
            },
            fromDriver(value) {
                const scaled = BigInt(value);
                return Number(scaled) / 10 ** scale;
            },
        })(name);
    }

    // 3) BIGINT MODE – expose scaled integer as bigint (you handle scale yourself)
    return customType<{ data: bigint; driverData: string }>({
        dataType() {
            return "numeric";
        },
        toDriver(value) {
            // you pass in bigint already scaled however you want
            return value.toString();
        },
        fromDriver(value) {
            return BigInt(value);
        },
    })(name);
};






export const timeText24h = customType<{
    data: Date;        // TS Date (only the time portion is used)
    driverData: string // DB "HH:MM"
}>({
    dataType() {
        return "text";
    },

    // Date -> "HH:MM"
    toDriver(date) {
        const hh = String(date.getHours()).padStart(2, "0");
        const mm = String(date.getMinutes()).padStart(2, "0");
        return `${hh}:${mm}`;
    },

    // "HH:MM" -> Date (today)
    fromDriver(value) {
        const [hh, mm] = value.split(":").map(Number);
        const d = new Date();
        d.setHours(hh, mm, 0, 0);
        return d;
    },
});

export const dateTextMDY = customType<{
    data: Date;        // TS value
    driverData: string // stored as MM/DD/YY text
}>({
    dataType() {
        return "text";
    },

    // TS → "MM/DD/YY"
    toDriver(value) {
        const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(value.getUTCDate()).padStart(2, "0");
        const yy = String(value.getUTCFullYear()).slice(-2);
        return `${mm}/${dd}/${yy}`;
    },

    // "MM/DD/YY" → TS
    fromDriver(value) {
        const [mm, dd, yy] = value.split("/").map(Number);
        const fullYear = 2000 + yy; // interpret YY as 20YY
        return new Date(Date.UTC(fullYear, mm - 1, dd));
    },
});




/**
 * Helper to extend a ColumnBuilder with our custom properties
 * When using dialect builders directly (not through unbound), we don't have
 * the original UColumn, so we create a minimal ColData for type inference
 */
function extendSqliteColumnBuilder<TType = any>(
    builder: any,
    typeName: string,
    inferredType: TType
): ExtendedColumnBuilder<ColData> {
    const extended = builder as any;
    
    // Create a minimal ColData for type inference
    // We can't fully infer types from Drizzle's ColumnBuilder, so we use a fallback
    const colData: ColData = {
        __unbound: true,
        type: typeName,
        name: '',
        options: undefined,
        modifiers: [],
        nullable: true,
    };
    
    // $inferSelect and $inferInsert are type-only, no runtime implementation needed
    // $ref is undefined for direct dialect builders (no foreign key tracking)
    
    return extended as ExtendedColumnBuilder<ColData>;
}

// Wrap Drizzle builders to match our typed interface and return ExtendedColumnBuilder
const sqliteText = (name: string, opts?: TextOptions): ExtendedColumnBuilder<ColData> => 
    extendSqliteColumnBuilder(drizzleText(name), 'text', null as string | null);
const sqliteVarchar = (name: string, opts?: VarcharConfig): ExtendedColumnBuilder<ColData> => 
    extendSqliteColumnBuilder(drizzleText(name, opts as any), 'varchar', null as string | null);
const sqliteInteger = (name: string, opts?: IntegerOptions): ExtendedColumnBuilder<ColData> => 
    extendSqliteColumnBuilder(drizzleInteger(name, opts), 'integer', null as number | null);
const sqliteReal = (name: string, opts?: RealOptions): ExtendedColumnBuilder<ColData> => 
    extendSqliteColumnBuilder(drizzleReal(name), 'real', null as number | null);
const sqliteDoublePrecision = (name: string, opts?: RealOptions): ExtendedColumnBuilder<ColData> => 
    extendSqliteColumnBuilder(drizzleReal(name), 'doublePrecision', null as number | null);
const sqliteBigint = (name: string, opts?: BigintOptions): ExtendedColumnBuilder<ColData> => 
    extendSqliteColumnBuilder(drizzleBlob(name, {mode: "bigint", ...opts} as any), 'bigint', null as bigint | null);
const sqliteSmallint = (name: string, opts?: SmallintOptions): ExtendedColumnBuilder<ColData> => 
    extendSqliteColumnBuilder(drizzleInteger(name, opts), 'smallint', null as number | null);
const sqliteNumeric = (name: string, opts?: NumericConfig): ExtendedColumnBuilder<ColData> => 
    extendSqliteColumnBuilder(sqliteNumericImpl(name, opts), 'numeric', null as string | null);
const sqliteBool = (name: string, opts?: BooleanOptions): ExtendedColumnBuilder<ColData> => 
    extendSqliteColumnBuilder(drizzleInteger(name, {mode: "boolean", ...opts} as any), 'bool', null as boolean | null);
/**
 * Extended SQLite timestamp builder with .defaultNow() method
 * Creates a timestamp column and adds a .defaultNow() method that sets the default to the current Unix timestamp
 * Also wraps methods that return new builders (.notNull(), .primaryKey(), .unique(), etc.) to preserve .defaultNow()
 */
const sqliteTimestamp = (name: string, opts?: TimestampOptions): TimestampColumnBuilderWithDefaultNow => {
    const baseBuilder = drizzleInteger(name, {mode: "timestamp", ...opts} as any);
    
    // Helper function to add defaultNow and wrap builder methods to any builder
    const addDefaultNow = (originalBuilder: any): TimestampColumnBuilderWithDefaultNow => {
        // Store reference to the original builder's methods to avoid recursion
        // We need to call these directly, not through 'this', to avoid calling our wrapped versions
        const originalNotNull = originalBuilder.notNull?.bind(originalBuilder);
        const originalPrimaryKey = originalBuilder.primaryKey?.bind(originalBuilder);
        const originalUnique = originalBuilder.unique?.bind(originalBuilder);
        const originalDefault = originalBuilder.default?.bind(originalBuilder);
        const originalReferences = originalBuilder.references?.bind(originalBuilder);
        const original$type = originalBuilder.$type?.bind(originalBuilder);
        
        // Wrap methods that return new builder instances to preserve .defaultNow()
        const wrappedBuilder = Object.assign(originalBuilder, {
            defaultNow(this: any): TimestampColumnBuilderWithDefaultNow {
                // SQLite stores timestamps as Unix epoch (seconds since 1970-01-01)
                // Use strftime('%s','now') to get the current timestamp
                // Call the original .default() method to avoid recursion
                const builderWithDefault = originalDefault?.(sql`(strftime('%s','now'))`);
                if (!builderWithDefault) {
                    throw new Error('default() method not available on builder');
                }
                // Ensure the returned builder also has .defaultNow() method
                return addDefaultNow(builderWithDefault);
            },
            // Wrap .notNull() to preserve .defaultNow()
            notNull(this: any): TimestampColumnBuilderWithDefaultNow {
                const newBuilder = originalNotNull?.();
                if (!newBuilder) {
                    throw new Error('notNull() method not available on builder');
                }
                return addDefaultNow(newBuilder);
            },
            // Wrap .primaryKey() to preserve .defaultNow()
            primaryKey(this: any, ...args: any[]): TimestampColumnBuilderWithDefaultNow {
                const newBuilder = originalPrimaryKey?.(...args);
                if (!newBuilder) {
                    throw new Error('primaryKey() method not available on builder');
                }
                return addDefaultNow(newBuilder);
            },
            // Wrap .unique() to preserve .defaultNow()
            unique(this: any, ...args: any[]): TimestampColumnBuilderWithDefaultNow {
                const newBuilder = originalUnique?.(...args);
                if (!newBuilder) {
                    throw new Error('unique() method not available on builder');
                }
                return addDefaultNow(newBuilder);
            },
            // Wrap .default() to preserve .defaultNow()
            default(this: any, ...args: any[]): TimestampColumnBuilderWithDefaultNow {
                const newBuilder = originalDefault?.(...args);
                if (!newBuilder) {
                    throw new Error('default() method not available on builder');
                }
                return addDefaultNow(newBuilder);
            },
            // Wrap .references() to preserve .defaultNow()
            references(this: any, ...args: any[]): TimestampColumnBuilderWithDefaultNow {
                const newBuilder = originalReferences?.(...args);
                if (!newBuilder) {
                    throw new Error('references() method not available on builder');
                }
                return addDefaultNow(newBuilder);
            },
            // Wrap .$type() to preserve .defaultNow() (TypeScript-only method)
            $type(this: any, ...args: any[]): TimestampColumnBuilderWithDefaultNow {
                const newBuilder = original$type?.(...args);
                if (!newBuilder) {
                    throw new Error('$type() method not available on builder');
                }
                return addDefaultNow(newBuilder);
            },
        }) as TimestampColumnBuilderWithDefaultNow;
        
        return wrappedBuilder;
    };
    
    return addDefaultNow(baseBuilder);
};
const sqliteTime = (name: string, opts?: TimeOptions): ExtendedColumnBuilder<ColData> => 
    extendSqliteColumnBuilder(timeText24h(name), 'time', null as Date | null);
const sqliteDate = (name: string, opts?: DateOptions): ExtendedColumnBuilder<ColData> => 
    extendSqliteColumnBuilder(dateTextMDY(name), 'date', null as Date | null);
const sqliteJson = (name: string, opts?: JsonOptions): ExtendedColumnBuilder<ColData> => 
    extendSqliteColumnBuilder(drizzleText(name, {mode: 'json', ...opts} as any), 'json', null as any | null);
const sqliteJsonb = (name: string, opts?: JsonOptions): ExtendedColumnBuilder<ColData> => 
    extendSqliteColumnBuilder(drizzleText(name, {mode: 'json', ...opts} as any), 'jsonb', null as any | null);
const sqliteBlob = (name: string, opts?: BlobOptions): ExtendedColumnBuilder<ColData> => 
    extendSqliteColumnBuilder(drizzleBlob(name, opts), 'blob', null as Uint8Array | null);

const sqliteColumnBuilders: DialectColumnBuilders = {
    text: sqliteText,
    varchar: sqliteVarchar,
    json: sqliteJson,
    jsonb: sqliteJsonb,
    integer: sqliteInteger,
    real: sqliteReal,
    doublePrecision: sqliteDoublePrecision,
    bigint: sqliteBigint,
    smallint: sqliteSmallint,
    pkserial: (name: string): ExtendedColumnBuilder<ColData> => 
        extendSqliteColumnBuilder(integer(name).primaryKey(), 'pkserial', null as number | null),
    blob: sqliteBlob,
    numeric: sqliteNumeric,
    bool: sqliteBool,
    boolean: sqliteBool,
    timestamp: sqliteTimestamp,
    time: sqliteTime,
    date: sqliteDate,
} as unknown as DialectColumnBuilders;
const dialectName = "sqlite";

// Wrap sqliteTable to add $primaryKey property while preserving the original type
function sqliteTableExtended<
  TName extends string,
  TColumns extends Record<string, any>
>(
    name: TName, 
    columns: TColumns
) {
    const table = sqliteTable(name, columns);
    
    // Extract the primary key column type from the table's columns
    type TableType = typeof table;
    type TableColumns = TableType['columns'];
    
    // Helper type to check if a column is a primary key
    // Drizzle stores primary key info in multiple places at runtime:
    // - col.primary === true
    // - col.config.primaryKey === true
    // At the type level, Drizzle encodes this in the column's type structure
    // We check multiple possible locations where primary key info might be encoded
    type IsPrimaryKeyColumn<C> = 
        // Most direct: check if primary is true
        C extends { primary: true } ? true
        // Check config.primaryKey
        : C extends { config: infer Config } 
            ? Config extends { primaryKey: true } ? true : false
        // Check data.primaryKey (some Drizzle versions use this)
        : C extends { data: infer Data }
            ? Data extends { primaryKey: true } ? true : false
        // Check internal _ property
        : C extends { _: infer Internal }
            ? Internal extends { primary: true } | { isPrimaryKey: true } ? true : false
        // Check direct isPrimaryKey
        : C extends { isPrimaryKey: true } ? true
        : false;
    
    // Find the primary key column by iterating through all columns
    type FindPrimaryKeyColumn<TColumns> = TColumns extends Record<string, infer C>
        ? {
            [K in keyof TColumns]: IsPrimaryKeyColumn<TColumns[K]> extends true ? TColumns[K] : never;
        }[keyof TColumns]
        : never;
    
    type PrimaryKeyColumnType = FindPrimaryKeyColumn<TableColumns>;
    
    // Find the primary key column from the table's columns
    // Drizzle exposes columns directly on the table object (e.g., table.id, table.name)
    
    // Add $primaryKey getter that returns the actual primary key column
    // Search at runtime to ensure we get the current value
    Object.defineProperty(table, '$primaryKey', {
        get(): PrimaryKeyColumnType extends never ? undefined : PrimaryKeyColumnType {
            const tableAny = this as any;
            
            // Check columns exposed directly on the table (table.id, table.name, etc.)
            // Drizzle exposes columns as properties on the table object
            for (const key in tableAny) {
                // Skip known non-column properties
                if (key === 'columns' || key === '_' || key === 'enableRLS' || key.startsWith('$')) continue;
                
                const col = tableAny[key];
                // Check if it's a column object with primary key
                // Drizzle sets col.primary = true for primary key columns
                if (col && typeof col === 'object' && (col as any).primary === true) {
                    return col as PrimaryKeyColumnType extends never ? undefined : PrimaryKeyColumnType;
                }
            }
            
            // Fallback: also check table.columns if it exists
            if (tableAny.columns && typeof tableAny.columns === 'object') {
                for (const [key, column] of Object.entries(tableAny.columns)) {
                    const col = column as any;
                    if (col && typeof col === 'object' && col.primary === true) {
                        return col as PrimaryKeyColumnType extends never ? undefined : PrimaryKeyColumnType;
                    }
                }
            }
            
            return undefined as PrimaryKeyColumnType extends never ? undefined : PrimaryKeyColumnType;
        },
        enumerable: false,
        configurable: true,
    });
    
    // Use intersection type to add $primaryKey while preserving the original type
    return table as TableType & { 
        /** Get the primary key column from this table */
        readonly $primaryKey: PrimaryKeyColumnType extends never ? undefined : PrimaryKeyColumnType;
    };
}

const sqliteBuilders: DialectBuilders = {
    table: sqliteTableExtended,
    ...sqliteColumnBuilders,
    unique, index,
    check: notImplementedForDialect("check constraint", dialectName),
}


function sqliteTypeToDrizzleColumn(col: ColumnInfo): any {
    // VERY rough mapping – you’ll want to refine this
    const { name, dataType, isNullable } = col;

    const base = (() => {
        switch (dataType) {
            case 'integer':
            case 'int4':
                return integer(name);
            case 'bigint':
            case 'int8':
                return bigint(name);
            case 'boolean':
                return boolean(name);
            case 'numeric':
            case 'decimal':
                return numeric(name);
            case 'timestamp without time zone':
            case 'timestamp with time zone':
                return timestamp(name);
            case 'text':
            case 'character varying':
            default:
                return text(name);
        }
    })();

    return isNullable ? base : base.notNull();
}


async function getTableNames(
    db: DrizzleDatabaseConnectionDriver,
    schemaName: string = 'public'
): Promise<string[]>  {
    if (schemaName !== 'public') {
        throw new Error("SQLite does not support schemas")
    }
    return (
        await db.execute(sql`
      SELECT name AS table_name
      FROM sqlite_master
      WHERE type = 'table'
      ORDER BY name
    `)
    ).map((row: any) => row.table_name);
}
async function getSchemaNames(
    db: DrizzleDatabaseConnectionDriver,
    options?: { excludeBuiltins?: boolean }
): Promise<string[]> {
    return ["public"]
}
async function getTableColumns(
    db: DrizzleDatabaseConnectionDriver,
    tableName: string,
    schemaName: string = "public", // ignored in SQLite, but kept for signature compatibility
): Promise<DrizzleColumnInfo[]> {
    if (schemaName !== 'public') {
        throw new Error("SQLite does not support schemas")
    }
    // Note: table name can't be passed as a bound parameter to PRAGMA,
    // so we have to interpolate it. Make sure `tableName` is trusted.
    const result = await db.execute(
        sql.raw(`PRAGMA table_info(${JSON.stringify(tableName)});`),
    );

    // SQLite PRAGMA table_info returns:
    // cid | name | type | notnull | dflt_value | pk
    const info = (result as any[]).map((row) => ({
        name: row.name,
        dataType: row.type || "unknown",
        isNullable: !row.notnull, // notnull: 1 => NOT NULL, 0 => NULLABLE
    }));
    return info.map((row: ColumnInfo) => ({
        ...row,
        drizzleColumn: sqliteTypeToDrizzleColumn(row)
    }))
}
async function getRuntimeTable(
    db: DrizzleDatabaseConnectionDriver,
    tableName: string,
    schemaName: string = "public",
){
    const columns = await getTableColumns(db, tableName, schemaName);

    const colsShape: Record<string, any> = {};
    for (const col of columns) {
        colsShape[col.name] = col.drizzleColumn;
    }

    // This gives you an AnyPgTable you can pass to db.select(), etc.
    return table(tableName, colsShape);
}


const sqliteDialect: SQLDialect = {
    dialectName,
    ...sqliteBuilders,

    getTableNames,
    getSchemaNames,
    getTableColumns,
    getRuntimeTable

};


export default sqliteDialect;

// Export all column builders
export const text = sqliteText;
export const varchar = sqliteVarchar;
export const json = sqliteJson;
export const jsonb = sqliteJsonb;
export const integer = sqliteInteger;
export const real = sqliteReal;
export const doublePrecision = sqliteDoublePrecision;
export const bigint = sqliteBigint;
export const smallint = sqliteSmallint;
export const pkserial = (name: string): ExtendedColumnBuilder<ColData> => 
    extendSqliteColumnBuilder(integer(name).primaryKey(), 'pkserial', null as number | null);
export const blob = sqliteBlob;
// Export numeric (using the implementation)
export const numeric = sqliteNumeric;
export const bool = sqliteBool;
export const boolean = sqliteBool;
export const timestamp = sqliteTimestamp;
export const time = sqliteTime;
export const date = sqliteDate;

// Export table builder
export const table = sqliteTableExtended;

// Export constraint builders
export { unique, index };
// Note: check is not implemented for SQLite