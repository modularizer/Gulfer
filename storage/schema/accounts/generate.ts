/**
 * Generate Schema Artifacts
 * 
 * Generates types, create scripts, and migrations using XPSchemaPlus.gen()
 * 
 * Run with: npx tsx storage/schema/accounts/generate.ts
 */

import { schema } from './schema';

async function generate() {
    console.log('🚀 Generating accounts schema artifacts...\n');
    
    await schema.gen({
        src: __filename.replace('generate.ts', 'schema.ts'),
        dst: __dirname,
        types: true,
        creates: ['pg', 'sqlite'],
        migrations: true,
    });
    
    console.log('✅ All accounts artifacts generated!');
}

if (require.main === module) {
    generate().catch(console.error);
}

