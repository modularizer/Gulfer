/**
 * Schema Object
 * 
 * Takes a record of tables (bound or unbound) and provides:
 * - Property access to tables
 * - .bind() method to bind all tables to a dialect
 * - .connect() method to connect to a database
 */

import type { SQLDialect} from './dialects/types';
import type { UnboundTable, } from './dialects/implementations/unbound';
import { bindTable } from './dialects/implementations/unbound';
import {connect, XPDatabaseConnection} from "./connection";
import {DbConnectionInfo} from "./drivers/types";
import {Table} from "drizzle-orm";

/**
 * Schema object that holds tables as properties
 */
export class Schema<Tables extends Record<string, UnboundTable | Table> = Record<string, UnboundTable | Table>> {
  constructor(public tables: Tables) {
    // Set tables as properties for direct access
    for (const [key, table] of Object.entries(tables)) {
      (this as any)[key] = table;
    }
  }

  /**
   * Bind all tables in the schema to a dialect
   * Returns a new schema with bound tables
   */
  bind(dialect: SQLDialect): Schema<Record<keyof Tables, Table>> {
    const boundTables = {} as Record<keyof Tables, Table>;
    
    for (const [key, table] of Object.entries(this.tables)) {
      boundTables[key as keyof Tables] = bindTable(table, dialect) as Table;
    }
    
    return new Schema(boundTables);
  }

  /**
   * Connect to a database using connection info
   * Automatically detects the dialect and driver from connection info
   * Returns a database connection with bound tables
   */
  async connect<T extends DbConnectionInfo>(
    connectionInfo: T
  ): Promise<XPDatabaseConnection> {
    return connect(connectionInfo);
  }

}

/**
 * Create a schema from a record of tables
 * 
 * @param tables - Record of table name to table object (unbound or bound)
 * @returns Schema object with tables as properties
 * 
 * @example
 * ```typescript
 * import { schema } from './xp/schema';
 * import { table, text, uuidPK } from './xp/dialects/implementations/unbound';
 * 
 * const mySchema = schema({
 *   users: table('users', {
 *     id: uuidPK('id'),
 *     name: text('name').notNull(),
 *   }),
 * });
 * 
 * // Access tables as properties
 * const users = mySchema.users;
 * 
 * // Bind to a dialect
 * const boundSchema = mySchema.bind(dialect);
 * 
 * // Connect to database
 * const { db, schema: connectedSchema } = await mySchema.connect({ name: 'my-db' });
 * 
 * ```
 */
export function schema<Tables extends Record<string, UnboundTable | Table>>(
  tables: Tables
): Schema<Tables> {
  return new Schema(tables);
}

