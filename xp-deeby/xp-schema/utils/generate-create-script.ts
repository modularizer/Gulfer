/**
 * Easy CREATE Script Generator
 * 
 * Generates CREATE TABLE SQL scripts from a schema file using Drizzle's getTableConfig().
 * This ensures all constraints (primary keys, foreign keys, unique, etc.) are properly included.
 * No database connection is required.
 */

import { generateCreateScript as generateCreateScriptFromSchema } from '../xp-sql/utils/generators/unified-generator';

/**
 * Check if we're running in a Node.js environment
 */
function isNodeEnvironment(): boolean {
  return typeof process !== 'undefined' && 
         process.versions != null && 
         process.versions.node != null;
}

/**
 * Throw a helpful error if not in Node.js environment
 */
function requireNodeEnvironment(functionName: string): void {
  if (!isNodeEnvironment()) {
    throw new Error(
      `${functionName} requires a Node.js environment. ` +
      `This function cannot be used in web browsers or other non-Node.js environments.`
    );
  }
}

/**
 * Options for CREATE script generation
 */
export interface GenerateCreateScriptOptions {
  /**
   * Path to the source file that exports the schema or table
   */
  sourceFile: string;
  
  /**
   * Name of the export (e.g., 'schema', 'usersTable', or 'default' for default export)
   */
  exportName?: string;
  
  /**
   * SQL dialect to use ('sqlite' or 'pg')
   */
  dialect: 'sqlite' | 'pg';
  
  /**
   * Path to write the generated SQL file
   */
  outputPath?: string;
  
  /**
   * Optional: Path to tsconfig.json (defaults to searching from sourceFile)
   */
  tsconfigPath?: string;
  
  /**
   * Optional: Whether to include IF NOT EXISTS (default: true)
   */
  ifNotExists?: boolean;
  
  /**
   * Optional: Custom header comment for the generated file
   */
  headerComment?: string;
}

/**
 * Result of CREATE script generation
 */
export interface GenerateCreateScriptResult {
  /**
   * The generated SQL script
   */
  sql: string;
  
  /**
   * Path to the generated file
   */
  outputPath: string;
}

/**
 * Generate CREATE TABLE SQL script from a schema file
 * Uses Drizzle's getTableConfig() to extract metadata and build SQL
 */
export async function generateCreateScript(
  options: GenerateCreateScriptOptions
): Promise<GenerateCreateScriptResult> {
  requireNodeEnvironment('generateCreateScript');
  
  // Use eval to make require truly dynamic and avoid Metro bundler analysis
  // This prevents Metro from trying to bundle Node.js modules
  const getNodeRequire = () => {
    if (typeof window !== 'undefined') {
      throw new Error('This function only works in Node.js environment');
    }
    // Use Function constructor to create a require that Metro can't analyze
    return new Function('return require')();
  };
  
  const nodeRequire = getNodeRequire();
  const fs = nodeRequire('fs');
  const path = nodeRequire('path');
  
  const {
    sourceFile,
    exportName = 'schema',
    dialect,
    ifNotExists = true,
    headerComment
  } = options;
  let outputPath = options.outputPath;
  
  // Validate sourceFile
  if (!sourceFile) {
    throw new Error('sourceFile is required but was not provided');
  }
  
  // Resolve source file path
  const sourceFilePath = path.resolve(sourceFile);
  if (!fs.existsSync(sourceFilePath)) {
    throw new Error(`Source file not found: ${sourceFilePath}`);
  }
  
  // Handle outputPath: if not provided, use default; if provided, check if it's a directory
  let resolvedOutputPath: string;
  if (!outputPath) {
    let g = path.join(path.dirname(sourceFilePath), 'generated');
    if (!fs.existsSync(g)){
      fs.mkdirSync(g, { recursive: true });
    }
    resolvedOutputPath = path.join(g, `create-script.${dialect}.sql`);
  } else {
    // Resolve the output path
    resolvedOutputPath = path.resolve(outputPath);
    
    // Check if outputPath is a directory (exists and is a directory, or doesn't exist and has no extension)
    const isDirectory = fs.existsSync(resolvedOutputPath) 
      ? fs.statSync(resolvedOutputPath).isDirectory()
      : !path.extname(resolvedOutputPath); // If doesn't exist, treat as directory if no extension
    
    if (isDirectory) {
      // Ensure directory exists
      if (!fs.existsSync(resolvedOutputPath)) {
        fs.mkdirSync(resolvedOutputPath, { recursive: true });
      }
      // Join with default filename
      resolvedOutputPath = path.join(resolvedOutputPath, `create-script.${dialect}.sql`);
    }
  }
  // Load the schema/table from the source file
  const modulePath = sourceFilePath.replace(/\.ts$/, '');
  const requireCache = nodeRequire.cache;
  if (requireCache && requireCache[modulePath]) {
    delete requireCache[modulePath];
  }
  
  let module: any;
  try {
    module = nodeRequire(modulePath);
  } catch (error) {
    try {
      module = nodeRequire(sourceFilePath);
    } catch (e) {
      throw new Error(
        `Failed to import module from ${sourceFilePath}. ` +
        `Make sure the file can be executed (e.g., using tsx or ts-node). ` +
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  const schemaOrTable = exportName === 'default' ? module.default : module[exportName];
  if (!schemaOrTable) {
    throw new Error(`Export '${exportName}' not found in module`);
  }
  
  // Generate SQL using unified generator (Step 1: extract dialect-agnostic, Step 2: convert to dialect-specific SQL)
  // schemaOrTable should be a Schema object
  if (!schemaOrTable || typeof schemaOrTable !== 'object' || !('tables' in schemaOrTable)) {
    throw new Error('Expected a Schema object with a tables property');
  }
  const sql = await generateCreateScriptFromSchema(schemaOrTable, dialect, { ifNotExists });
  
  // Generate output file content
  const outputDir = path.dirname(resolvedOutputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  let fileContent = headerComment || `-- Generated CREATE TABLE Script
-- 
-- This file is auto-generated. Do not edit manually.
-- 
-- Generated at: ${new Date().toISOString()}
-- Dialect: ${dialect}
--

`;

  fileContent += sql.trim();
  
  // Write output file
  fs.writeFileSync(resolvedOutputPath, fileContent);
  
  return {
    sql: sql.trim(),
    outputPath: resolvedOutputPath
  };
}

/**
 * Try to generate CREATE script, catching and logging errors gracefully
 * Provides helpful console output and error handling
 */
export async function tryGenerateCreateScript(
  options: GenerateCreateScriptOptions
): Promise<GenerateCreateScriptResult | null> {
  const { sourceFile, exportName, dialect, outputPath } = options;
  
  console.log(`🔧 Generating CREATE script...`);
  console.log(`   - Source: ${sourceFile}`);
  console.log(`   - Export: ${exportName}`);
  console.log(`   - Dialect: ${dialect}`);
  console.log(`   - Output: ${outputPath}\n`);
  
  try {
    const result = await generateCreateScript(options);
    
    console.log('✅ CREATE script generated successfully!');
    console.log(`   - Output: ${result.outputPath}`);
    console.log(`   - Size: ${result.sql.length} characters`);
    console.log(`   - Lines: ${result.sql.split('\n').length}\n`);
    
    return result;
  } catch (error) {
    console.error('❌ Error generating CREATE script:', error);
    if (error instanceof Error) {
      console.error(`   - Message: ${error.message}`);
      if (error.stack) {
        console.error(`   - Stack: ${error.stack}`);
      }
    }
    console.error('');
    return null;
  }
}




export async function genCreateScript(filename: string, dst?: string, dialects: string[] = ['pg', 'sqlite']) {
    const r = {}
    for (const d of dialects) {
        const result = await tryGenerateCreateScript({
            sourceFile: filename,
            //@ts-ignore
            dialect: d,
            outputPath: dst
        });

        if (!result) {
            process.exit(1);
        }
        // @ts-ignore
        r[d] = result;
    }
    console.log('🎉 All CREATE scripts generated successfully!');
    return r;
}



