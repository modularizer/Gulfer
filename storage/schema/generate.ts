/**
 * Generate Schema Artifacts
 * 
 * Generates types, create scripts, and migrations using XPSchemaPlus.gen()
 * 
 * Run with: npx tsx storage/schema/generic-sports-data/generate.ts
 */

import { schema } from './schema';

async function generate() {
    console.log('🚀 Generating generic-sports-data schema artifacts...\n');
    
    await schema.gen({
        src: __filename.replace('generate.ts', 'schema.ts'),
        dst: __dirname,
        types: true,
        creates: ['pg', 'sqlite'],
        migrations: true,
    });
    
    console.log('✅ All generic-sports-data artifacts generated!');
}

if (require.main === module) {
    generate().catch(console.error);
}

