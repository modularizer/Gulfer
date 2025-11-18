/**
 * Generate CREATE TABLE SQL script using Drizzle
 * 
 * This function uses Drizzle's built-in SQL generation capabilities
 * to create CREATE TABLE statements from table or schema objects.
 */

import type { SQLDialect} from '../dialects/types';
import type { UnboundTable } from '../dialects/implementations/unbound';
import type { Schema } from '../schema';
import { bindTable, isUnboundTable } from '../dialects/implementations/unbound';
import {Table} from "drizzle-orm";

/**
 * Generate CREATE TABLE SQL for a single table
 * Uses Drizzle's built-in toSQL() method to generate the SQL
 * 
 * @param table - Table object (bound or unbound)
 * @param dialect - SQL dialect to use for SQL generation (required if table is unbound)
 * @param options - Options for SQL generation
 * @returns CREATE TABLE SQL statement
 */
export function generateCreateScriptForTable(
  table: Table | UnboundTable,
  dialect?: SQLDialect,
  options: { ifNotExists?: boolean } = {}
): string {
  // If table is unbound, bind it first
  let boundTable: Table;
  if (isUnboundTable(table)) {
    if (!dialect) {
      throw new Error(
        'Dialect is required when generating CREATE script for an unbound table. ' +
        'Please provide a dialect parameter.'
      );
    }
    boundTable = bindTable(table, dialect);
  } else {
    boundTable = table as Table;
  }

  // Use Drizzle's toSQL() method to generate CREATE TABLE statement
  const tableAny = boundTable as any;
  
  if (typeof tableAny.toSQL !== 'function') {
    throw new Error(
      'Table does not have a toSQL() method. ' +
      'This may indicate the table is not properly bound to a Drizzle dialect.'
    );
  }
  
  let sql = tableAny.toSQL().sql;
  
  // Add IF NOT EXISTS if requested
  if (options.ifNotExists !== false) {
    sql = sql.replace(/^CREATE TABLE\b/i, 'CREATE TABLE IF NOT EXISTS');
  }
  
  return sql;
}

/**
 * Generate CREATE TABLE SQL for all tables in a schema
 * 
 * @param schema - Schema object containing tables
 * @param dialect - SQL dialect to use for SQL generation (required if schema contains unbound tables)
 * @param options - Options for SQL generation
 * @returns Combined CREATE TABLE SQL statements
 */
export function generateCreateScriptForSchema(
  schema: Schema,
  dialect?: SQLDialect,
  options: { ifNotExists?: boolean } = {}
): string {
  const statements: string[] = [];
  
  for (const [tableName, table] of Object.entries(schema.tables)) {
    const createSQL = generateCreateScriptForTable(table, dialect, options);
    statements.push(createSQL);
  }
  
  return statements.join('\n\n');
}

/**
 * Generate CREATE TABLE SQL script
 * Accepts either a single table or a schema
 * Uses Drizzle's built-in toSQL() method to generate the SQL
 * 
 * @param input - Table object or Schema object
 * @param dialect - SQL dialect to use for SQL generation (required if input contains unbound tables)
 * @param options - Options for SQL generation
 * @returns CREATE TABLE SQL statement(s)
 * 
 * @example
 * ```typescript
 * import { generateCreateScript } from './xp/generate-create-script';
 * import { table, text, uuidPK } from './xp/dialects/implementations/unbound';
 * 
 * // Generate for a single table
 * const usersTable = table('users', {
 *   id: uuidPK('id'),
 *   name: text('name').notNull(),
 * });
 * const sql = generateCreateScript(usersTable, dialect);
 * 
 * // Generate for a schema
 * const mySchema = schema({ users: usersTable });
 * const schemaSQL = generateCreateScript(mySchema, dialect);
 * ```
 */
export function generateCreateScript(
  input: Table | UnboundTable | Schema<any>,
  dialect?: SQLDialect,
  options: { ifNotExists?: boolean } = {}
): string {
  // Check if input is a Schema
  if (input && typeof input === 'object' && 'tables' in input) {
    return generateCreateScriptForSchema(input as Schema<any>, dialect, options);
  }
  
  // Otherwise, treat as a table
  return generateCreateScriptForTable(input as Table | UnboundTable, dialect, options);
}

