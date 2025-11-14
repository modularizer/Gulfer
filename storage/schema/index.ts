/**
 * Unified Schema Index
 * 
 * Exports all table definitions from both generic-sports-data and accounts modules.
 * This provides a single entry point for accessing all database tables.
 * 
 * Usage:
 * ```ts
 * import * as schema from '@/storage/schema';
 * // schema.accounts, schema.participants, schema.events, etc.
 * ```
 */

// Export all generic-sports-data tables
export * from './generic-sports-data/tables';

// Export all accounts tables
export * from './accounts/schema/tables';

// Export schema setup function (only handles migrations)
export { setupSchemaByName } from './setup';

