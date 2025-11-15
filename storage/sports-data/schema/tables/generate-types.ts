/**
 * Type Generation Script
 * 
 * Generates hardcoded TypeScript type declarations from Drizzle's inferred types.
 * This improves IDE performance and makes types easier to debug.
 * 
 * Run with: npm run generate-types
 */

import * as fs from 'fs';
import * as path from 'path';
import { Project, TypeFormatFlags } from 'ts-morph';

const SCHEMA_DIR = __dirname; // Now we're already in the tables directory
const SCHEMA_TYPES_FILE = path.join(SCHEMA_DIR, 'types.ts');
const GENERATED_TYPES_FILE = path.join(SCHEMA_DIR, 'generated-types.ts');
const PROJECT_ROOT = path.join(__dirname, '../../../../'); // tables -> schema -> sports-data -> storage -> root
const TSCONFIG_PATH = path.join(PROJECT_ROOT, 'tsconfig.json');

/**
 * Format a type string for readability
 */
function formatTypeString(typeStr: string): string {
  // Clean up whitespace first
  let cleaned = typeStr.replace(/\s+/g, ' ').trim();
  
  // If it's an object type, format it nicely
  if (cleaned.startsWith('{') && cleaned.includes(':')) {
    // Remove the outer braces temporarily
    const inner = cleaned.slice(1, -1).trim();
    
    // Split by semicolons (property separators in TypeScript)
    const parts = inner.split(';')
      .map(part => part.trim())
      .filter(part => part.length > 0);
    
    if (parts.length > 0) {
      const formatted = parts
        .map(part => {
          // Add proper indentation and semicolon
          return '  ' + part + ';';
        })
        .join('\n');
      
      return '{\n' + formatted + '\n}';
    }
    
    return '{}';
  }
  
  // For non-object types, return cleaned
  return cleaned;
}

/**
 * Generate types using ts-morph
 */
function generateTypes(): void {
  console.log('🔍 Analyzing schema files with ts-morph...');
  
  // Create a ts-morph project
  const project = new Project({
    tsConfigFilePath: TSCONFIG_PATH,
  });
  
  // Add the schema types file
  const sourceFile = project.addSourceFileAtPath(SCHEMA_TYPES_FILE);
  
  // Parse the types.ts file to find all type exports
  const typesContent = fs.readFileSync(SCHEMA_TYPES_FILE, 'utf-8');
  const lines = typesContent.split('\n');
  
  const typeMap = new Map<string, { select?: string; insert?: string; section: string }>();
  
  let currentSection = 'base';
  
  // Parse sections and type definitions
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect section headers
    if (line.includes('// ============================================================================')) {
      for (let j = i + 1; j < lines.length && j < i + 3; j++) {
        const nextLine = lines[j];
        if (nextLine.includes('//')) {
          if (nextLine.includes('Sports and Formats')) {
            currentSection = 'sports-and-formats';
            break;
          } else if (nextLine.includes('Venues')) {
            currentSection = 'venues';
            break;
          } else if (nextLine.includes('Participants')) {
            currentSection = 'participants';
            break;
          } else if (nextLine.includes('Events')) {
            currentSection = 'events';
            break;
          } else if (nextLine.includes('Photos')) {
            currentSection = 'photos';
            break;
          // Accounts and Settings moved to accounts/ folder - skip
          } else if (nextLine.includes('Data Merges')) {
            currentSection = 'storage-merges';
            break;
          }
        }
      }
    }
    
    // Match: export type TypeName = typeof schema.tableName.$inferSelect;
    const selectMatch = line.match(/export\s+type\s+(\w+)\s*=\s*typeof\s+schema\.(\w+)\.\$inferSelect/);
    if (selectMatch) {
      const [, typeName, tableName] = selectMatch;
      if (!typeMap.has(tableName)) {
        typeMap.set(tableName, { section: currentSection });
      }
      typeMap.get(tableName)!.select = typeName;
    }
    
    // Match: export type TypeNameInsert = typeof schema.tableName.$inferInsert;
    const insertMatch = line.match(/export\s+type\s+(\w+Insert)\s*=\s*typeof\s+schema\.(\w+)\.\$inferInsert/);
    if (insertMatch) {
      const [, typeName, tableName] = insertMatch;
      if (!typeMap.has(tableName)) {
        typeMap.set(tableName, { section: currentSection });
      }
      typeMap.get(tableName)!.insert = typeName;
    }
  }
  
  // Get the type checker
  const typeChecker = project.getTypeChecker();
  
  // Group types by section
  const sections = new Map<string, Array<{ 
    tableName: string; 
    select: string; 
    insert: string;
    selectType?: string;
    insertType?: string;
  }>>();
  
  console.log('📝 Resolving and expanding types...');
  
  // Resolve each type
  for (const [tableName, info] of typeMap.entries()) {
    if (info.select && info.insert) {
      if (!sections.has(info.section)) {
        sections.set(info.section, []);
      }
      
      const entry = {
        tableName,
        select: info.select,
        insert: info.insert,
      };
      
      // Try to resolve the actual types
      try {
        // Find the type alias declarations
        const selectTypeAlias = sourceFile.getTypeAlias(info.select);
        const insertTypeAlias = sourceFile.getTypeAlias(info.insert);
        
        if (selectTypeAlias) {
          const selectTypeNode = selectTypeAlias.getTypeNode();
          if (selectTypeNode) {
            // Get the underlying TypeScript type
            const tsType = typeChecker.getTypeAtLocation(selectTypeNode);
            // Use ts-morph's typeToString method
            const selectTypeStr = selectTypeAlias.getType().getText(
              undefined,
              TypeFormatFlags.NoTruncation | 
              TypeFormatFlags.InTypeAlias | 
              TypeFormatFlags.WriteArrayAsGenericType
            );
            //@ts-ignore
            entry.selectType = formatTypeString(selectTypeStr);
          }
        }
        
        if (insertTypeAlias) {
          const insertTypeNode = insertTypeAlias.getTypeNode();
          if (insertTypeNode) {
            // Get the underlying TypeScript type
            const tsType = typeChecker.getTypeAtLocation(insertTypeNode);
            // Use ts-morph's typeToString method
            const insertTypeStr = insertTypeAlias.getType().getText(
              undefined,
              TypeFormatFlags.NoTruncation | 
              TypeFormatFlags.InTypeAlias | 
              TypeFormatFlags.WriteArrayAsGenericType
            );
              //@ts-ignore
            entry.insertType = formatTypeString(insertTypeStr);
          }
        }
      } catch (error) {
        console.warn(`⚠️  Could not resolve types for ${tableName}:`, error instanceof Error ? error.message : error);
      }
      
      sections.get(info.section)!.push(entry);
    }
  }
  
  // Generate a single file with all types
  console.log(`📝 Generating types file...`);
  
  let fileContent = `/**
 * Generated Type Declarations
 * 
 * This file is auto-generated by sports-data/schema/tables/generate-types.ts
 * Do not edit manually. Regenerate with: npm run generate-types
 * 
 * Generated at: ${new Date().toISOString()}
 */

import {Sex} from "./2-generic-sports-schema";


`;
  
  // Group by section for organization in comments
  const sectionOrder = [
    'sports-and-formats',
    'venues',
    'participants',
    'events',
    'photos',
    // Accounts and settings moved to accounts/ folder
    'storage-merges',
  ];
  
  let totalExpanded = 0;
  let totalTypes = 0;
  
  for (const section of sectionOrder) {
    const tables = sections.get(section);
    if (!tables || tables.length === 0) continue;
    
    // Add section header
    const sectionTitle = section
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    fileContent += `// ============================================================================
// ${sectionTitle}
// ============================================================================

`;
    
    for (const { tableName, select, insert, selectType, insertType } of tables) {
      // Use expanded type if available, otherwise fall back to typeof reference
      const selectTypeDef = selectType 
        ? selectType 
        : `typeof import('./index').${tableName}.$inferSelect`;
      
      const insertTypeDef = insertType 
        ? insertType 
        : `typeof import('./index').${tableName}.$inferInsert`;
      
      fileContent += `/**
 * ${select} - Select type for ${tableName} table
 */
export type ${select} = ${selectTypeDef};

/**
 * ${insert} - Insert type for ${tableName} table
 */
export type ${insert} = ${insertTypeDef};

`;
      
      if (selectType || insertType) {
        totalExpanded++;
      }
      totalTypes++;
    }
    
    fileContent += '\n';
  }
  
  fs.writeFileSync(GENERATED_TYPES_FILE, fileContent);
  
  console.log(`   ✓ generated-types.ts (${totalTypes} type pairs${totalExpanded > 0 ? `, ${totalExpanded} expanded` : ''})`);
  
  console.log(`\n✅ Successfully generated type declarations`);
  console.log(`   - File: ${GENERATED_TYPES_FILE}`);
  console.log(`   - ${totalTypes} type pairs`);
  if (totalExpanded > 0) {
    console.log(`   - ${totalExpanded} types fully expanded`);
  } else {
    console.log(`\n💡 Note: Types are using typeof references.`);
    console.log(`   This may be due to Drizzle's complex type inference.`);
    console.log(`   The types are still valid and type-safe.`);
  }
}

// Run the generator
try {
  generateTypes();
} catch (error) {
  console.error('❌ Error generating types:', error);
  if (error instanceof Error) {
    console.error(error.stack);
  }
  process.exit(1);
}
