/**
 * Example: Using the CREATE Script Generator
 * 
 * This script demonstrates how to use the CREATE script generator to create
 * SQL scripts from a schema, specifying the dialect.
 * 
 * Run with: npx tsx xp-deeby/xp-schema/examples/basic/generate-create-script-example.ts
 */

import { tryGenerateCreateScript } from '../../utils/generate-create-script';
import * as path from 'path';

async function main() {
  const examplesDir = __dirname;
  const schemaFile = path.join(examplesDir, 'schema.ts');
  
  console.log('🔧 Generating CREATE scripts for schema...\n');
  
  // Generate SQLite script
  const sqliteResult = await tryGenerateCreateScript({
    sourceFile: schemaFile,
    exportName: 'schema',
    dialect: 'sqlite',
    outputPath: path.join(examplesDir, 'create-schema.sqlite.sql'),
    headerComment: `-- Generated CREATE TABLE Script for Basic Schema Example
-- 
-- This file is auto-generated. Do not edit manually.
-- 
-- Generated at: ${new Date().toISOString()}
-- Dialect: SQLite
--

`
  });
  
  if (!sqliteResult) {
    console.error('Failed to generate SQLite script');
    process.exit(1);
  }
  
  // Generate PostgreSQL script
  const postgresResult = await tryGenerateCreateScript({
    sourceFile: schemaFile,
    exportName: 'schema',
    dialect: 'pg',
    outputPath: path.join(examplesDir, 'create-schema.postgres.sql'),
    headerComment: `-- Generated CREATE TABLE Script for Basic Schema Example
-- 
-- This file is auto-generated. Do not edit manually.
-- 
-- Generated at: ${new Date().toISOString()}
-- Dialect: PostgreSQL
--

`
  });
  
  if (!postgresResult) {
    console.error('Failed to generate PostgreSQL script');
    process.exit(1);
  }
  
  console.log('🎉 All CREATE scripts generated successfully!');
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

