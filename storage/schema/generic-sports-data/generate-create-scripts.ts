/**
 * Generate Re-Runnable CREATE Scripts
 * 
 * Generates CREATE IF NOT EXISTS scripts for each database dialect.
 * These scripts are idempotent and can be run multiple times safely.
 * No migration tracking needed - each client runs the scripts on their own database.
 * 
 * Dialects: SQLite, PostgreSQL
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const PROJECT_ROOT = path.join(__dirname, '../../../');
const SCRIPTS_DIR = path.join(__dirname, './create-scripts');

interface CreateScript {
  dialect: string;
  sql: string;
  hash: string;
}

/**
 * Convert CREATE TABLE to CREATE TABLE IF NOT EXISTS (idempotent)
 */
function makeIdempotent(sql: string): string {
  let result = sql;
  
  // Remove statement-breakpoint comments first
  result = result.replace(/--> statement-breakpoint\n/gi, '');
  
  // Replace CREATE TABLE with CREATE TABLE IF NOT EXISTS (only if not already present)
  // Match: CREATE TABLE (optional quotes) table_name
  // But NOT: CREATE TABLE IF NOT EXISTS
  result = result.replace(/CREATE TABLE\s+(?!IF NOT EXISTS\s+)(["']?)(\w+)\1/gi, 'CREATE TABLE IF NOT EXISTS "$2"');
  
  // Replace CREATE INDEX with CREATE INDEX IF NOT EXISTS (only if not already present)
  // Match: CREATE (UNIQUE )?INDEX (optional quotes) index_name
  // But NOT: CREATE INDEX IF NOT EXISTS
  result = result.replace(/CREATE (UNIQUE )?INDEX\s+(?!IF NOT EXISTS\s+)(["']?)(\w+)\2/gi, 'CREATE $1INDEX IF NOT EXISTS "$3"');
  
  return result;
}

/**
 * Convert SQLite SQL to PostgreSQL SQL
 */
function convertToPostgres(sql: string): string {
  let result = sql;
  
  // SQLite uses INTEGER PRIMARY KEY AUTOINCREMENT
  // PostgreSQL uses SERIAL PRIMARY KEY
  result = result.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');
  
  // SQLite uses INTEGER for booleans with mode: 'boolean'
  // PostgreSQL uses BOOLEAN
  // Note: This is tricky because we need to detect boolean mode from the schema
  // For now, we'll keep INTEGER and handle it in the adapter
  
  // SQLite timestamp is INTEGER with mode: 'timestamp'
  // PostgreSQL uses TIMESTAMP or BIGINT
  // Keep as INTEGER for now (can store Unix timestamps)
  
  // Foreign key syntax differences
  // SQLite: ON UPDATE no action ON DELETE cascade
  // PostgreSQL: ON UPDATE NO ACTION ON DELETE CASCADE (uppercase, but both work)
  
  return result;
}

/**
 * Generate CREATE script for SQLite
 */
function generateSQLiteScript(): CreateScript {
  const configPath = path.resolve(__dirname, 'drizzle.config.ts');
  const migrationsDir = path.join(__dirname, './migrations');
  
  // Generate migrations using drizzle-kit (SQLite)
  try {
    execSync(`npx drizzle-kit generate --config "${configPath}"`, { 
      stdio: 'pipe',
      cwd: PROJECT_ROOT,
      encoding: 'utf-8'
    });
  } catch (error: any) {
    // Check if it's just a warning or actual error
    const output = (error.stdout || '') + (error.stderr || '');
    if (error.status !== 0 && !output.includes('No schema changes')) {
      throw error;
    }
  }
  
  // Read all migration files and combine
  if (!fs.existsSync(migrationsDir)) {
    throw new Error('Migrations directory not found');
  }
  
  const sqlFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort(); // Process in order
  
  if (sqlFiles.length === 0) {
    throw new Error('No migration files found');
  }
  
  let combinedSQL = '';
  for (const file of sqlFiles) {
    const filePath = path.join(migrationsDir, file);
    let sql = fs.readFileSync(filePath, 'utf-8');
    
    // Convert backticks to double quotes (already done in generate-migrations, but ensure)
    sql = sql.replace(/`/g, '"');
    
    combinedSQL += sql + '\n\n';
  }
  
  // Make idempotent
  combinedSQL = makeIdempotent(combinedSQL);
  
  const hash = crypto.createHash('md5').update(combinedSQL).digest('hex').substring(0, 16);
  
  return {
    dialect: 'sqlite',
    sql: combinedSQL.trim(),
    hash,
  };
}

/**
 * Generate CREATE script for PostgreSQL
 */
function generatePostgresScript(): CreateScript {
  // For PostgreSQL, we'll convert from SQLite SQL
  // In the future, we could generate directly using drizzle-kit with postgres dialect
  const sqliteScript = generateSQLiteScript();
  
  // Convert to PostgreSQL
  // Note: SQL is already idempotent from SQLite generation, so we don't call makeIdempotent again
  let postgresSQL = convertToPostgres(sqliteScript.sql);
  
  const hash = crypto.createHash('md5').update(postgresSQL).digest('hex').substring(0, 16);
  
  return {
    dialect: 'postgres',
    sql: postgresSQL.trim(),
    hash,
  };
}

/**
 * Generate all CREATE scripts
 */
function generateAllCreateScripts(): void {
  console.log('🔧 Generating re-runnable CREATE scripts for all dialects...\n');
  
  // Ensure scripts directory exists
  if (!fs.existsSync(SCRIPTS_DIR)) {
    fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
  }
  
  const scripts: CreateScript[] = [];
  
  try {
    // Generate SQLite script
    console.log('📦 Generating SQLite script...');
    const sqliteScript = generateSQLiteScript();
    scripts.push(sqliteScript);
    
    const sqliteFile = path.join(SCRIPTS_DIR, 'create-schema.sqlite.sql');
    fs.writeFileSync(sqliteFile, sqliteScript.sql);
    console.log(`✅ SQLite script written (${sqliteScript.hash})\n`);
    
    // Generate PostgreSQL script
    console.log('📦 Generating PostgreSQL script...');
    const postgresScript = generatePostgresScript();
    scripts.push(postgresScript);
    
    const postgresFile = path.join(SCRIPTS_DIR, 'create-schema.postgres.sql');
    fs.writeFileSync(postgresFile, postgresScript.sql);
    console.log(`✅ PostgreSQL script written (${postgresScript.hash})\n`);
    
  } catch (error: any) {
    console.error('❌ Error generating scripts:', error);
    if (error.stdout) console.error('stdout:', error.stdout);
    if (error.stderr) console.error('stderr:', error.stderr);
    process.exit(1);
  }
  
  // Generate TypeScript index
  const indexContent = `/**
 * Re-Runnable CREATE Scripts
 * 
 * This file is auto-generated by generate-create-scripts.ts
 * Do not edit manually.
 * 
 * Contains CREATE IF NOT EXISTS scripts for all supported dialects.
 * These scripts are idempotent and can be run multiple times safely.
 * No migration tracking needed - each client runs these on their own database.
 */

export const createScripts = {
${scripts.map(s => `  ${s.dialect}: {
    hash: '${s.hash}',
    sql: ${JSON.stringify(s.sql)},
  }`).join(',\n')}
} as const;

export type Dialect = keyof typeof createScripts;
`;
  
  const indexFile = path.join(SCRIPTS_DIR, 'index.ts');
  fs.writeFileSync(indexFile, indexContent);
  console.log(`✅ Index written to ${indexFile}`);
  
  console.log('\n🎉 All CREATE scripts generated successfully!');
  console.log('   These scripts can be run on any database (idempotent)');
  console.log('   No migration tracking needed - safe to run multiple times');
}

generateAllCreateScripts();
