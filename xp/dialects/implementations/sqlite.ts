import {sqliteTable, text as drizzleText, integer as drizzleInteger, unique, real as drizzleReal, index, customType, blob as drizzleBlob} from 'drizzle-orm/sqlite-core';
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
    JsonOptions,
} from "../types";
import {DrizzleDatabaseConnection} from "../../drivers/types";
import {sql} from "drizzle-orm";




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




// Wrap Drizzle builders to match our typed interface
const sqliteText = (name: string, opts?: TextOptions) => drizzleText(name, opts as any);
const sqliteVarchar = (name: string, opts?: VarcharConfig) => drizzleText(name, opts as any);
const sqliteInteger = (name: string, opts?: IntegerOptions) => drizzleInteger(name, opts as any);
const sqliteReal = (name: string, opts?: RealOptions) => drizzleReal(name, opts as any);
const sqliteDoublePrecision = (name: string, opts?: RealOptions) => drizzleReal(name, opts as any);
const sqliteBigint = (name: string, opts?: BigintOptions) => drizzleBlob(name, {mode: "bigint", ...opts} as any);
const sqliteSmallint = (name: string, opts?: SmallintOptions) => drizzleInteger(name, opts as any);
const sqliteNumeric = (name: string, opts?: NumericConfig) => sqliteNumericImpl(name, opts as any);
const sqliteBool = (name: string, opts?: BooleanOptions) => drizzleInteger(name, {mode: "boolean", ...opts} as any);
const sqliteTimestamp = (name: string, opts?: TimestampOptions) => drizzleInteger(name, {mode: "timestamp", ...opts} as any);
const sqliteTime = (name: string, opts?: TimeOptions) => timeText24h(name);
const sqliteDate = (name: string, opts?: DateOptions) => dateTextMDY(name);
const sqliteJson = (name: string, opts?: JsonOptions) => drizzleText(name, {mode: 'json', ...opts} as any);
const sqliteJsonb = (name: string, opts?: JsonOptions) => drizzleText(name, {mode: 'json', ...opts} as any);
const sqliteBlob = (name: string, opts?: BlobOptions) => drizzleBlob(name, opts as any);

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
    pkserial: (name: string) => integer(name).primaryKey({ autoIncrement: true }),
    blob: sqliteBlob,
    numeric: sqliteNumeric,
    bool: sqliteBool,
    boolean: sqliteBool,
    timestamp: sqliteTimestamp,
    time: sqliteTime,
    date: sqliteDate,
} as DialectColumnBuilders;
const dialectName = "sqlite";
const sqliteBuilders: DialectBuilders = {
    table: sqliteTable,
    ...sqliteColumnBuilders,

    unique, index,
    check: notImplementedForDialect("check constraint", dialectName),
}

const sqliteDialect: SQLDialect = {
    dialectName,
    ...sqliteBuilders,

    getTableNames: async (
        db: DrizzleDatabaseConnection,
        schemaName: string = 'public'
    ): Promise<string[]> => {
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
    },


    getSchemaNames: async (
        db: DrizzleDatabaseConnection,
        options?: { excludeBuiltins?: boolean }
    ): Promise<string[]> => {
        return ["public"]
    },
    getTableColumns: async (
        db: DrizzleDatabaseConnection,
        tableName: string,
        schemaName: string = "public", // ignored in SQLite, but kept for signature compatibility
    ): Promise<
        {
            name: string;
            dataType: string;
            isNullable: boolean;
        }[]
    > => {
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
        return (result as any[]).map((row) => ({
            name: row.name,
            dataType: row.type || "unknown",
            isNullable: !row.notnull, // notnull: 1 => NOT NULL, 0 => NULLABLE
        }));
    }

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
export const pkserial = (name: string) => integer(name).primaryKey({ autoIncrement: true });
export const blob = sqliteBlob;
// Export numeric (using the implementation)
export const numeric = sqliteNumeric;
export const bool = sqliteBool;
export const boolean = sqliteBool;
export const timestamp = sqliteTimestamp;
export const time = sqliteTime;
export const date = sqliteDate;

// Export table builder
export const table = sqliteTable;

// Export constraint builders
export { unique, index };
// Note: check is not implemented for SQLite