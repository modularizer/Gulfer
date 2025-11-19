/**
 * Snapshot-based SQL Generation
 * 
 * Unified module for generating SQL from schema snapshots:
 * - Generate CREATE TABLE scripts from snapshots
 * - Generate migration SQL from snapshot comparisons
 * - Share common SQL generation logic
 */

import type { TableMetadata, ColumnMetadata } from '../schema-extraction/schema-diff';
import type { SchemaDiff } from '../schema-extraction/schema-diff';
import { DialectSQLGenerator, SQLiteSQLGenerator, PostgreSQLSQLGenerator } from './dialect-sql-generator';

/**
 * Schema snapshot structure (matches migration-generator.ts)
 */
export interface SchemaSnapshot {
  version: number;
  timestamp: number;
  migrationName: string;
  tables: Record<string, TableMetadata>;
  schemaHash: string; // Hash of the sorted tables JSON to uniquely identify the schema
}

/**
 * Get the appropriate SQL generator for a dialect
 */
function getSQLGenerator(dialect: 'sqlite' | 'pg'): DialectSQLGenerator {
  if (dialect === 'pg') {
    return new PostgreSQLSQLGenerator();
  } else {
    return new SQLiteSQLGenerator();
  }
}

/**
 * Serialize a default value to a string representation for storage in snapshot
 * Only stores SQL expressions and literal values - skips application-level functions
 * (Application-level functions like generateUUID are handled in code, not database)
 */
export function serializeDefaultValue(defaultValue: any): string | null {
  if (defaultValue === undefined || defaultValue === null) {
    return null;
  }
  
  // Check if it's a SQL expression (has queryChunks) - these are database-level defaults
  const isSQLExpression = (val: any): boolean => {
    if (val && typeof val === 'object' && val.queryChunks) {
      return true;
    }
    if (typeof val === 'function' && val.queryChunks) {
      return true;
    }
    return false;
  };
  
  // If it's a SQL expression, serialize it
  if (isSQLExpression(defaultValue)) {
    try {
      const queryChunks = defaultValue.queryChunks || (defaultValue as any).queryChunks;
      return JSON.stringify({
        type: 'sql',
        queryChunks: queryChunks,
      });
    } catch (e) {
      return null; // If serialization fails, don't store it
    }
  }
  
  // If it's a function (but not a SQL expression), don't store it
  // Application-level functions are handled in code, not database
  if (typeof defaultValue === 'function') {
    return null;
  }
  
  // If it's already a string, return it
  if (typeof defaultValue === 'string') {
    return defaultValue;
  }
  
  // If it's an object, try to serialize it
  if (defaultValue && typeof defaultValue === 'object') {
    try {
      return JSON.stringify(defaultValue);
    } catch (e) {
      return null; // If serialization fails, don't store it
    }
  }
  
  // Number, boolean, etc. - return as string representation
  return String(defaultValue);
}

/**
 * Deserialize a default value from snapshot
 */
export function deserializeDefaultValue(serialized: string | null | undefined): any {
  if (!serialized) {
    return undefined;
  }
  
  // Check if it's a SQL expression
  if (serialized.startsWith('{"type":"sql"')) {
    try {
      return JSON.parse(serialized);
    } catch (e) {
      return serialized;
    }
  }
  
  // Check if it's a function reference
  if (serialized.startsWith('function:')) {
    // Return a marker object that can be recognized later
    return { __type: 'function', name: serialized.substring(9) };
  }
  
  // Try to parse as JSON
  try {
    return JSON.parse(serialized);
  } catch (e) {
    // Return as string if not JSON
    return serialized;
  }
}

/**
 * Generate column SQL from column metadata
 */
function generateColumnSQLFromMetadata(
  col: ColumnMetadata,
  dialect: 'sqlite' | 'pg'
): string {
  const generator = getSQLGenerator(dialect);
  
  // Build column definition
  let colDef = `"${col.name}" ${col.type}`;
  
  // Add NOT NULL if not nullable
  if (!col.nullable) {
    colDef += ' NOT NULL';
  }
  
  // Add DEFAULT if has default (only database-level defaults)
  if (col.hasDefault && col.defaultValue !== undefined) {
    const defaultValue = col.defaultValue;
    
    // Handle different default value types
    if (defaultValue && typeof defaultValue === 'object' && defaultValue.type === 'sql') {
      // SQL expression - extract from queryChunks
      if (defaultValue.queryChunks && Array.isArray(defaultValue.queryChunks)) {
        const sqlParts = defaultValue.queryChunks.map((chunk: any) => {
          if (chunk.value) {
            return Array.isArray(chunk.value) ? chunk.value.join(' ') : chunk.value;
          }
          return '';
        }).filter((s: string) => s).join(' ');
        if (sqlParts) {
          colDef += ` DEFAULT ${sqlParts}`;
        }
      }
    } else if (typeof defaultValue === 'string') {
      // String literal
      colDef += ` DEFAULT '${defaultValue.replace(/'/g, "''")}'`;
    } else if (typeof defaultValue === 'number' || typeof defaultValue === 'boolean') {
      // Number or boolean literal
      colDef += ` DEFAULT ${defaultValue}`;
    } else if (defaultValue === null) {
      // NULL default
      colDef += ` DEFAULT NULL`;
    }
    // Note: Application-level functions are not included (hasDefault is false for those)
  }
  
  // Note: Primary keys and unique constraints are handled at table level,
  // not in individual column definitions
  
  return colDef;
}

/**
 * Generate CREATE TABLE SQL from table metadata
 */
export function generateCreateTableFromSnapshot(
  tableName: string,
  tableMetadata: TableMetadata,
  dialect: 'sqlite' | 'pg',
  options: { ifNotExists?: boolean } = {}
): string {
  const generator = getSQLGenerator(dialect);
  const columnDefs: string[] = [];
  
  // Generate column definitions
  for (const col of Object.values(tableMetadata.columns)) {
    const colSQL = generateColumnSQLFromMetadata(col, dialect);
    columnDefs.push(colSQL);
  }
  
  // Add primary key constraint
  if (tableMetadata.primaryKeys.length > 0) {
    const pkColumns = tableMetadata.primaryKeys.map(name => `"${name}"`).join(', ');
    if (pkColumns) {
      columnDefs.push(`PRIMARY KEY (${pkColumns})`);
    }
  }
  
  // Add unique constraints
  for (const unique of tableMetadata.uniqueConstraints) {
    const uniqueColumns = unique.columns.map(name => `"${name}"`).join(', ');
    if (uniqueColumns) {
      if (unique.name) {
        columnDefs.push(`CONSTRAINT "${unique.name}" UNIQUE (${uniqueColumns})`);
      } else {
        columnDefs.push(`UNIQUE (${uniqueColumns})`);
      }
    }
  }
  
  // Add foreign key constraints
  for (const fk of tableMetadata.foreignKeys) {
    const localColumns = fk.localColumns.map(name => `"${name}"`).join(', ');
    const refColumns = fk.refColumns.map(name => `"${name}"`).join(', ');
    if (localColumns && refColumns) {
      columnDefs.push(`FOREIGN KEY (${localColumns}) REFERENCES "${fk.refTable}" (${refColumns})`);
    }
  }
  
  // Generate CREATE TABLE statement
  return generator.generateCreateTableSQL(tableName, columnDefs, {
    ifNotExists: options.ifNotExists !== false,
  });
}

/**
 * Generate CREATE TABLE scripts for all tables in a snapshot
 */
export function generateCreateScriptFromSnapshot(
  snapshot: SchemaSnapshot,
  dialect: 'sqlite' | 'pg',
  options: { ifNotExists?: boolean } = {}
): string {
  const statements: string[] = [];
  
  // Generate CREATE TABLE for each table
  for (const [tableName, tableMetadata] of Object.entries(snapshot.tables)) {
    const createSQL = generateCreateTableFromSnapshot(tableName, tableMetadata, dialect, options);
    statements.push(createSQL);
  }
  
  return statements.join('\n\n');
}

/**
 * Generate migration SQL from schema diff and new snapshot
 */
export function generateMigrationFromSnapshotDiff(
  diff: SchemaDiff,
  newSnapshot: SchemaSnapshot,
  dialect: 'sqlite' | 'pg'
): string {
  const statements: string[] = [];
  
  // Handle removed tables
  for (const tableName of diff.removedTables) {
    statements.push(`DROP TABLE IF EXISTS "${tableName}";`);
  }
  
  // Handle added tables - generate CREATE TABLE from snapshot
  for (const tableName of diff.addedTables) {
    const tableMetadata = newSnapshot.tables[tableName];
    if (tableMetadata) {
      const createSQL = generateCreateTableFromSnapshot(tableName, tableMetadata, dialect, { ifNotExists: false });
      statements.push(createSQL);
    }
  }
  
  // Handle modified tables
  for (const tableDiff of diff.modifiedTables) {
    const tableName = tableDiff.tableName;
    const tableMetadata = newSnapshot.tables[tableName];
    
    if (!tableMetadata) continue;
    
    // Handle removed columns
    for (const colName of tableDiff.removedColumns) {
      statements.push(`ALTER TABLE "${tableName}" DROP COLUMN "${colName}";`);
    }
    
    // Handle added columns
    for (const colName of tableDiff.addedColumns) {
      const col = tableMetadata.columns[colName];
      if (col) {
        const colSQL = generateColumnSQLFromMetadata(col, dialect);
        statements.push(`ALTER TABLE "${tableName}" ADD COLUMN ${colSQL};`);
      }
    }
    
    // Handle modified columns - SQLite doesn't support MODIFY COLUMN, so we need to recreate
    if (dialect === 'sqlite') {
      // SQLite requires recreating the table for column modifications
      // This is complex, so for now we'll just log a warning
      if (tableDiff.modifiedColumns.length > 0) {
        statements.push(`-- WARNING: SQLite does not support ALTER COLUMN. Manual migration required for: ${tableDiff.modifiedColumns.map(c => c.columnName).join(', ')}`);
      }
    } else {
      // PostgreSQL supports ALTER COLUMN
      for (const modifiedCol of tableDiff.modifiedColumns) {
        const col = tableMetadata.columns[modifiedCol.columnName];
        if (col) {
          // Generate ALTER COLUMN statements for each change
          for (const change of modifiedCol.changes) {
            if (change.includes('type:')) {
              statements.push(`ALTER TABLE "${tableName}" ALTER COLUMN "${col.name}" TYPE ${col.type};`);
            }
            if (change.includes('nullable:')) {
              if (col.nullable) {
                statements.push(`ALTER TABLE "${tableName}" ALTER COLUMN "${col.name}" DROP NOT NULL;`);
              } else {
                statements.push(`ALTER TABLE "${tableName}" ALTER COLUMN "${col.name}" SET NOT NULL;`);
              }
            }
            if (change.includes('defaultValue:')) {
              if (col.hasDefault && col.defaultValue !== undefined) {
                // Add DEFAULT
                const defaultValue = col.defaultValue;
                if (defaultValue && typeof defaultValue === 'object' && defaultValue.type === 'sql') {
                  // SQL expression
                  if (defaultValue.queryChunks && Array.isArray(defaultValue.queryChunks)) {
                    const sqlParts = defaultValue.queryChunks.map((chunk: any) => {
                      if (chunk.value) {
                        return Array.isArray(chunk.value) ? chunk.value.join(' ') : chunk.value;
                      }
                      return '';
                    }).filter((s: string) => s).join(' ');
                    if (sqlParts) {
                      statements.push(`ALTER TABLE "${tableName}" ALTER COLUMN "${col.name}" SET DEFAULT ${sqlParts};`);
                    }
                  }
                } else if (typeof defaultValue === 'string') {
                  statements.push(`ALTER TABLE "${tableName}" ALTER COLUMN "${col.name}" SET DEFAULT '${defaultValue.replace(/'/g, "''")}';`);
                } else if (typeof defaultValue === 'number' || typeof defaultValue === 'boolean') {
                  statements.push(`ALTER TABLE "${tableName}" ALTER COLUMN "${col.name}" SET DEFAULT ${defaultValue};`);
                } else if (defaultValue === null) {
                  statements.push(`ALTER TABLE "${tableName}" ALTER COLUMN "${col.name}" SET DEFAULT NULL;`);
                }
              } else {
                statements.push(`ALTER TABLE "${tableName}" ALTER COLUMN "${col.name}" DROP DEFAULT;`);
              }
            }
          }
        }
      }
    }
    
    // Handle removed foreign keys
    for (const fk of tableDiff.removedForeignKeys) {
      // PostgreSQL: Need constraint name to drop FK
      // For now, we'll use a generated name
      const constraintName = `fk_${tableName}_${fk.localColumns.join('_')}`;
      statements.push(`ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "${constraintName}";`);
    }
    
    // Handle added foreign keys
    for (const fk of tableDiff.addedForeignKeys) {
      const localColumns = fk.localColumns.map(name => `"${name}"`).join(', ');
      const refColumns = fk.refColumns.map(name => `"${name}"`).join(', ');
      if (localColumns && refColumns) {
        statements.push(`ALTER TABLE "${tableName}" ADD FOREIGN KEY (${localColumns}) REFERENCES "${fk.refTable}" (${refColumns});`);
      }
    }
    
    // Handle removed unique constraints
    for (const unique of tableDiff.removedUniqueConstraints) {
      if (unique.name) {
        statements.push(`ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "${unique.name}";`);
      } else {
        // Generate constraint name
        const constraintName = `uq_${tableName}_${unique.columns.join('_')}`;
        statements.push(`ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "${constraintName}";`);
      }
    }
    
    // Handle added unique constraints
    for (const unique of tableDiff.addedUniqueConstraints) {
      const uniqueColumns = unique.columns.map(name => `"${name}"`).join(', ');
      if (uniqueColumns) {
        if (unique.name) {
          statements.push(`ALTER TABLE "${tableName}" ADD CONSTRAINT "${unique.name}" UNIQUE (${uniqueColumns});`);
        } else {
          statements.push(`ALTER TABLE "${tableName}" ADD UNIQUE (${uniqueColumns});`);
        }
      }
    }
    
    // Handle removed indexes
    for (const idx of tableDiff.removedIndexes) {
      statements.push(`DROP INDEX IF EXISTS "${idx.name}";`);
    }
    
    // Handle added indexes
    for (const idx of tableDiff.addedIndexes) {
      const indexColumns = idx.columns.map(name => `"${name}"`).join(', ');
      if (indexColumns) {
        const uniqueClause = idx.unique ? 'UNIQUE ' : '';
        statements.push(`CREATE ${uniqueClause}INDEX "${idx.name}" ON "${tableName}" (${indexColumns});`);
      }
    }
  }
  
  return statements.join('\n');
}

