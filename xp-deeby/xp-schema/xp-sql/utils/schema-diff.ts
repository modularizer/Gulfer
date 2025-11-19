/**
 * Schema Diffing Utilities
 * 
 * Compares two schemas and detects differences:
 * - Added/removed tables
 * - Added/removed/modified columns
 * - Added/removed/modified constraints (primary keys, foreign keys, unique, indexes)
 */

import type { Table } from 'drizzle-orm';
import type { UTable } from '../dialects/implementations/unbound';
import type { Schema } from '../schema';
import { isUTable } from '../dialects/implementations/unbound';
import { getTableName } from 'drizzle-orm';

/**
 * Column metadata extracted from a table
 */
export interface ColumnMetadata {
  name: string;
  type: string;
  nullable: boolean;
  hasDefault: boolean;
  isPrimaryKey: boolean;
  isUnique: boolean;
  defaultValue?: any;
}

/**
 * Table metadata extracted from a schema
 */
export interface TableMetadata {
  name: string;
  columns: Record<string, ColumnMetadata>;
  primaryKeys: string[];
  foreignKeys: Array<{
    localColumns: string[];
    refTable: string;
    refColumns: string[];
  }>;
  uniqueConstraints: Array<{
    name?: string;
    columns: string[];
  }>;
  indexes: Array<{
    name: string;
    columns: string[];
    unique: boolean;
  }>;
}

/**
 * Schema differences detected between two schemas
 */
export interface SchemaDiff {
  addedTables: string[];
  removedTables: string[];
  modifiedTables: Array<{
    tableName: string;
    addedColumns: string[];
    removedColumns: string[];
    modifiedColumns: Array<{
      columnName: string;
      changes: string[];
    }>;
    addedForeignKeys: Array<{
      localColumns: string[];
      refTable: string;
      refColumns: string[];
    }>;
    removedForeignKeys: Array<{
      localColumns: string[];
      refTable: string;
      refColumns: string[];
    }>;
    addedUniqueConstraints: Array<{
      name?: string;
      columns: string[];
    }>;
    removedUniqueConstraints: Array<{
      name?: string;
      columns: string[];
    }>;
    addedIndexes: Array<{
      name: string;
      columns: string[];
      unique: boolean;
    }>;
    removedIndexes: Array<{
      name: string;
      columns: string[];
      unique: boolean;
    }>;
  }>;
}

/**
 * Extract column metadata from a table config
 */
function extractColumnMetadata(column: any): ColumnMetadata {
  return {
    name: column.name || '',
    type: column.columnType || column.dataType || 'unknown',
    nullable: column.notNull !== true,
    hasDefault: column.hasDefault === true,
    isPrimaryKey: column.primary === true,
    isUnique: column.isUnique === true,
    defaultValue: column.default,
  };
}

/**
 * Extract table metadata from a bound table using Drizzle's getTableConfig
 */
export function extractTableMetadata(
  table: Table,
  dialect: 'sqlite' | 'pg'
): TableMetadata {
  // Get table config using Drizzle's utility
  let getTableConfig: any;
  if (dialect === 'pg') {
    getTableConfig = require('drizzle-orm/pg-core').getTableConfig;
  } else {
    getTableConfig = require('drizzle-orm/sqlite-core').getTableConfig;
  }
  
  const config = getTableConfig(table);
  const tableName = config.name || getTableName(table);
  
  // Extract columns
  const columns: Record<string, ColumnMetadata> = {};
  const columnKeys = Array.isArray(config.columns)
    ? Object.keys(config.columns).map(k => parseInt(k)).sort((a, b) => a - b).map(k => k.toString())
    : Object.keys(config.columns);
  
  for (const key of columnKeys) {
    const column = config.columns[key];
    if (column) {
      const metadata = extractColumnMetadata(column);
      columns[metadata.name] = metadata;
    }
  }
  
  // Extract primary keys
  const primaryKeys: string[] = [];
  if (config.primaryKeys && Array.isArray(config.primaryKeys)) {
    for (const pk of config.primaryKeys) {
      const colName = pk?.name || pk?.column?.name || (typeof pk === 'string' ? pk : '');
      if (colName) {
        primaryKeys.push(colName);
      }
    }
  }
  
  // Extract foreign keys
  const foreignKeys: Array<{ localColumns: string[]; refTable: string; refColumns: string[] }> = [];
  if (config.foreignKeys && Array.isArray(config.foreignKeys)) {
    for (const fk of config.foreignKeys) {
      const localColumns: string[] = [];
      if (fk.columns && Array.isArray(fk.columns)) {
        localColumns.push(...fk.columns.map((col: any) => col?.name || (typeof col === 'string' ? col : '')).filter((n: string) => n));
      }
      
      let refTable = '';
      let refColumns: string[] = [];
      
      if (fk.reference && typeof fk.reference === 'function') {
        try {
          const refTableObj = fk.reference();
          refTable = getTableName(refTableObj);
          if (fk.foreignColumns && Array.isArray(fk.foreignColumns)) {
            refColumns = fk.foreignColumns.map((col: any) => col?.name || (typeof col === 'string' ? col : '')).filter((n: string) => n);
          }
        } catch (e) {
          // Skip if we can't resolve
        }
      }
      
      if (localColumns.length > 0 && refTable && refColumns.length > 0) {
        foreignKeys.push({ localColumns, refTable, refColumns });
      }
    }
  }
  
  // Extract unique constraints
  const uniqueConstraints: Array<{ name?: string; columns: string[] }> = [];
  if (config.uniqueConstraints && Array.isArray(config.uniqueConstraints)) {
    for (const unique of config.uniqueConstraints) {
      if (unique?.columns && Array.isArray(unique.columns)) {
        const columns = unique.columns.map((col: any) => col?.name || (typeof col === 'string' ? col : '')).filter((n: string) => n);
        if (columns.length > 0) {
          uniqueConstraints.push({
            name: unique.name,
            columns,
          });
        }
      }
    }
  }
  
  // Extract indexes
  const indexes: Array<{ name: string; columns: string[]; unique: boolean }> = [];
  const tableAny = table as any;
  let indexList: any[] = [];
  
  if (config.indexes && Array.isArray(config.indexes)) {
    indexList = config.indexes;
  } else {
    // Try to get from table object
    if (tableAny[Symbol.for('drizzle:Indexes')]) {
      indexList = tableAny[Symbol.for('drizzle:Indexes')];
    } else if (tableAny._?.indexes) {
      indexList = tableAny._?.indexes;
    }
  }
  
  for (const idx of indexList) {
    if (!idx) continue;
    const indexName = idx.config?.name || idx.name || idx._?.name || '';
    if (!indexName) continue;
    
    const indexColumns: string[] = [];
    const idxColumns = idx.config?.columns || idx.columns;
    if (idxColumns && Array.isArray(idxColumns)) {
      indexColumns.push(...idxColumns.map((col: any) => col?.name || (typeof col === 'string' ? col : '')).filter((n: string) => n));
    }
    
    if (indexColumns.length > 0) {
      const isUnique = idx.config?.unique || idx.unique || idx._?.unique || false;
      indexes.push({
        name: indexName,
        columns: indexColumns,
        unique: isUnique,
      });
    }
  }
  
  return {
    name: tableName,
    columns,
    primaryKeys,
    foreignKeys,
    uniqueConstraints,
    indexes,
  };
}

/**
 * Compare two table metadata objects and return differences
 */
function compareTables(
  oldTable: TableMetadata,
  newTable: TableMetadata
): SchemaDiff['modifiedTables'][0] | null {
  const changes: SchemaDiff['modifiedTables'][0] = {
    tableName: newTable.name,
    addedColumns: [],
    removedColumns: [],
    modifiedColumns: [],
    addedForeignKeys: [],
    removedForeignKeys: [],
    addedUniqueConstraints: [],
    removedUniqueConstraints: [],
    addedIndexes: [],
    removedIndexes: [],
  };
  
  // Compare columns
  const oldColumnNames = new Set(Object.keys(oldTable.columns));
  const newColumnNames = new Set(Object.keys(newTable.columns));
  
  // Added columns
  for (const colName of newColumnNames) {
    if (!oldColumnNames.has(colName)) {
      changes.addedColumns.push(colName);
    }
  }
  
  // Removed columns
  for (const colName of oldColumnNames) {
    if (!newColumnNames.has(colName)) {
      changes.removedColumns.push(colName);
    }
  }
  
  // Modified columns
  for (const colName of oldColumnNames) {
    if (newColumnNames.has(colName)) {
      const oldCol = oldTable.columns[colName];
      const newCol = newTable.columns[colName];
      const columnChanges: string[] = [];
      
      if (oldCol.type !== newCol.type) {
        columnChanges.push(`type: ${oldCol.type} -> ${newCol.type}`);
      }
      if (oldCol.nullable !== newCol.nullable) {
        columnChanges.push(`nullable: ${oldCol.nullable} -> ${newCol.nullable}`);
      }
      if (oldCol.hasDefault !== newCol.hasDefault) {
        columnChanges.push(`hasDefault: ${oldCol.hasDefault} -> ${newCol.hasDefault}`);
      }
      if (oldCol.isPrimaryKey !== newCol.isPrimaryKey) {
        columnChanges.push(`isPrimaryKey: ${oldCol.isPrimaryKey} -> ${newCol.isPrimaryKey}`);
      }
      if (oldCol.isUnique !== newCol.isUnique) {
        columnChanges.push(`isUnique: ${oldCol.isUnique} -> ${newCol.isUnique}`);
      }
      
      if (columnChanges.length > 0) {
        changes.modifiedColumns.push({
          columnName: colName,
          changes: columnChanges,
        });
      }
    }
  }
  
  // Compare foreign keys (simple comparison by column names)
  const oldFKs = new Set(oldTable.foreignKeys.map(fk => JSON.stringify(fk)));
  const newFKs = new Set(newTable.foreignKeys.map(fk => JSON.stringify(fk)));
  
  for (const fk of newTable.foreignKeys) {
    if (!oldFKs.has(JSON.stringify(fk))) {
      changes.addedForeignKeys.push(fk);
    }
  }
  
  for (const fk of oldTable.foreignKeys) {
    if (!newFKs.has(JSON.stringify(fk))) {
      changes.removedForeignKeys.push(fk);
    }
  }
  
  // Compare unique constraints
  const oldUniques = new Set(oldTable.uniqueConstraints.map(u => JSON.stringify(u)));
  const newUniques = new Set(newTable.uniqueConstraints.map(u => JSON.stringify(u)));
  
  for (const u of newTable.uniqueConstraints) {
    if (!oldUniques.has(JSON.stringify(u))) {
      changes.addedUniqueConstraints.push(u);
    }
  }
  
  for (const u of oldTable.uniqueConstraints) {
    if (!newUniques.has(JSON.stringify(u))) {
      changes.removedUniqueConstraints.push(u);
    }
  }
  
  // Compare indexes
  const oldIndexes = new Set(oldTable.indexes.map(i => JSON.stringify(i)));
  const newIndexes = new Set(newTable.indexes.map(i => JSON.stringify(i)));
  
  for (const idx of newTable.indexes) {
    if (!oldIndexes.has(JSON.stringify(idx))) {
      changes.addedIndexes.push(idx);
    }
  }
  
  for (const idx of oldTable.indexes) {
    if (!newIndexes.has(JSON.stringify(idx))) {
      changes.removedIndexes.push(idx);
    }
  }
  
  // Return null if no changes
  if (
    changes.addedColumns.length === 0 &&
    changes.removedColumns.length === 0 &&
    changes.modifiedColumns.length === 0 &&
    changes.addedForeignKeys.length === 0 &&
    changes.removedForeignKeys.length === 0 &&
    changes.addedUniqueConstraints.length === 0 &&
    changes.removedUniqueConstraints.length === 0 &&
    changes.addedIndexes.length === 0 &&
    changes.removedIndexes.length === 0
  ) {
    return null;
  }
  
  return changes;
}

/**
 * Compare two schemas and return differences
 * 
 * @param oldSchema - Old schema (can be undefined for initial migration)
 * @param newSchema - New schema (bound to the target dialect)
 * @param dialect - SQL dialect ('sqlite' or 'pg')
 */
export async function diffSchemas(
  oldSchema: Record<string, Table> | undefined,
  newSchema: Record<string, Table>,
  dialect: 'sqlite' | 'pg'
): Promise<SchemaDiff> {
  const diff: SchemaDiff = {
    addedTables: [],
    removedTables: [],
    modifiedTables: [],
  };
  
  const oldTableNames = oldSchema ? new Set(Object.keys(oldSchema)) : new Set<string>();
  const newTableNames = new Set(Object.keys(newSchema));
  
  // Find added tables
  for (const tableName of newTableNames) {
    if (!oldTableNames.has(tableName)) {
      diff.addedTables.push(tableName);
    }
  }
  
  // Find removed tables
  for (const tableName of oldTableNames) {
    if (!newTableNames.has(tableName)) {
      diff.removedTables.push(tableName);
    }
  }
  
  // Compare existing tables
  for (const tableName of oldTableNames) {
    if (newTableNames.has(tableName)) {
      const oldTable = oldSchema![tableName];
      const newTable = newSchema[tableName];
      
      const oldMetadata = extractTableMetadata(oldTable, dialect);
      const newMetadata = extractTableMetadata(newTable, dialect);
      
      const tableDiff = compareTables(oldMetadata, newMetadata);
      if (tableDiff) {
        diff.modifiedTables.push(tableDiff);
      }
    }
  }
  
  return diff;
}

