/**
 * Generic Schema Functions
 * 
 * These are generic, unimplemented schema functions that can be used
 * to write schemas that work with any dialect. To use them, you must
 * import and bind a driver's schema implementation.
 * 
 * Usage:
 * ```ts
 * // Import generic types
 * import type { SchemaBuilder } from './adapters/schema-builder';
 * import { table, text, varchar } from './adapters/schema';
 * 
 * // Import and bind a driver's schema
 * import { schema as postgresSchema } from './adapters/drivers/postgres';
 * import { bindSchema } from './adapters/schema';
 * 
 * bindSchema(postgresSchema);
 * 
 * // Now use the schema functions - they'll use the bound driver
 * export const users = table('users', {
 *   id: uuidPK('id'),
 *   name: text('name'),
 *   email: varchar('email', { length: 255 }),
 * });
 * ```
 */

import type { 
  SchemaBuilder, 
  Table,
  ColumnConfig,
  TableConstraints,
  UniqueConstraint,
  IndexConstraint
} from '../abstract/builders';
import {ColumnBuilder} from "drizzle-orm";
import {AdapterType, defaultAdapterByHostPlatform} from "../implementations/types";
import {detectPlatform} from "../../platform";
import * as pglite from "../implementations/pglite/builders";
import * as postgres from "../implementations/postgres/builders";
import * as sqliteMobile from "../implementations/sqlite-mobile/builders";



// Current bound schema - defaults to null (must be bound before use)
let boundSchema: SchemaBuilder | null = null;


/**
 * Create an adapter by type
 */
export function getSchema(adapterType?: AdapterType): SchemaBuilder {
    if (!adapterType && boundSchema) {
        return boundSchema;
    }
    if (!adapterType){
        adapterType = defaultAdapterByHostPlatform[detectPlatform()];
    }
    switch (adapterType) {
        case AdapterType.PGLITE: {
            return pglite.schema;
        }
        case AdapterType.SQLITE_MOBILE: {
            return sqliteMobile.schema;
        }
        case AdapterType.POSTGRES: {
            return postgres.schema;
        }
        default:
            throw new Error(`Unknown adapter type: ${adapterType}`);
    }
}

/**
 * Bind a driver's schema implementation
 * This must be called before using any schema functions
 */
export async function bindSchema(adapterType?: AdapterType): Promise<void> {
    boundSchema = await getSchema(adapterType);
}



/**
 * Generic schema functions - these delegate to the bound schema
 */

/**
 * Create a table
 * @param name Table name
 * @param columns Record of column definitions
 * @param constraints Optional table-level constraints and indexes
 */
export function table(
  name: string, 
  columns: Record<string, ColumnBuilder>,
  constraints?: TableConstraints
): Table {
  return getSchema().table(name, columns, constraints);
}

/**
 * Text column builder
 */
export function text(name: string, config?: ColumnConfig): ColumnBuilder {
  return getSchema().text(name, config);
}

/**
 * Varchar column builder
 */
export function varchar(name: string, config?: ColumnConfig): ColumnBuilder {
  return getSchema().varchar(name, config);
}

/**
 * Integer column builder
 */
export function integer(name: string, config?: ColumnConfig): ColumnBuilder {
  return getSchema().integer(name, config);
}

/**
 * Real (floating point) column builder
 */
export function real(name: string, config?: ColumnConfig): ColumnBuilder {
  return getSchema().real(name, config);
}

/**
 * Timestamp column builder
 */
export function timestamp(name: string, config?: ColumnConfig): ColumnBuilder {
  return getSchema().timestamp(name, config);
}

/**
 * JSONB column builder
 */
export function jsonb(name: string, config?: ColumnConfig): ColumnBuilder {
  return getSchema().jsonb(name, config);
}

/**
 * Boolean column builder
 */
export function bool(name: string, config?: ColumnConfig): ColumnBuilder {
  return getSchema().bool(name, config);
}

/**
 * UUID column builder (convenience wrapper)
 */
export function uuid(name: string, ...args: any[]): ColumnBuilder {
  return getSchema().uuid(name, ...args);
}

/**
 * UUID column with default (convenience wrapper)
 */
export function uuidDefault(name: string, ...args: any[]): ColumnBuilder {
  return getSchema().uuidDefault(name, ...args);
}

/**
 * UUID primary key (convenience wrapper)
 */
export function uuidPK(name: string, ...args: any[]): ColumnBuilder {
  return getSchema().uuidPK(name, ...args);
}

/**
 * Unique constraint builder
 */
export function unique(...args: any[]): UniqueConstraint {
  return getSchema().unique(...args);
}

/**
 * Index constraint builder
 */
export function index(name: string): IndexConstraint {
  return getSchema().index(name);
}

