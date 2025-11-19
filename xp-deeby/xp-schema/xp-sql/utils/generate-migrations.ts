/**
 * CLI Script for Generating Migrations
 * 
 * Usage:
 *   npx tsx xp-deeby/xp-schema/xp-sql/utils/generate-migrations.ts <schema-file> <export-name> [migrations-dir] [migration-name]
 * 
 * Example:
 *   npx tsx xp-deeby/xp-schema/xp-sql/utils/generate-migrations.ts ./schema.ts schema ./migrations
 */

import * as fs from 'fs';
import * as path from 'path';
import { generateMigrations } from './migration-generator';
import type { Schema } from '../schema';

/**
 * Load schema from a file
 */
async function loadSchemaFromFile(
  schemaFile: string,
  exportName: string
): Promise<Schema<any>> {
  const schemaFilePath = path.resolve(schemaFile);
  
  if (!fs.existsSync(schemaFilePath)) {
    throw new Error(`Schema file not found: ${schemaFilePath}`);
  }
  
  // Clear require cache to ensure fresh import
  const modulePath = schemaFilePath.replace(/\.ts$/, '').replace(/\.js$/, '');
  if (require.cache[modulePath]) {
    delete require.cache[modulePath];
  }
  
  let module: any;
  try {
    module = require(modulePath);
  } catch (error) {
    try {
      module = require(schemaFilePath);
    } catch (e) {
      throw new Error(
        `Failed to import module from ${schemaFilePath}. ` +
        `Make sure the file can be executed (e.g., using tsx or ts-node). ` +
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  const schema = exportName === 'default' ? module.default : module[exportName];
  if (!schema) {
    throw new Error(`Export '${exportName}' not found in module. Available exports: ${Object.keys(module).join(', ')}`);
  }
  
  // Check if it's a Schema instance
  if (!schema || typeof schema !== 'object' || !('tables' in schema)) {
    throw new Error(`Export '${exportName}' is not a Schema instance. Expected an object with a 'tables' property.`);
  }
  
  return schema;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: generate-migrations.ts <schema-file> <export-name> [migrations-dir] [migration-name]');
    console.error('');
    console.error('Arguments:');
    console.error('  schema-file    Path to the schema file (e.g., ./schema.ts)');
    console.error('  export-name   Name of the schema export (e.g., "schema" or "default")');
    console.error('  migrations-dir Optional: Directory for migrations (default: ./migrations)');
    console.error('  migration-name Optional: Custom migration name (default: auto-generated)');
    console.error('');
    console.error('Example:');
    console.error('  npx tsx generate-migrations.ts ./schema.ts schema ./migrations');
    process.exit(1);
  }
  
  const [schemaFile, exportName, migrationsDir = './migrations', migrationName] = args;
  
  console.log('🔧 Generating migrations...\n');
  console.log(`   Schema file: ${schemaFile}`);
  console.log(`   Export name: ${exportName}`);
  console.log(`   Migrations dir: ${migrationsDir}`);
  if (migrationName) {
    console.log(`   Migration name: ${migrationName}`);
  }
  console.log('');
  
  try {
    // Load schema
    console.log('📦 Loading schema...');
    const schema = await loadSchemaFromFile(schemaFile, exportName);
    console.log(`   ✅ Loaded schema with ${Object.keys(schema.tables).length} table(s)\n`);
    
    // Check for existing migrations
    const existingMigrationsPath = migrationsDir;
    const hasExistingMigrations = fs.existsSync(existingMigrationsPath) &&
      (fs.existsSync(path.join(existingMigrationsPath, 'sqlite')) ||
       fs.existsSync(path.join(existingMigrationsPath, 'pg')));
    
    if (hasExistingMigrations) {
      console.log('📊 Detected existing migrations, generating incremental migration...\n');
    } else {
      console.log('🆕 No existing migrations found, generating initial migration...\n');
    }
    
    // Generate migrations
    const result = await generateMigrations({
      migrationsDir,
      schema,
      existingMigrationsPath: hasExistingMigrations ? existingMigrationsPath : undefined,
      migrationName,
    });
    
    console.log('✅ Migrations generated successfully!\n');
    console.log(`   Type: ${result.isInitial ? 'Initial' : 'Incremental'}`);
    console.log(`   Files generated: ${result.migrationFiles.length}\n`);
    
    for (const file of result.migrationFiles) {
      console.log(`   📄 ${file.dialect}: ${file.path}`);
      console.log(`      Hash: ${file.hash}`);
    }
    
    if (result.diff) {
      console.log('\n📋 Schema changes detected:');
      if (result.diff.addedTables.length > 0) {
        console.log(`   ➕ Added tables: ${result.diff.addedTables.join(', ')}`);
      }
      if (result.diff.removedTables.length > 0) {
        console.log(`   ➖ Removed tables: ${result.diff.removedTables.join(', ')}`);
      }
      if (result.diff.modifiedTables.length > 0) {
        console.log(`   🔄 Modified tables: ${result.diff.modifiedTables.map(t => t.tableName).join(', ')}`);
        for (const table of result.diff.modifiedTables) {
          if (table.addedColumns.length > 0) {
            console.log(`      ➕ Added columns: ${table.addedColumns.join(', ')}`);
          }
          if (table.removedColumns.length > 0) {
            console.log(`      ➖ Removed columns: ${table.removedColumns.join(', ')}`);
          }
          if (table.modifiedColumns.length > 0) {
            console.log(`      🔄 Modified columns: ${table.modifiedColumns.map(c => c.columnName).join(', ')}`);
          }
        }
      }
    }
    
    console.log('\n🎉 Done!');
  } catch (error) {
    console.error('\n❌ Error generating migrations:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
      if (error.stack) {
        console.error(`\n${error.stack}`);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

