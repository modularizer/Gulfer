import { sqliteTable, text, integer, unique, real, index } from 'drizzle-orm/sqlite-core';



// ============================================================================
// SQLite adapters
// =======================================================================
const jsonb = (name: string) => text(name, {mode: 'json'});
const bool = (name: string) => integer(name, {mode: 'boolean'});
const timestamp = (name: string) => integer(name, {mode: 'timestamp'});
const table = sqliteTable;


const uuid = (name: string) => text(name);
const uuidDefault = (name: string) => uuid(name);
const uuidPK = (name: string) => uuidDefault(name).primaryKey();

export {
    table, text, integer, real, timestamp, jsonb, unique, index, bool, uuid, uuidPK, uuidDefault
}