/**
 * Generate All CREATE Scripts
 * 
 * Generates CREATE IF NOT EXISTS scripts for all modules and dialects.
 * These scripts are idempotent and can be run multiple times safely.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { makeIdempotent, convertToPostgres, convertBackticksToQuotes } from '../xp-deeby/utils';

const PROJECT_ROOT = path.join(__dirname, '../');

interface CreateScript {
  dialect: string;
  sql: string;
  hash: string;
}

interface ModuleConfig {
  name: string;
  configPath: string;
  migrationsDir: string;
  scriptsDir: string;
}

const modules: ModuleConfig[] = [
  {
    name: 'generic-sports-data',
    configPath: path.resolve(__dirname, 'generic-sports-data/drizzle.config.ts'),
    migrationsDir: path.join(__dirname, 'generic-sports-data/migrations'),
    scriptsDir: path.join(__dirname, 'generic-sports-data/create-scripts'),
  },
  {
    name: 'accounts',
    configPath: path.resolve(__dirname, 'accounts/drizzle.config.ts'),
    migrationsDir: path.join(__dirname, 'accounts/migrations'),
    scriptsDir: path.join(__dirname, 'accounts/create-scripts'),
  },
];

/**
 * Generate CREATE scripts for a module
 */
function generateModuleScripts(module: ModuleConfig): void {
  console.log(`📦 Generating ${module.name} CREATE scripts...`);
  
  // Step 1: Generate migrations using drizzle-kit
  try {
    execSync(`npx drizzle-kit generate --config "${module.configPath}"`, { 
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
  
  // Step 2: Read and combine migration files
  if (!fs.existsSync(module.migrationsDir)) {
    throw new Error(`Migrations directory not found: ${module.migrationsDir}`);
  }
  
  const sqlFiles = fs.readdirSync(module.migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  if (sqlFiles.length === 0) {
    throw new Error(`No migration files found for ${module.name}`);
  }
  
  let combinedSQL = '';
  for (const file of sqlFiles) {
    const filePath = path.join(module.migrationsDir, file);
    let sql = fs.readFileSync(filePath, 'utf-8');
    sql = convertBackticksToQuotes(sql);
    combinedSQL += sql + '\n\n';
  }
  
  // Step 3: Generate SQLite script
  let sqliteSQL = makeIdempotent(combinedSQL);
  const sqliteHash = crypto.createHash('md5').update(sqliteSQL).digest('hex').substring(0, 16);
  const sqliteScript: CreateScript = {
    dialect: 'sqlite',
    sql: sqliteSQL.trim(),
    hash: sqliteHash,
  };
  
  // Step 4: Generate PostgreSQL script using drizzle-kit with PostgreSQL dialect
  const postgresMigrationsDir = path.join(path.dirname(module.migrationsDir), path.basename(module.migrationsDir) + '-postgres');
  let postgresScript: CreateScript;
  
  try {
    // Create a temporary PostgreSQL config
    const tempConfigPath = path.join(path.dirname(module.configPath), 'drizzle.config.postgres.ts');
    const originalConfig = fs.readFileSync(module.configPath, 'utf-8');
    const postgresConfig = originalConfig
      .replace(
        /dialect:\s*['"]sqlite['"]/,
        "dialect: 'postgresql'"
      )
      .replace(
        /out:\s*[^,}]+/,
        `out: ${JSON.stringify(postgresMigrationsDir)}`
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
    
    // Read PostgreSQL migration files
    if (!fs.existsSync(postgresMigrationsDir)) {
      throw new Error('PostgreSQL migrations directory not found');
    }
    
    const postgresSqlFiles = fs.readdirSync(postgresMigrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    if (postgresSqlFiles.length === 0) {
      throw new Error('No PostgreSQL migration files found');
    }
    
    let postgresCombinedSQL = '';
    for (const file of postgresSqlFiles) {
      const filePath = path.join(postgresMigrationsDir, file);
      let sql = fs.readFileSync(filePath, 'utf-8');
      sql = convertBackticksToQuotes(sql);
      postgresCombinedSQL += sql + '\n\n';
    }
    
    let postgresSQL = makeIdempotent(postgresCombinedSQL);
    const postgresHash = crypto.createHash('md5').update(postgresSQL).digest('hex').substring(0, 16);
    postgresScript = {
      dialect: 'postgres',
      sql: postgresSQL.trim(),
      hash: postgresHash,
    };
  } catch (error: any) {
    // If PostgreSQL generation fails, fall back to conversion
    console.warn(`⚠️  PostgreSQL generation failed for ${module.name}, falling back to SQLite conversion`);
    let postgresSQL = convertToPostgres(sqliteSQL);
    const postgresHash = crypto.createHash('md5').update(postgresSQL).digest('hex').substring(0, 16);
    postgresScript = {
      dialect: 'postgres',
      sql: postgresSQL.trim(),
      hash: postgresHash,
    };
  }
  
  // Step 5: Write SQL files
  if (!fs.existsSync(module.scriptsDir)) {
    fs.mkdirSync(module.scriptsDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(module.scriptsDir, 'create-schema.sqlite.sql'),
    sqliteScript.sql
  );
  fs.writeFileSync(
    path.join(module.scriptsDir, 'create-schema.postgres.sql'),
    postgresScript.sql
  );
  
  // Step 6: Generate TypeScript index
  const indexContent = `/**
 * Re-Runnable CREATE Scripts${module.name === 'accounts' ? ' for Accounts' : ''}
 * Auto-generated - do not edit manually
 * 
 * Contains CREATE IF NOT EXISTS scripts for all supported dialects.
 * These scripts are idempotent and can be run multiple times safely.
 */

export const createScripts = {
  sqlite: {
    hash: '${sqliteScript.hash}',
    sql: ${JSON.stringify(sqliteScript.sql)},
  },
  postgres: {
    hash: '${postgresScript.hash}',
    sql: ${JSON.stringify(postgresScript.sql)},
  },
} as const;

export type Dialect = keyof typeof createScripts;
`;
  
  fs.writeFileSync(path.join(module.scriptsDir, 'index.ts'), indexContent);
  
  // Step 7: Generate migrations index
  const generateMigrationsIndexPath = path.join(path.dirname(module.migrationsDir), 'generate-migrations-index.ts');
  if (fs.existsSync(generateMigrationsIndexPath)) {
    try {
      execSync(`npx tsx "${generateMigrationsIndexPath}"`, {
        stdio: 'pipe',
        cwd: PROJECT_ROOT,
        encoding: 'utf-8'
      });
      console.log(`   ✅ Migrations index generated`);
    } catch (error: any) {
      console.warn(`   ⚠️  Failed to generate migrations index: ${error.message}`);
    }
  }
  
  console.log(`✅ ${module.name} scripts generated (SQLite: ${sqliteScript.hash}, Postgres: ${postgresScript.hash})`);
}

/**
 * Generate all CREATE scripts
 */
function generateAll(): void {
  console.log('🚀 Generating all CREATE scripts...\n');
  
  try {
    for (const module of modules) {
      generateModuleScripts(module);
      console.log('');
    }
    
    console.log('🎉 All CREATE scripts generated successfully!');
    console.log('   - Re-runnable (CREATE IF NOT EXISTS)');
    console.log('   - Multi-dialect support (SQLite, PostgreSQL)');
  } catch (error: any) {
    console.error('❌ Error generating scripts:', error);
    if (error.stdout) console.error('stdout:', error.stdout);
    if (error.stderr) console.error('stderr:', error.stderr);
    process.exit(1);
  }
}

generateAll();
