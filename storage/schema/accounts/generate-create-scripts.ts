/**
 * Generate Re-Runnable CREATE Scripts for Accounts
 * 
 * Generates CREATE IF NOT EXISTS scripts for each database dialect.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { makeIdempotent, convertToPostgres, convertBackticksToQuotes } from '../../../xp-deeby/utils';

const PROJECT_ROOT = path.join(__dirname, '../../../');
const SCRIPTS_DIR = path.join(__dirname, './create-scripts');

interface CreateScript {
  dialect: string;
  sql: string;
  hash: string;
}

function generateSQLiteScript(): CreateScript {
  const configPath = path.resolve(__dirname, 'drizzle.config.ts');
  const migrationsDir = path.join(__dirname, './migrations');
  
  try {
    execSync(`npx drizzle-kit generate --config "${configPath}"`, { 
      stdio: 'pipe',
      cwd: PROJECT_ROOT,
      encoding: 'utf-8'
    });
  } catch (error: any) {
    const output = (error.stdout || '') + (error.stderr || '');
    if (error.status !== 0 && !output.includes('No schema changes')) {
      throw error;
    }
  }
  
  if (!fs.existsSync(migrationsDir)) {
    throw new Error('Migrations directory not found');
  }
  
  const sqlFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  if (sqlFiles.length === 0) {
    throw new Error('No migration files found');
  }
  
  let combinedSQL = '';
  for (const file of sqlFiles) {
    const filePath = path.join(migrationsDir, file);
    let sql = fs.readFileSync(filePath, 'utf-8');
    sql = convertBackticksToQuotes(sql);
    combinedSQL += sql + '\n\n';
  }
  
  combinedSQL = makeIdempotent(combinedSQL);
  const hash = crypto.createHash('md5').update(combinedSQL).digest('hex').substring(0, 16);
  
  return { dialect: 'sqlite', sql: combinedSQL.trim(), hash };
}

function generatePostgresScript(): CreateScript {
  const configPath = path.resolve(__dirname, 'drizzle.config.ts');
  const migrationsDir = path.join(__dirname, './migrations-postgres');
  
  // Generate migrations using drizzle-kit with PostgreSQL dialect
  try {
    // Create a temporary PostgreSQL config
    const tempConfigPath = path.join(__dirname, 'drizzle.config.postgres.ts');
    const originalConfig = fs.readFileSync(configPath, 'utf-8');
    const postgresConfig = originalConfig
      .replace(
        /dialect:\s*['"]sqlite['"]/,
        "dialect: 'postgresql'"
      )
      .replace(
        /out:\s*[^,}]+/,
        `out: ${JSON.stringify(migrationsDir)}`
      )
      .replace(
        /dbCredentials:\s*\{[^}]*\}/,
        `dbCredentials: {
    url: 'postgresql://localhost:5432/temp', // Temporary URL for generation only
  }`
      );
    fs.writeFileSync(tempConfigPath, postgresConfig);
    
    try {
      execSync(`npx drizzle-kit generate --config "${tempConfigPath}"`, { 
        stdio: 'pipe',
        cwd: PROJECT_ROOT,
        encoding: 'utf-8'
      });
    } catch (error: any) {
      const output = (error.stdout || '') + (error.stderr || '');
      if (error.status !== 0 && !output.includes('No schema changes')) {
        throw error;
      }
    } finally {
      // Clean up temp config
      if (fs.existsSync(tempConfigPath)) {
        fs.unlinkSync(tempConfigPath);
      }
    }
  } catch (error: any) {
    // If PostgreSQL generation fails, fall back to conversion
    console.warn('⚠️  PostgreSQL generation failed, falling back to SQLite conversion');
    const sqliteScript = generateSQLiteScript();
    let postgresSQL = convertToPostgres(sqliteScript.sql);
    const hash = crypto.createHash('md5').update(postgresSQL).digest('hex').substring(0, 16);
    return { dialect: 'postgres', sql: postgresSQL.trim(), hash };
  }
  
  // Read all migration files and combine
  if (!fs.existsSync(migrationsDir)) {
    throw new Error('PostgreSQL migrations directory not found');
  }
  
  const sqlFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  if (sqlFiles.length === 0) {
    throw new Error('No PostgreSQL migration files found');
  }
  
  let combinedSQL = '';
  for (const file of sqlFiles) {
    const filePath = path.join(migrationsDir, file);
    let sql = fs.readFileSync(filePath, 'utf-8');
    sql = convertBackticksToQuotes(sql);
    combinedSQL += sql + '\n\n';
  }
  
  combinedSQL = makeIdempotent(combinedSQL);
  const hash = crypto.createHash('md5').update(combinedSQL).digest('hex').substring(0, 16);
  return { dialect: 'postgres', sql: combinedSQL.trim(), hash };
}

function generateAllCreateScripts(): void {
  console.log('🔧 Generating re-runnable CREATE scripts for accounts...\n');
  
  if (!fs.existsSync(SCRIPTS_DIR)) {
    fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
  }
  
  const scripts: CreateScript[] = [];
  
  try {
    console.log('📦 Generating SQLite script...');
    const sqliteScript = generateSQLiteScript();
    scripts.push(sqliteScript);
    fs.writeFileSync(path.join(SCRIPTS_DIR, 'create-schema.sqlite.sql'), sqliteScript.sql);
    console.log(`✅ SQLite script written\n`);
    
    console.log('📦 Generating PostgreSQL script...');
    const postgresScript = generatePostgresScript();
    scripts.push(postgresScript);
    fs.writeFileSync(path.join(SCRIPTS_DIR, 'create-schema.postgres.sql'), postgresScript.sql);
    console.log(`✅ PostgreSQL script written\n`);
  } catch (error: any) {
    console.error('❌ Error:', error);
    if (error.stdout) console.error('stdout:', error.stdout);
    if (error.stderr) console.error('stderr:', error.stderr);
    process.exit(1);
  }
  
  const indexContent = `/**
 * Re-Runnable CREATE Scripts for Accounts
 * Auto-generated - do not edit manually
 */

export const createScripts = {
${scripts.map(s => `  ${s.dialect}: {
    hash: '${s.hash}',
    sql: ${JSON.stringify(s.sql)},
  }`).join(',\n')}
} as const;

export type Dialect = keyof typeof createScripts;
`;
  
  fs.writeFileSync(path.join(SCRIPTS_DIR, 'index.ts'), indexContent);
  console.log('✅ All CREATE scripts generated successfully!');
}

generateAllCreateScripts();

