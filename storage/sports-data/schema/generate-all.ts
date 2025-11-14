/**
 * Generate All Schema Artifacts
 * 
 * This script automatically generates everything needed from schema changes:
 * 1. TypeScript types (generated-types.ts)
 * 2. SQL migrations (migrations/*.sql)
 * 3. Migrations index (migrations/index.ts)
 * 
 * Run with: npm run db:generate
 * 
 * Everything happens automatically - just run this one command when schema changes!
 */

import { execSync } from 'child_process';
import * as path from 'path';

/**
 * Generate all schema artifacts
 */
function generateAll(): void {
  console.log('🚀 Generating all schema artifacts...\n');
  
  try {
    // Step 1: Generate TypeScript types
    console.log('📝 Step 1: Generating TypeScript types...');
    const generateTypesPath = path.join(__dirname, 'tables/generate-types.ts');
    execSync(`npx tsx ${generateTypesPath}`, { stdio: 'inherit' });
    console.log('✅ Types generated\n');
    
    // Step 2: Generate SQL migrations
    console.log('🗄️  Step 2: Generating SQL migrations...');
    const generateSQLPath = path.join(__dirname, 'generate-sql.ts');
    execSync(`npx tsx ${generateSQLPath}`, { stdio: 'inherit' });
    console.log('✅ Migrations generated\n');
    
    console.log('🎉 All schema artifacts generated successfully!');
    console.log('   - TypeScript types updated');
    console.log('   - SQL migrations created');
    console.log('   - Migrations index updated');
    console.log('\n   Ready to commit!');
  } catch (error) {
    console.error('❌ Error generating schema artifacts:', error);
    process.exit(1);
  }
}

generateAll();

