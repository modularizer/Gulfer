/**
 * Helper functions for building common column types
 * These provide convenient shortcuts for creating column configs with sensible defaults
 */

import { z } from 'zod';
import {generateUUID} from "@utils/uuid";
import {ColumnGenerator} from "@services/storage/orm/types";
import {column, ColumnConfigBuilder} from "@services/storage/orm/column";
import {TableConfigBuilder} from "@services/storage/orm/table";



export function str(
    columnName: string,
    {
        rx,
        rxError,
        minLength,
        maxLength,
        defaultValue
    }: {
        rx?: RegExp;
        rxError?: string;
        minLength?: number;
        maxLength?: number;
        defaultValue?: string | ColumnGenerator<string>;
    } = {}
): ColumnConfigBuilder<string> {
    let schema: any = z.string();
    if (minLength !== undefined) {
        schema = schema.min(minLength, `${columnName} too short (must be >=${minLength})`);
    }
    if (maxLength !== undefined) {
        schema = schema.max(maxLength, `${columnName} too long (must be <=${minLength})`);
    }
    if (rx) {
        schema = schema.regex(rx, rxError ?? `${columnName} did not match required pattern`);
    }
    return column<string>(columnName, schema, defaultValue);
}

export function hex(columnName: string, { length, minLength, maxLength, defaultValue}: {
        length?: number;
        minLength?: number;
        maxLength?: number;
        defaultValue?: string | ColumnGenerator<string>;
    } = {}) {
    if (length !== undefined) {
        minLength = length;
        maxLength = length;
    }
    return str(columnName, {
        rx: /^[0-9a-f]+$/,
        rxError: `Must be a hex string`,
        minLength,
        maxLength,
        defaultValue
    })
}

export function hex16(columnName: string, defaultValue?: any) {
    return hex(columnName, {length: 16, defaultValue});
}



/**
 * Create a UUID column (16 hex characters)
 */
export function uuidPK(columnName: string = 'id'): ColumnConfigBuilder<string> {
    return hex16(columnName, generateUUID).unique();
}

/**
 * Create a name column
 * Starts with a letter and allows letters, numbers, spaces, hyphens, underscores, periods, apostrophes, parentheses, brackets, and curly brackets
 */
export function name(columnName: string = 'name', {minLength = 1, maxLength = 50, rx = /^[a-zA-Z][a-zA-Z0-9\s\-_.'()\[\]{}]*$/, rxError = 'Invalid Name', defaultValue}: {minLength?: number, maxLength?: number, rx?: RegExp, rxError?: string, defaultValue?: string | ColumnGenerator<string>} = {}): ColumnConfigBuilder<string> {
    return str(columnName, {rx, rxError, minLength, maxLength, defaultValue});
}

export function requiredUniqueName(columnName: string = 'name', {minLength = 1, maxLength = 50, rx = /^[a-zA-Z][a-zA-Z0-9\s\-_.'()\[\]{}]*$/, rxError = 'Invalid Name', defaultValue}: {minLength?: number, maxLength?: number, rx?: RegExp, rxError?: string, defaultValue?: string | ColumnGenerator<string>} = {}): ColumnConfigBuilder<string> {
    return name(columnName, {rx, rxError, minLength, maxLength, defaultValue}).unique().notNull().required();
}




/**
 * Create a number column with optional constraints
 */
export function num(
    columnName: string,
    options: {
        int?: boolean;
        positive?: boolean;
        nonnegative?: boolean;
        min?: number;
        max?: number;
        defaultValue?: number| ColumnGenerator<number>;
    } = {}
): ColumnConfigBuilder<number> {
    let schema = z.number();
    if (options?.int) {
        schema = schema.int();
    }
    if (options?.positive) {
        schema = schema.positive();
    }
    if (options?.nonnegative) {
        schema = schema.nonnegative();
    }
    if (options?.min !== undefined) {
        schema = schema.min(options.min);
    }
    if (options?.max !== undefined) {
        schema = schema.max(options.max);
    }
    return column<number>(columnName, schema, options.defaultValue);
}

export function nonnegint(
    columnName: string,
    options?: {
        min?: number;
        max?: number;
        defaultValue?: number| ColumnGenerator<number>;
    }
): ColumnConfigBuilder<number> {
    return num(columnName, {...options, nonnegative: false, int: true});
}

/**
 * Create a boolean column
 */
export function bool(
    columnName: string,
    defaultValue?: boolean
): ColumnConfigBuilder<boolean> {
    return column<boolean>(columnName, z.boolean(), defaultValue);
}

/**
 * Create a timestamp column
 * Application type: Date
 * Storage format: number (milliseconds since epoch)
 * Automatically serializes Date to number and deserializes number to Date
 */
export function timestamp(
    columnName: string,
): ColumnConfigBuilder<Date> {
    // Schema validates Date objects in the application
    const schema = z.date();
    const builder = column<Date>(columnName, schema);

    // Serialize Date to number (milliseconds) before saving to storage
    builder.withSerializer((date: Date) => date.getTime());

    // Deserialize number (milliseconds) to Date after loading from storage
    builder.withLoader((value: number) => new Date(value));

    return builder;
}

/**
 * Create an enum column
 */
export function enumColumn<T extends [string, ...string[]]>(
    columnName: string,
    values: T,
    defaultValue?: any,
): ColumnConfigBuilder<T[number]> {
    //@ts-ignore
    return column<T>(columnName, z.enum(values), defaultValue);
}

/**
 * Create a foreign key column
 */
export function foreignUUID(
    columnName: string,
    referencesTableName: string,
    referencesField: string = 'id',
    cascadeDelete?: boolean
): ColumnConfigBuilder<string> {
    return uuidPK(columnName).references(referencesTableName, referencesField, cascadeDelete);
}

export function foreignKey(
    columnName: string,
    referencesTable: TableConfigBuilder,
    cascadeDelete?: boolean
): ColumnConfigBuilder<string> {
    return uuidPK(columnName).references(referencesTable.columns.id, cascadeDelete);
}

