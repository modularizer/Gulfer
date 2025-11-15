// ============================================================================
// Schema Definitions (Database-agnostic)
// ============================================================================
// These functions are abstracted and resolve to the appropriate dialect
// implementation (SQLite or PostgreSQL) based on the adapter type.
// 
// By default, they use SQLite (for drizzle-kit compatibility).
// To use PostgreSQL schemas, call setSchemaAdapterType(AdapterType.PGLITE) 
// before defining your schemas.
export {
  table, text, varchar, integer, real, timestamp, jsonb, unique, index, bool, uuid, uuidPK, uuidDefault,
  setSchemaAdapterType
} from './dialects/abstract';

// ============================================================================
// Adapter Types and Interface
// ============================================================================
export type { Database, DatabaseAdapter, Adapter, AdapterCapabilities } from './types';

// ============================================================================
// Adapter Factory
// ============================================================================
export { getAdapter, setAdapter, createAdapter, createAdapterByType, getAdapterByType, AdapterType, PlatformName } from './factory';

// ============================================================================
// Adapter Implementations
// ============================================================================
// Note: Adapter classes are NOT exported directly to avoid loading
// unnecessary dependencies. Use the factory functions instead:
// - getAdapter() - auto-selects based on platform
// - getAdapterByType(type) - explicitly select adapter type
// - createAdapterByType(type) - create adapter without setting as current
//
// If you need direct access to adapter classes, import them explicitly:
// import { PgliteAdapter } from './drivers/pglite';

// ============================================================================
// Database Listing Functions
// ============================================================================
export { listDatabases, listDatabasesWeb } from './list-databases';
export { registerDatabaseName, getRegistryEntries, type DatabaseRegistryEntry } from './registry-storage';

// ============================================================================
// Database Metadata Functions
// ============================================================================
export { getDatabaseMetadata, type DatabaseMetadata } from './database-metadata';

// ============================================================================
// Generic Database Operations
// ============================================================================
export { getDatabaseByName, deleteDatabaseByName, getTableNames } from './database-operations';