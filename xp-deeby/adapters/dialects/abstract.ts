/**
 * Abstract Schema Definitions
 * 
 * Provides database-agnostic column and table definition functions.
 * These functions resolve to the appropriate dialect implementation based on
 * the adapter type that will be used at runtime.
 * 
 * For static schema definitions (drizzle-kit), you can specify the adapter type
 * or it will default based on the current adapter context.
 */

import type { AdapterType } from '../factory';
import { AdapterType as AdapterTypeEnum, getAdapter } from '../factory';

// Global adapter type context for schema definitions
// This allows schemas to be defined with awareness of which adapter will be used
let schemaAdapterType: AdapterType | null = null;

/**
 * Set the adapter type context for schema definitions
 * This should be called before defining schemas if you want to use a specific dialect
 */
export function setSchemaAdapterType(adapterType: AdapterType): void {
  schemaAdapterType = adapterType;
}

/**
 * Get the current schema adapter type
 * Falls back to detecting from the current adapter if not explicitly set
 */
async function getSchemaAdapterType(): Promise<AdapterType> {
  if (schemaAdapterType) {
    return schemaAdapterType;
  }
  
  // Try to detect from current adapter
  try {
    const adapter = await getAdapter();
    const capabilities = adapter.getCapabilities();
    
    if (capabilities.databaseType === 'postgres') {
      return AdapterTypeEnum.PGLITE;
    } else if (capabilities.databaseType === 'sqlite') {
      return AdapterTypeEnum.SQLITE_MOBILE;
    }
  } catch {
    // Adapter not available, default to SQLite for drizzle-kit
  }
  
  // Default to SQLite for static schema definitions (drizzle-kit compatibility)
  return AdapterTypeEnum.SQLITE_MOBILE;
}

// For static schema definitions, we need synchronous functions
// We'll use a lazy initialization pattern that defaults to SQLite for drizzle-kit
// but can be overridden by setting the schema adapter type

let cachedSchemaModule: any = null;

function getSchemaModuleSync(): any {
  if (cachedSchemaModule) {
    return cachedSchemaModule;
  }
  
  // For static definitions, default to SQLite (drizzle-kit compatibility)
  // Users can call setSchemaAdapterType() before defining schemas if they need PostgreSQL
  if (schemaAdapterType === AdapterTypeEnum.PGLITE || schemaAdapterType === AdapterTypeEnum.POSTGRES) {
    // Use require for synchronous loading
    cachedSchemaModule = require('./postgres');
  } else {
    cachedSchemaModule = require('./sqlite');
  }
  
  return cachedSchemaModule;
}

/**
 * Abstract schema functions - these resolve to the correct dialect implementation
 */
export function table(name: string, ...columns: any[]) {
  const schema = getSchemaModuleSync();
  return schema.table(name, ...columns);
}

export function text(name: string, ...args: any[]) {
  const schema = getSchemaModuleSync();
  return schema.text(name, ...args);
}

export function varchar(name: string, ...args: any[]) {
  const schema = getSchemaModuleSync();
  return schema.varchar(name, ...args);
}

export function integer(name: string, ...args: any[]) {
  const schema = getSchemaModuleSync();
  return schema.integer(name, ...args);
}

export function real(name: string, ...args: any[]) {
  const schema = getSchemaModuleSync();
  return schema.real(name, ...args);
}

export function timestamp(name: string, ...args: any[]) {
  const schema = getSchemaModuleSync();
  return schema.timestamp(name, ...args);
}

export function jsonb(name: string, ...args: any[]) {
  const schema = getSchemaModuleSync();
  return schema.jsonb(name, ...args);
}

export function bool(name: string, ...args: any[]) {
  const schema = getSchemaModuleSync();
  return schema.bool(name, ...args);
}

export function uuid(name: string, ...args: any[]) {
  const schema = getSchemaModuleSync();
  return schema.uuid(name, ...args);
}

export function uuidPK(name: string, ...args: any[]) {
  const schema = getSchemaModuleSync();
  return schema.uuidPK(name, ...args);
}

export function uuidDefault(name: string, ...args: any[]) {
  const schema = getSchemaModuleSync();
  return schema.uuidDefault(name, ...args);
}

export function unique(...args: any[]) {
  const schema = getSchemaModuleSync();
  return schema.unique(...args);
}

export function index(...args: any[]) {
  const schema = getSchemaModuleSync();
  return schema.index(...args);
}

