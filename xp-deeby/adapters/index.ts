export {
  table, text, varchar, integer, real, timestamp, jsonb, unique, index, bool, uuid, uuidPK, uuidDefault,
  bindSchema
} from './schema';

export type { SchemaBuilder } from './schema-builder';

export {getAdapter, getCurrentAdapterType, detectPlatform, getDatabaseByName} from './factory'

export { Database } from './database';
export type { 
    DrizzleDatabase, 
    DrizzleTable, 
    QueryResult, 
    QueryResultRow,
    SelectQueryBuilder,
    InsertQueryBuilder,
    UpdateQueryBuilder,
    DeleteQueryBuilder
} from './database';
export { AdapterType, PlatformName, Dialect, type RegistryEntry, type PostgresConnectionConfig } from './types';

export { registerDatabaseEntry, getRegistryEntries, saveRegistryEntries } from './registry-storage';

// Early schema binding - bind default schema based on platform before table modules are imported
// This ensures schema functions work when table definitions are evaluated at module load time
// Start binding immediately - the schema.ts getSchema() function will wait for this if needed
(function bindDefaultSchema() {
  // Simple synchronous platform detection
  if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
    // Browser/Web - use PGlite schema
    import('./drivers/pglite').then(({ schema: pgliteSchema }) => {
      bindSchema(pgliteSchema);
    }).catch(() => {
      // Will be retried when getDatabaseByName is called or in getSchema()
    });
  } else {
    // Default to SQLite Mobile for React Native/Node (more compatible)
    import('./drivers/sqlite-mobile').then(({ schema: sqliteMobileSchema }) => {
      bindSchema(sqliteMobileSchema);
    }).catch(() => {
      // Will be retried when getDatabaseByName is called or in getSchema()
    });
  }
})();
