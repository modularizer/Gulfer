import {
    pgTable, pgMaterializedView, pgView,
    text as drizzleText, varchar as drizzleVarchar,
    integer as drizzleInteger, real as drizzleReal, doublePrecision as drizzleDoublePrecision, 
    numeric as drizzleNumeric, bigint as drizzleBigint, smallint as drizzleSmallint, serial,

    json as drizzleJson, jsonb as drizzleJsonb,
    boolean as drizzleBool,
    timestamp as drizzleTimestamp, time as drizzleTime, date as drizzleDate,
    unique, index, check
} from 'drizzle-orm/pg-core';
import {
    DialectBuilders,
    DialectColumnBuilders,
    SQLDialect,
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
    VarcharConfig,
    NumericConfig,
} from "../types";
import {DrizzleDatabaseConnection} from "../../drivers/types";
import {sql} from "drizzle-orm";
import {customType} from "drizzle-orm/sqlite-core";

// Option 1: use customType with explicit "bytea"
export const bytea = customType<{
    data: Uint8Array;
    driverData: Uint8Array;
}>({
    dataType() {
        return "bytea"; // what shows up in migrations / SQL
    },
});



// Wrap Drizzle builders to match our typed interface
const pgText = (name: string, opts?: TextOptions) => drizzleText(name, opts as any);
const pgVarchar = (name: string, opts?: VarcharConfig) => drizzleVarchar(name, opts as any);
const pgInteger = (name: string, opts?: IntegerOptions) => drizzleInteger(name, opts as any);
const pgReal = (name: string, opts?: RealOptions) => drizzleReal(name, opts as any);
const pgDoublePrecision = (name: string, opts?: RealOptions) => drizzleDoublePrecision(name, opts as any);
const pgBigint = (name: string, opts?: BigintOptions) => drizzleBigint(name, opts as any);
const pgSmallint = (name: string, opts?: SmallintOptions) => drizzleSmallint(name, opts as any);
const pgNumeric = (name: string, opts?: NumericConfig) => drizzleNumeric(name, opts as any);
const pgBool = (name: string, opts?: BooleanOptions) => drizzleBool(name, opts as any);
const pgTimestamp = (name: string, opts?: TimestampOptions) => drizzleTimestamp(name, opts as any);
const pgTime = (name: string, opts?: TimeOptions) => drizzleTime(name, opts as any);
const pgDate = (name: string, opts?: DateOptions) => drizzleDate(name, opts as any);
const pgJson = (name: string, opts?: JsonOptions) => drizzleJson(name, opts as any);
const pgJsonb = (name: string, opts?: JsonOptions) => drizzleJsonb(name, opts as any);
const pgBlob = (name: string, opts?: BlobOptions) => bytea(name);

const pgColumnBuilders: DialectColumnBuilders = {
    text: pgText,
    varchar: pgVarchar,
    json: pgJson,
    jsonb: pgJsonb,
    integer: pgInteger,
    real: pgReal,
    doublePrecision: pgDoublePrecision,
    bigint: pgBigint,
    smallint: pgSmallint,
    pkserial: (name: string) => serial(name).primaryKey(),
    blob: pgBlob,
    numeric: pgNumeric,
    bool: pgBool,
    boolean: pgBool,
    timestamp: pgTimestamp,
    time: pgTime,
    date: pgDate,

} as DialectColumnBuilders;
const pgBuilders: DialectBuilders = {
    table: pgTable, view: pgView, materializedView: pgMaterializedView,
    ...pgColumnBuilders,
    unique, index,
    // @ts-ignore
    check,
}
const dialectName = "pg";
const pgDialect: SQLDialect = {
    dialectName,

    ...pgBuilders,

    getTableNames: async (db: DrizzleDatabaseConnection, schemaName: string = 'public'): Promise<string[]>  => {
        return (await db.execute(sql`
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = ${schemaName} 
                    AND table_type = 'BASE TABLE'
                    ORDER BY table_name
              `)).map((row: any) => row.table_name);
    },

    getSchemaNames: async (
        db: DrizzleDatabaseConnection,
        options?: { excludeBuiltins?: boolean }
    ): Promise<string[]> => {
        const staticBuiltin = [
            'pg_catalog',
            'information_schema',
            'pg_toast'
        ];

        const isBuiltin = (name: string) => {
            if (staticBuiltin.includes(name)) return true;
            if (name.startsWith('pg_temp_')) return true;
            if (name.startsWith('pg_toast_temp_')) return true;
            return false;
        };

        const rows = await db.execute(sql`
    SELECT schema_name
    FROM information_schema.schemata
    ORDER BY schema_name
  `);

        return rows
            .map((row: any) => row.schema_name)
            .filter(name => !(options?.excludeBuiltins && isBuiltin(name)));
    },
    getTableColumns: async (db: DrizzleDatabaseConnection, tableName: string, schemaName: string = 'public'): Promise<{
        name: string;
        dataType: string;
        isNullable: boolean;
    }[]> => {
            const result = await db.execute(sql`
        SELECT 
          column_name as name,
          data_type as "dataType",
          is_nullable = 'YES' as "isNullable"
        FROM information_schema.columns
        WHERE table_schema = ${schemaName} AND table_name = ${tableName}
        ORDER BY ordinal_position
      `);

            return result.map((row: any) => ({
                name: row.name,
                dataType: row.dataType || row.data_type || 'unknown',
                isNullable: row.isNullable !== undefined ? row.isNullable : row.is_nullable === 'YES',
            }));
    }



};


export default pgDialect;

// Export all column builders
export const text = pgText;
export const varchar = pgVarchar;
export const json = pgJson;
export const jsonb = pgJsonb;
export const integer = pgInteger;
export const real = pgReal;
export const doublePrecision = pgDoublePrecision;
export const bigint = pgBigint;
export const smallint = pgSmallint;
export const pkserial = (name: string) => serial(name).primaryKey();
export const blob = pgBlob;
export const numeric = pgNumeric;
export const bool = pgBool;
export const boolean = pgBool;
export const timestamp = pgTimestamp;
export const time = pgTime;
export const date = pgDate;

// Export table builders
export const table = pgTable;
export const view = pgView;
export const materializedView = pgMaterializedView;

// Export constraint builders
export { unique, index, check };
