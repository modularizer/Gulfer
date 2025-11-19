/**
 * Example: Using the Type Generator
 * 
 * This script demonstrates how to use the type generator to create
 * fully expanded type declarations from a schema or table.
 * 
 * Run with: npx tsx xp-deeby/xp-schema/examples/basic/generate-types-example.ts
 */

import {generateTypes, tryGenerateTypes} from '../../utils/generate-types';
import * as path from 'path';

async function main() {
  const examplesDir = __dirname;
  const schemaFile = path.join(examplesDir, 'schema.ts');
    // Generate types for the entire schema
     const r = await tryGenerateTypes({
      sourceFile: schemaFile,
      exportName: 'schema',
      outputPath: path.join(examplesDir, 'generated-schema-types.ts'),
      headerComment: `/**
 * Generated Type Declarations for Basic Schema Example
 * 
 * This file is auto-generated. Do not edit manually.
 * 
 * Generated at: ${new Date().toISOString()}
 */

`
    });
     if (!r){process.exit(1)}
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

