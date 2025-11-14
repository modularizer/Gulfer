/**
 * Schema Index
 * 
 * Exports:
 * 1. All table definitions (for Drizzle ORM usage)
 * 2. Type definitions (via types.ts which uses Drizzle's type inference)
 */

// Export all table definitions
export * from './1-base';
export * from './2-generic-sports-schema';
export * from './3-photos';
export * from './6-data-merges';

// Export type definitions (these use Drizzle's type inference)
export * from './types';

// Note: generated-types.ts is a build artifact that provides expanded types
// but is not needed at runtime. Types are available via types.ts which uses
// Drizzle's typeof inference: typeof schema.tableName.$inferSelect

