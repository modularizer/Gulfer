/**
 * SQLite PGlite Adapter
 * 
 * Uses PGlite (PostgreSQL in WebAssembly) for persistent SQL databases in the browser.
 * 
 * ✅ Real persistent database (uses IndexedDB for storage)
 * ✅ Automatic persistence (PGlite handles it - NO EXPORTS NEEDED!)
 * ✅ Efficient incremental writes
 * ✅ Full Drizzle ORM support (built-in PGlite driver)
 * ✅ NO COOP/COEP headers required!
 * 
 * PGlite is PostgreSQL in WASM, which means:
 * - Full SQL support (PostgreSQL dialect)
 * - Automatic persistence to IndexedDB
 * - No special server headers needed
 * - Works out of the box with Expo dev server
 */

// PGlite uses import.meta which Metro doesn't support
// Babel plugin will transform import.meta to work with Metro
import {AdapterCapabilities, AdapterType, Dialect, RegistryEntry, PlatformName, adapterCapabilities} from '../types';
import {Adapter, DrizzleDatabase} from '../adapter';
import {PgDialect} from 'drizzle-orm/pg-core/dialect';
import {PgDatabase} from 'drizzle-orm/pg-core/db';
import {PgPreparedQuery, PgSession} from 'drizzle-orm/pg-core/session';
import type { SchemaBuilder } from '../schema-builder';
import { 
  pgTable as pgTableFn, 
  varchar, 
  integer, 
  unique, 
  real, 
  index, 
  text,
  jsonb,
  boolean as bool,
  timestamp
} from 'drizzle-orm/pg-core';

// UUID helpers for convenience (using varchar since PostgreSQL doesn't have a native UUID type in drizzle)
const uuid = (name: string) => varchar(name);
const uuidDefault = (name: string) => uuid(name);
const uuidPK = (name: string) => uuidDefault(name).primaryKey();

// ============================================================================
// Early PGlite Initialization
// ============================================================================
// Pre-load PGlite module, fsBundle, and wasmModule early to avoid delays
// and MIME type issues when opening databases

let pgliteModuleCache: any = null;
let fsBundleCache: Response | null | undefined = undefined;
let wasmModuleCache: WebAssembly.Module | null | undefined = undefined;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize PGlite early - loads module, fsBundle, and wasmModule
 * This should be called as early as possible, ideally on module import
 */
export async function initializePglite(): Promise<void> {
  // If already initializing or initialized, return the existing promise
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      // 1. Import PGlite module
      if (!pgliteModuleCache) {
        console.log('[pglite] Early initialization: Importing @electric-sql/pglite...');
        pgliteModuleCache = await import('@electric-sql/pglite');
        console.log('[pglite] PGlite module imported, keys:', Object.keys(pgliteModuleCache || {}));
      }

      // 2. Pre-load fsBundle as Response object
      if (fsBundleCache === undefined) {
        try {
          const response = await fetch('/pglite/pglite.data');
          if (response.ok) {
            fsBundleCache = response;
            console.log('[pglite] Early initialization: fsBundle loaded');
          } else {
            fsBundleCache = null; // Mark as attempted but failed
            console.warn('[pglite] Early initialization: Could not load fsBundle (status:', response.status, ')');
          }
        } catch (error) {
          fsBundleCache = null; // Mark as attempted but failed
          console.warn('[pglite] Early initialization: Error loading fsBundle:', error);
        }
      }

      // 3. Pre-load and compile WASM module
      if (wasmModuleCache === undefined) {
        try {
          const wasmResponse = await fetch('/pglite/pglite.wasm');
          if (wasmResponse.ok) {
            const wasmArrayBuffer = await wasmResponse.arrayBuffer();
            wasmModuleCache = await WebAssembly.compile(wasmArrayBuffer);
            console.log('[pglite] Early initialization: WASM module compiled');
          } else {
            wasmModuleCache = null; // Mark as attempted but failed
            console.warn('[pglite] Early initialization: Could not load WASM (status:', wasmResponse.status, ')');
          }
        } catch (error) {
          wasmModuleCache = null; // Mark as attempted but failed
          console.warn('[pglite] Early initialization: Error loading WASM:', error);
        }
      }

      console.log('[pglite] Early initialization complete');
    } catch (error) {
      console.error('[pglite] Early initialization failed:', error);
      throw error;
    }
  })();

  return initializationPromise;
}

// Auto-initialize on module import (non-blocking)
if (typeof window !== 'undefined') {
  // Only initialize in browser environment
  initializePglite().catch((error) => {
    console.warn('[pglite] Auto-initialization failed (will retry on first use):', error);
  });
}

/**
 * PostgreSQL Schema Builder
 * Exports schema functions for PostgreSQL dialect
 */
export const schema: SchemaBuilder = {
    table: pgTableFn,
    text,
    varchar,
    integer,
    real,
    timestamp,
    jsonb,
    bool,
    uuid,
    uuidDefault,
    uuidPK,
    unique,
    index,
};








/**
 * SQLite PGlite Adapter Implementation
 * 
 * Note: This uses PostgreSQL, not SQLite, but provides the same interface.
 * Your schema should work with PostgreSQL (which is more feature-rich than SQLite).
 */
export class PgliteAdapter extends Adapter {
  // Cache database connections to avoid re-importing PGlite and creating new instances
  private connectionCache = new Map<string, DrizzleDatabase>();

  constructor() {
    super(AdapterType.PGLITE);
  }

  /**
   * Get registry entry for a database
   */
  async getRegistryEntry(name: string): Promise<RegistryEntry> {
    return {
      name,
      adapterType: AdapterType.PGLITE,
      connectionInfo: {
        // PGlite uses IndexedDB, no additional connection info needed
      }
    };
  }

  /**
   * Open a database connection from a registry entry
   * Sets this.db and returns this adapter instance
   */
  async openFromRegistry(entry: RegistryEntry): Promise<this> {
    if (entry.adapterType !== AdapterType.PGLITE) {
      throw new Error(`PgliteAdapter cannot open ${entry.adapterType} database`);
    }

    const name = entry.name;
    
    // Return cached connection if available
    if (this.connectionCache.has(name)) {
      this.db = this.connectionCache.get(name)!;
      return this;
    }

    try {
      // Ensure PGlite is initialized (uses cached resources if available)
      await initializePglite();
      
      // Use cached module
      const pgliteModule = pgliteModuleCache;
      if (!pgliteModule) {
        throw new Error('Failed to import @electric-sql/pglite: module is undefined');
      }
      
      // Extract PGlite class from module
      let PGlite: any = pgliteModule.PGlite;
      
      if (!PGlite && 'PGlite' in pgliteModule) {
        console.warn('[pglite] PGlite key exists but value is undefined/null');
        try {
          PGlite = pgliteModule['PGlite'];
        } catch (e) {
          console.error('[pglite] Error accessing PGlite:', e);
        }
      }
      
      if (!PGlite && pgliteModule.default) {
        if (typeof pgliteModule.default === 'object') {
          PGlite = pgliteModule.default.PGlite;
        } else if (typeof pgliteModule.default === 'function') {
          PGlite = pgliteModule.default;
        }
      }
      
      if (!PGlite) {
        console.error('[pglite] PGlite module contents:', Object.keys(pgliteModule));
        throw new Error(`Failed to find PGlite in @electric-sql/pglite module. Available exports: ${Object.keys(pgliteModule).join(', ')}`);
      }
      
      // Drizzle classes are already imported at top level
      
      // Create a minimal prepared query wrapper that uses PGlite's query method
      class PglitePreparedQuery extends PgPreparedQuery {
        private client: any;
        private dialect: any;
        private fields: any;
        private customResultMapper: any;
        constructor(client: any, dialect: any, query: any, fields: any, name: any, isResponseInArrayMode: any, customResultMapper: any, queryMetadata: any, cacheConfig: any) {
          super(query, undefined, queryMetadata, cacheConfig);
          this.client = client;
          this.dialect = dialect;
          this.fields = fields;
          this.customResultMapper = customResultMapper;
        }
        
        async execute(): Promise<any> {
          const queryObj = this.getQuery();
          if (!queryObj || typeof queryObj !== 'object' || !('sql' in queryObj)) {
            throw new Error('Invalid query object from getQuery()');
          }
          
          const sql = queryObj.sql;
          const params = queryObj.params || [];
          
          // Use PGlite's query method directly
          const result = await this.client.query(sql, params);
          
          // Map result to Drizzle format
          if (this.fields && this.fields.length > 0) {
            const mapped = result.rows.map((row: any) => {
              const mappedRow: any = {};
              for (const field of this.fields) {
                const fieldName = field.name;
                if (fieldName in row) {
                  mappedRow[fieldName] = row[fieldName];
                }
              }
              return mappedRow;
            });
            
            if (this.customResultMapper) {
              return this.customResultMapper(mapped);
            }
            return mapped;
          }
          
          return result.rows;
        }
      }
      
      class PgliteSession extends PgSession {
        private client: any;
        private dialect: any;
        
        constructor(client: any, dialect: any) {
          super(dialect, undefined, undefined);
          this.client = client;
          this.dialect = dialect;
        }
        
        prepareQuery(query: any, fields: any, name: any, isResponseInArrayMode: any, customResultMapper: any, queryMetadata: any, cacheConfig: any): PglitePreparedQuery {
          return new PglitePreparedQuery(this.client, this.dialect, query, fields, name, isResponseInArrayMode, customResultMapper, queryMetadata, cacheConfig);
        }
        
        async transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
          // PGlite doesn't support transactions in the same way, so just execute the function
          return await callback(this);
        }
      }
      
      // Use cached fsBundle and wasmModule (loaded during early initialization)
      const pglite = new PGlite(`idb://${name}`, {
        ...(fsBundleCache && fsBundleCache !== null ? { fsBundle: fsBundleCache } : {}),
        ...(wasmModuleCache && wasmModuleCache !== null ? { wasmModule: wasmModuleCache } : {}),
      });

      await pglite.waitReady;

      const dialect = new PgDialect({ casing: 'default' });
      const session = new PgliteSession(pglite, dialect);
      const db = new PgDatabase(dialect, session, undefined) as any;

      (db as any)._pglite = pglite;

      this.connectionCache.set(name, db as DrizzleDatabase);
      this.db = db as DrizzleDatabase;

      return this;
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'object' && error !== null
        ? JSON.stringify(error, Object.getOwnPropertyNames(error))
        : String(error);
      
      throw new Error(
        `Failed to open PGlite database ${name}.\n` +
        `Error: ${errorMessage}`
      );
    }
  }

  async getTableNames(): Promise<string[]> {
    try {
      const dbWithPglite = this.db as any;
      if (!dbWithPglite._pglite) {
        throw new Error('Database instance does not have _pglite property');
      }

      const allTablesResult = await dbWithPglite._pglite.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      const allTables = allTablesResult.rows.map((row: any) => row.table_name);

      // Filter out system tables and migration tables
      return allTables.filter((table: string) => {
        return !table.startsWith('__') && !table.startsWith('sqlite_');
      });
    } catch (error) {
      console.error('[pglite.getTableNames] Error getting table names:', error);
      return [];
    }
  }


  async getViewNames(): Promise<string[]> {
    try {
      const dbWithPglite = this.db as any;
      if (!dbWithPglite._pglite) {
        throw new Error('Database instance does not have _pglite property');
      }

      const result = await dbWithPglite._pglite.query(`
        SELECT table_name 
        FROM information_schema.views 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);

      return result.rows.map((row: any) => row.table_name);
    } catch (error) {
      console.error('[pglite.getViewNames] Error getting view names:', error);
      return [];
    }
  }

  async getMaterializedViewNames(): Promise<string[]> {
    try {
      const dbWithPglite = this.db as any;
      if (!dbWithPglite._pglite) {
        throw new Error('Database instance does not have _pglite property');
      }

      const result = await dbWithPglite._pglite.query(`
        SELECT matviewname 
        FROM pg_matviews 
        WHERE schemaname = 'public'
        ORDER BY matviewname
      `);

      return result.rows.map((row: any) => row.matviewname);
    } catch (error) {
      console.error('[pglite.getMaterializedViewNames] Error getting materialized view names:', error);
      return [];
    }
  }

  async getTableColumns(tableName: string): Promise<Array<{
    name: string;
    dataType: string;
    isNullable: boolean;
  }>> {
    try {
      const dbWithPglite = this.db as any;
      if (!dbWithPglite._pglite) {
        throw new Error('Database instance does not have _pglite property');
      }

      const result = await dbWithPglite._pglite.query(`
        SELECT 
          column_name as name,
          data_type as "dataType",
          is_nullable = 'YES' as "isNullable"
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      return result.rows.map((row: any) => ({
        name: row.name,
        dataType: row.dataType || row.data_type || 'unknown',
        isNullable: row.isNullable !== undefined ? row.isNullable : row.is_nullable === 'YES',
      }));
    } catch (error) {
      console.error('[pglite.getTableColumns] Error getting table columns:', error);
      return [];
    }
  }

  /**
   * Delete a PGLite database
   */
  async deleteDatabase(entry: RegistryEntry): Promise<void> {
    const indexedDB = typeof window !== 'undefined' ? window.indexedDB : null;
    if (!indexedDB) {
      throw new Error('IndexedDB is not available');
    }

    // PGlite stores databases as idb://{name}, which creates IndexedDB DBs at /pglite/{name}
    const indexedDbName = `/pglite/${entry.name}`;
    await new Promise<void>((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(indexedDbName);
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
      deleteRequest.onblocked = () => {
        // Database is blocked, wait a bit and try again
        setTimeout(() => {
          const retryRequest = indexedDB.deleteDatabase(indexedDbName);
          retryRequest.onsuccess = () => resolve();
          retryRequest.onerror = () => reject(retryRequest.error);
        }, 100);
      };
    });

    // Remove from connection cache
    this.connectionCache.delete(entry.name);
  }
}
