/**
 * Migration Generator
 * 
 * Generates migration SQL from schema differences.
 * Can generate both initial migrations and incremental migrations.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Schema } from '../schema';
import type { SQLDialect } from '../dialects/types';
import { getDialectFromName } from '../dialects';
import { bindTable, isUTable } from '../dialects/implementations/unbound';
import { generateCreateScriptForTable, generateCreateScriptForSchema } from './generate-create-script';
import { diffSchemas, extractTableMetadata } from './schema-diff';
import { Table, getTableName } from 'drizzle-orm';
import * as crypto from 'crypto';

/**
 * Migration file structure
 */
export interface MigrationFile {
  name: string;
  hash: string;
  sql: string;
  postgres?: string;
  timestamp: number;
}

/**
 * Options for generating migrations
 */
export interface GenerateMigrationOptions {
  /**
   * Path to the migrations directory (will create per-dialect subdirectories)
   */
  migrationsDir: string;
  
  /**
   * Unbound schema to generate migrations for
   */
  schema: Schema<any>;
  
  /**
   * Optional: Path to existing migration files to compare against
   * If not provided, will generate initial migration
   */
  existingMigrationsPath?: string;
  
  /**
   * Optional: Database connection for schema introspection
   * If provided, will use this to detect the current schema
   */
  database?: any; // XPDatabaseConnectionPlus
  
  /**
   * Optional: Custom migration name (defaults to timestamp-based name)
   */
  migrationName?: string;
  
  /**
   * Optional: Whether to generate for all dialects or just specific ones
   */
  dialects?: ('sqlite' | 'pg')[];
}

/**
 * Result of migration generation
 */
export interface GenerateMigrationResult {
  /**
   * Paths to generated migration files
   */
  migrationFiles: Array<{
    dialect: 'sqlite' | 'pg';
    path: string;
    hash: string;
  }>;
  
  /**
   * Whether this was an initial migration or an incremental one
   */
  isInitial: boolean;
  
  /**
   * Schema differences detected (if incremental)
   */
  diff?: import('./schema-diff').SchemaDiff;
}

/**
 * Load existing migrations from a directory
 */
function loadExistingMigrations(migrationsPath: string): MigrationFile[] {
  if (!fs.existsSync(migrationsPath)) {
    return [];
  }
  
  const files = fs.readdirSync(migrationsPath)
    .filter(f => f.endsWith('.sql') || f.endsWith('.ts') || f.endsWith('.js'))
    .sort();
  
  const migrations: MigrationFile[] = [];
  
  for (const file of files) {
    const filePath = path.join(migrationsPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Extract migration name from filename (e.g., "0001_initial.sql" -> "0001_initial")
    const name = path.basename(file, path.extname(file));
    
    // Generate hash from content
    const hash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    
    // Get file stats for timestamp
    const stats = fs.statSync(filePath);
    
    migrations.push({
      name,
      hash,
      sql: content,
      timestamp: stats.mtimeMs,
    });
  }
  
  return migrations;
}

/**
 * Get the latest migration's schema by using database introspection
 * If a database connection is available, we can introspect the current schema
 */
async function getLatestSchemaFromDatabase(
  db: any, // XPDatabaseConnectionPlus
  dialect: 'sqlite' | 'pg',
  dialectObj: SQLDialect
): Promise<Record<string, Table> | undefined> {
  if (!db || typeof db.detectRuntimeSchema !== 'function') {
    return undefined;
  }
  
  try {
    // Use the database's detectRuntimeSchema method
    const schema = await db.detectRuntimeSchema();
    return schema;
  } catch (error) {
    console.warn('Could not introspect database schema:', error);
    return undefined;
  }
}

/**
 * Generate migration SQL from schema differences
 */
function generateMigrationSQL(
  diff: import('./schema-diff').SchemaDiff,
  newSchema: Record<string, Table>,
  dialect: 'sqlite' | 'pg'
): string {
  const statements: string[] = [];
  
  // Handle removed tables
  for (const tableName of diff.removedTables) {
    statements.push(`DROP TABLE IF EXISTS "${tableName}";`);
  }
  
  // Handle added tables - generate CREATE TABLE for new tables
  for (const tableName of diff.addedTables) {
    const table = newSchema[tableName];
    if (table) {
      // We'll generate the full CREATE TABLE SQL separately
      // For now, add a placeholder
      statements.push(`-- CREATE TABLE "${tableName}" (generated separately)`);
    }
  }
  
  // Handle modified tables
  for (const tableDiff of diff.modifiedTables) {
    const tableName = tableDiff.tableName;
    const table = newSchema[tableName];
    
    if (!table) continue;
    
    // Handle removed columns
    for (const colName of tableDiff.removedColumns) {
      statements.push(`ALTER TABLE "${tableName}" DROP COLUMN "${colName}";`);
    }
    
    // Handle added columns
    for (const colName of tableDiff.addedColumns) {
      const metadata = extractTableMetadata(table, dialect);
      const col = metadata.columns[colName];
      if (col) {
        // Generate column definition
        let colDef = `"${colName}" ${col.type}`;
        if (col.isPrimaryKey) colDef += ' PRIMARY KEY';
        if (col.isUnique) colDef += ' UNIQUE';
        if (!col.nullable) colDef += ' NOT NULL';
        if (col.hasDefault && col.defaultValue !== undefined) {
          if (typeof col.defaultValue === 'string') {
            colDef += ` DEFAULT '${col.defaultValue.replace(/'/g, "''")}'`;
          } else {
            colDef += ` DEFAULT ${col.defaultValue}`;
          }
        }
        statements.push(`ALTER TABLE "${tableName}" ADD COLUMN ${colDef};`);
      }
    }
    
    // Handle modified columns (simplified - in practice, you might need to recreate the column)
    for (const colChange of tableDiff.modifiedColumns) {
      statements.push(`-- TODO: Modify column "${colChange.columnName}" in table "${tableName}"`);
      statements.push(`-- Changes: ${colChange.changes.join(', ')}`);
      statements.push(`-- Note: Some column modifications may require recreating the table`);
    }
    
    // Handle removed foreign keys
    for (const fk of tableDiff.removedForeignKeys) {
      // SQLite doesn't support DROP CONSTRAINT, so we'd need to recreate the table
      // PostgreSQL supports: ALTER TABLE ... DROP CONSTRAINT ...
      if (dialect === 'pg') {
        statements.push(`-- TODO: Drop foreign key constraint (requires constraint name)`);
      } else {
        statements.push(`-- TODO: Drop foreign key (SQLite requires table recreation)`);
      }
    }
    
    // Handle added foreign keys
    for (const fk of tableDiff.addedForeignKeys) {
      const localCols = fk.localColumns.map(c => `"${c}"`).join(', ');
      const refCols = fk.refColumns.map(c => `"${c}"`).join(', ');
      statements.push(`ALTER TABLE "${tableName}" ADD FOREIGN KEY (${localCols}) REFERENCES "${fk.refTable}" (${refCols});`);
    }
    
    // Handle removed unique constraints
    for (const unique of tableDiff.removedUniqueConstraints) {
      if (dialect === 'pg') {
        statements.push(`-- TODO: Drop unique constraint (requires constraint name)`);
      } else {
        statements.push(`-- TODO: Drop unique constraint (SQLite requires table recreation)`);
      }
    }
    
    // Handle added unique constraints
    for (const unique of tableDiff.addedUniqueConstraints) {
      const cols = unique.columns.map(c => `"${c}"`).join(', ');
      const constraintName = unique.name || `unique_${tableName}_${unique.columns.join('_')}`;
      statements.push(`CREATE UNIQUE INDEX IF NOT EXISTS "${constraintName}" ON "${tableName}" (${cols});`);
    }
    
    // Handle removed indexes
    for (const idx of tableDiff.removedIndexes) {
      statements.push(`DROP INDEX IF EXISTS "${idx.name}";`);
    }
    
    // Handle added indexes
    for (const idx of tableDiff.addedIndexes) {
      const cols = idx.columns.map(c => `"${c}"`).join(', ');
      const uniqueKeyword = idx.unique ? 'UNIQUE ' : '';
      statements.push(`CREATE ${uniqueKeyword}INDEX IF NOT EXISTS "${idx.name}" ON "${tableName}" (${cols});`);
    }
  }
  
  return statements.join('\n');
}

/**
 * Generate migrations for a schema
 */
export async function generateMigrations(
  options: GenerateMigrationOptions
): Promise<GenerateMigrationResult> {
  const {
    migrationsDir,
    schema,
    existingMigrationsPath,
    migrationName,
    dialects = ['sqlite', 'pg'],
  } = options;
  
  // Ensure migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }
  
  const result: GenerateMigrationResult = {
    migrationFiles: [],
    isInitial: !existingMigrationsPath || !fs.existsSync(existingMigrationsPath),
  };
  
  // Bind schema to each dialect and generate migrations
  for (const dialectName of dialects) {
    const dialectObj = await getDialectFromName(dialectName);
    const dialectDir = path.join(migrationsDir, dialectName);
    
    // Create dialect-specific directory
    if (!fs.existsSync(dialectDir)) {
      fs.mkdirSync(dialectDir, { recursive: true });
    }
    
    // Bind all tables to this dialect
    const boundTables: Record<string, Table> = {};
    for (const [tableName, table] of Object.entries(schema.tables)) {
      if (isUTable(table)) {
        boundTables[tableName] = bindTable(table, dialectObj);
      } else {
        boundTables[tableName] = table as Table;
      }
    }
    
    // Load existing migrations for this dialect
    const existingMigrations = existingMigrationsPath
      ? loadExistingMigrations(path.join(existingMigrationsPath, dialectName))
      : [];
    
    // Determine if this is an initial migration
    const isInitial = existingMigrations.length === 0;
    
    let migrationSQL = '';
    let diff: import('./schema-diff').SchemaDiff | undefined;
    
    if (isInitial) {
      // Generate initial migration - full CREATE TABLE statements
      migrationSQL = await generateCreateScriptForSchema(schema, dialectName as any, { ifNotExists: false });
    } else {
      // Generate incremental migration
      // Try to get the old schema from database introspection first
      let oldSchema: Record<string, Table> | undefined = undefined;
      
      if (options.database) {
        // Only use database introspection if the dialect matches
        const dbDialect = options.database.dialect?.dialectName;
        if (dbDialect === dialectName || (dbDialect === 'pg' && dialectName === 'pg')) {
          oldSchema = await getLatestSchemaFromDatabase(options.database, dialectName, dialectObj);
        }
      }
      
      // If we have an old schema, compare and generate diff
      if (oldSchema) {
        diff = await diffSchemas(oldSchema, boundTables, dialectName);
        result.diff = diff;
        
        // Generate migration SQL from differences
        const diffSQL = generateMigrationSQL(diff, boundTables, dialectName);
        
        // Also generate CREATE TABLE for new tables
        const newTableSQLs: string[] = [];
        for (const tableName of diff.addedTables) {
          const table = boundTables[tableName];
          if (table) {
            const createSQL = await generateCreateScriptForTable(table, dialectName as any, { ifNotExists: false });
            newTableSQLs.push(createSQL);
          }
        }
        
        migrationSQL = [...newTableSQLs, diffSQL].filter(s => s.trim()).join('\n\n');
      } else {
        // Can't determine old schema - generate full CREATE script with IF NOT EXISTS
        // and add a comment that this should be reviewed
        migrationSQL = `-- WARNING: This migration was generated without schema comparison.
-- The current database schema could not be determined automatically.
-- Please review and modify this migration as needed.
--
-- This migration includes CREATE TABLE IF NOT EXISTS statements.
-- You may need to add ALTER TABLE statements for schema changes.
--

${await generateCreateScriptForSchema(schema, dialectName as any, { ifNotExists: true })}`;
      }
    }
    
    // Generate migration name
    const timestamp = Date.now();
    const name = migrationName || `${String(existingMigrations.length + 1).padStart(4, '0')}_${isInitial ? 'initial' : 'migration'}`;
    
    // Generate hash
    const hash = crypto.createHash('sha256').update(migrationSQL).digest('hex').substring(0, 16);
    
    // Write migration file
    const migrationFileName = `${name}.sql`;
    const migrationFilePath = path.join(dialectDir, migrationFileName);
    
    // Add header comment
    const header = `-- Migration: ${name}
-- Hash: ${hash}
-- Generated: ${new Date().toISOString()}
-- Dialect: ${dialectName}
--

`;
    
    fs.writeFileSync(migrationFilePath, header + migrationSQL);
    
    result.migrationFiles.push({
      dialect: dialectName,
      path: migrationFilePath,
      hash,
    });
  }
  
  return result;
}

