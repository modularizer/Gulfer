/**
 * Schema Object
 * 
 * Takes a record of tables (bound or unbound) and provides:
 * - Property access to tables
 * - .bind() method to bind all tables to a dialect
 * - .connect() method to connect to a database
 * - .generateCreateScript() method to generate CREATE TABLE SQL
 */

import type { SQLDialect, Table } from './dialects/types';
import type { UnboundTable, ConnectionInfo } from './dialects/implementations/unbound';
import type { DrizzleDatabaseConnection } from './drivers/types';
import { bindTable, isUnboundTable } from './dialects/implementations/unbound';

/**
 * Schema object that holds tables as properties
 */
export class Schema<Tables extends Record<string, UnboundTable | Table>> {
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
  async connect<T extends ConnectionInfo>(
    connectionInfo: T
  ): Promise<{
    db: DrizzleDatabaseConnection<T>;
    schema: Schema<Record<keyof Tables, Table>>;
    dialect: SQLDialect;
  }> {
    // Import necessary functions
    const { database, schema: createSchema } = await import('./dialects/implementations/unbound');
    
    // Create a schema from our tables
    const schemaObj = createSchema(this.tables as any);
    
    // Create a database with a single schema
    const db = database({
      schema: schemaObj,
    });
    
    // Connect using the database's connect method
    const result = await db.connect(connectionInfo);
    
    // Extract the bound tables from the database result
    const boundTables = result.schemas.schema.tables as Record<keyof Tables, Table>;
    const boundSchema = new Schema(boundTables);
    
    return {
      db: result.db,
      schema: boundSchema,
      dialect: result.dialect,
    };
  }

  /**
   * Generate CREATE TABLE SQL script for all tables in the schema
   * Tables must be bound to a dialect before generating SQL
   */
  generateCreateScript(dialect?: SQLDialect): string {
    // If dialect is provided, bind tables first
    const schemaToUse = dialect ? this.bind(dialect) : this;
    
    const statements: string[] = [];
    
    for (const [tableName, table] of Object.entries(schemaToUse.tables)) {
      // Check if table is bound
      if (isUnboundTable(table)) {
        throw new Error(
          `Cannot generate CREATE script for unbound table "${tableName}". ` +
          `Please bind the schema to a dialect first using .bind(dialect) or pass a dialect to generateCreateScript(dialect).`
        );
      }
      
      const boundTable = table as Table;
      const createSQL = this.generateTableCreateSQL(boundTable, tableName);
      statements.push(createSQL);
    }
    
    return statements.join('\n\n');
  }

  /**
   * Generate CREATE TABLE SQL for a single table
   * This is a basic implementation - may need enhancement for full Drizzle feature support
   */
  private generateTableCreateSQL(table: Table, tableName: string): string {
    const tbl = table as any;
    
    // Try to get table name from table object
    const actualTableName = tbl[Symbol.for('drizzle:Name')] || 
                           tbl._?.name || 
                           tbl.name || 
                           tableName;
    
    // Try to get schema name (for PostgreSQL)
    const schemaName = tbl[Symbol.for('drizzle:Schema')] || 
                      tbl._?.schema || 
                      'public';
    
    // Get columns from table
    const columns = this.extractColumnsFromTable(table);
    
    // Build CREATE TABLE statement
    const dialect = this.detectDialectFromTable(table);
    
    if (dialect === 'pg') {
      return this.generatePostgresCreateTable(schemaName, actualTableName, columns);
    } else if (dialect === 'sqlite') {
      return this.generateSQLiteCreateTable(actualTableName, columns);
    } else {
      throw new Error(`Unsupported dialect for SQL generation: ${dialect}`);
    }
  }

  /**
   * Extract column definitions from a Drizzle table
   */
  private extractColumnsFromTable(table: Table): Array<{
    name: string;
    type: string;
    notNull: boolean;
    primaryKey: boolean;
    default?: any;
  }> {
    const tbl = table as any;
    const columns: Array<{
      name: string;
      type: string;
      notNull: boolean;
      primaryKey: boolean;
      default?: any;
    }> = [];
    
    // Try to access columns from table's internal structure
    // Drizzle stores columns in various ways depending on dialect
    const tableColumns = tbl[Symbol.for('drizzle:Columns')] || 
                       tbl._?.columns || 
                       tbl.columns ||
                       {};
    
    for (const [colName, col] of Object.entries(tableColumns)) {
      const colObj = col as any;
      
      // Extract column information
      const config = colObj.config || colObj._?.config || {};
      const dataType = config.dataType || colObj.dataType || 'text';
      const notNull = config.notNull !== false; // Default to true if not specified
      const primaryKey = config.primary === true || colObj.primaryKey === true;
      const defaultValue = config.default !== undefined ? config.default : undefined;
      
      columns.push({
        name: colName,
        type: dataType,
        notNull,
        primaryKey,
        default: defaultValue,
      });
    }
    
    return columns;
  }

  /**
   * Detect dialect from table object
   */
  private detectDialectFromTable(table: Table): 'pg' | 'sqlite' {
    const tbl = table as any;
    const constructorName = tbl.constructor?.name || '';
    
    if (constructorName.includes('Pg') || constructorName.includes('pg')) {
      return 'pg';
    }
    if (constructorName.includes('SQLite') || constructorName.includes('sqlite')) {
      return 'sqlite';
    }
    
    // Default to pg if we can't determine
    return 'pg';
  }

  /**
   * Generate PostgreSQL CREATE TABLE statement
   */
  private generatePostgresCreateTable(
    schemaName: string,
    tableName: string,
    columns: Array<{
      name: string;
      type: string;
      notNull: boolean;
      primaryKey: boolean;
      default?: any;
    }>
  ): string {
    if (columns.length === 0) {
      throw new Error(`Table "${tableName}" has no columns`);
    }
    
    const columnDefs = columns.map(col => {
      let def = `  "${col.name}" ${col.type.toUpperCase()}`;
      
      if (col.primaryKey) {
        def += ' PRIMARY KEY';
      }
      
      if (col.default !== undefined) {
        if (typeof col.default === 'string') {
          def += ` DEFAULT '${col.default.replace(/'/g, "''")}'`;
        } else {
          def += ` DEFAULT ${col.default}`;
        }
      }
      
      if (col.notNull && !col.primaryKey) {
        def += ' NOT NULL';
      }
      
      return def;
    });
    
    const schemaPrefix = schemaName !== 'public' ? `"${schemaName}".` : '';
    return `CREATE TABLE IF NOT EXISTS ${schemaPrefix}"${tableName}" (\n${columnDefs.join(',\n')}\n);`;
  }

  /**
   * Generate SQLite CREATE TABLE statement
   */
  private generateSQLiteCreateTable(
    tableName: string,
    columns: Array<{
      name: string;
      type: string;
      notNull: boolean;
      primaryKey: boolean;
      default?: any;
    }>
  ): string {
    if (columns.length === 0) {
      throw new Error(`Table "${tableName}" has no columns`);
    }
    
    const columnDefs = columns.map(col => {
      let def = `  "${col.name}" ${col.type.toUpperCase()}`;
      
      if (col.primaryKey) {
        def += ' PRIMARY KEY';
      }
      
      if (col.default !== undefined) {
        if (typeof col.default === 'string') {
          def += ` DEFAULT '${col.default.replace(/'/g, "''")}'`;
        } else {
          def += ` DEFAULT ${col.default}`;
        }
      }
      
      if (col.notNull && !col.primaryKey) {
        def += ' NOT NULL';
      }
      
      return def;
    });
    
    return `CREATE TABLE IF NOT EXISTS "${tableName}" (\n${columnDefs.join(',\n')}\n);`;
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
 * // Generate CREATE script
 * const createSQL = mySchema.generateCreateScript(dialect);
 * ```
 */
export function schema<Tables extends Record<string, UnboundTable | Table>>(
  tables: Tables
): Schema<Tables> {
  return new Schema(tables);
}

