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
