/**
 * SQL Generation Script
 * 
 * This script automatically:
 * 1. Generates SQL migration files using drizzle-kit
 * 2. Generates the migrations index for runtime execution
 * 
 * Run with: npm run db:generate
 * 
 * Everything happens automatically - no manual steps required!
 */

import { execSync } from 'child_process';
import * as path from 'path';

// Calculate project root (schema -> sports-data -> storage -> root)
// __dirname is: storage/sports-data/schema/
// Go up 3 levels: ../ -> sports-data, ../../ -> storage, ../../../ -> root
const PROJECT_ROOT = path.join(__dirname, '../../../');

/**
 * Generate SQL from schema and create migrations index
 */
function generateSQL(): void {
  console.log('🔧 Generating SQL migrations from schema...');
  
  try {
    // Step 1: Run drizzle-kit generate to create migration files
    // Explicitly specify the config file path (use absolute path to be safe)
    const configPath = path.resolve(PROJECT_ROOT, 'drizzle.config.ts');
    execSync(`npx drizzle-kit generate --config "${configPath}"`, { 
      stdio: 'inherit',
      cwd: PROJECT_ROOT // Run from project root so config is found
    });
    
    // Step 2: Generate the migrations index automatically
    const generateIndexPath = path.join(__dirname, 'generate-migrations-index.ts');
    execSync(`npx tsx ${generateIndexPath}`, { stdio: 'inherit' });
    
    console.log('✅ Migrations generated and indexed successfully!');
    console.log('   The app will automatically run these migrations at startup.');
  } catch (error) {
    console.error('❌ Error generating SQL:', error);
    process.exit(1);
  }
}

generateSQL();

