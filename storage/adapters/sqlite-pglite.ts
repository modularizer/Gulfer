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
import type { Adapter, DatabaseAdapter, AdapterCapabilities } from './types';

// Try to import PGlite at the top level - Babel will transform import.meta
// If this fails, we'll fall back to dynamic import
let PGliteClass: any;
try {
  // Use require for better Metro compatibility, but it might not work with ES modules
  // We'll try dynamic import in the function instead
} catch {
  // Ignore - will use dynamic import
}

/**
 * SQLite PGlite Adapter Implementation
 * 
 * Note: This uses PostgreSQL, not SQLite, but provides the same interface.
 * Your schema should work with PostgreSQL (which is more feature-rich than SQLite).
 */
export class SqlitePgliteAdapter implements Adapter {
  getCapabilities(): AdapterCapabilities {
    return {
      supportsNamedDatabases: true,
      supportsGetTableNames: true,
      databaseType: 'postgres', // PGlite is PostgreSQL
      platform: 'web',
    };
  }

  /**
   * Get or create a database by name
   * 
   * PGlite persists to IndexedDB automatically using the format: `idb://{name}`
   * 
   * @param name - The logical database name (e.g., "gulfer-test")
   *               PGlite stores this in IndexedDB automatically
   * @returns A Drizzle database instance that implements DatabaseAdapter
   */
  async getDatabaseByName(name: string): Promise<DatabaseAdapter> {
    // Register the database name in the registry
    if (typeof window !== 'undefined') {
      try {
        const { registerDatabaseName } = await import('./list-databases');
        await registerDatabaseName(name, 'pglite');
        console.log(`[sqlite-pglite] ✅ Registered database name in registry: ${name} (pglite)`);
      } catch (error) {
        console.error(`[sqlite-pglite] ❌ Could not register database name in registry:`, error);
      }
    }

    try {
      // Import PGlite and Drizzle directly - Metro will bundle them
      // We use standard imports, and Babel will transform import.meta
      console.log('[sqlite-pglite] Importing @electric-sql/pglite...');
      
      // Declare PGlite variable for this function scope
      let PGlite: any;
      
      // Try ES module import first
      let pgliteMod: any;
      try {
        pgliteMod = await import('@electric-sql/pglite');
      } catch (importError: any) {
        console.error('[sqlite-pglite] ES module import failed:', importError);
        // Try CommonJS require as fallback
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          pgliteMod = require('@electric-sql/pglite');
        } catch (requireError: any) {
          console.error('[sqlite-pglite] CommonJS require also failed:', requireError);
          throw new Error(`Failed to import @electric-sql/pglite: ES module error: ${importError?.message}, CommonJS error: ${requireError?.message}`);
        }
      }
      
      console.log('[sqlite-pglite] PGlite module imported, keys:', Object.keys(pgliteMod || {}));
      console.log('[sqlite-pglite] pgliteMod type:', typeof pgliteMod);
      console.log('[sqlite-pglite] pgliteMod.default:', pgliteMod?.default);
      
      // Check what we got from the import
      if (!pgliteMod) {
        throw new Error('Failed to import @electric-sql/pglite: module is undefined');
      }
      
      // PGlite is exported as a named export in the source
      // Metro preserves ES module structure, so access it directly
      console.log('[sqlite-pglite] Checking for PGlite export...');
      console.log('[sqlite-pglite] pgliteMod.PGlite:', pgliteMod.PGlite);
      console.log('[sqlite-pglite] pgliteMod.PGlite type:', typeof pgliteMod.PGlite);
      
      PGlite = pgliteMod.PGlite;
      
      // If PGlite is in the keys but the value is undefined, Metro might have transformed it
      if (!PGlite && 'PGlite' in pgliteMod) {
        console.warn('[sqlite-pglite] PGlite key exists but value is undefined/null');
        // Try accessing via bracket notation in case it's a getter
        try {
          PGlite = pgliteMod['PGlite'];
        } catch (e) {
          console.error('[sqlite-pglite] Error accessing PGlite:', e);
        }
      }
      
      // If still not found, check if default has it (Metro CommonJS transformation)
      if (!PGlite && pgliteMod.default) {
        console.log('[sqlite-pglite] Checking default export...');
        if (typeof pgliteMod.default === 'object') {
          PGlite = pgliteMod.default.PGlite;
        } else if (typeof pgliteMod.default === 'function') {
          PGlite = pgliteMod.default;
        }
      }
      
      if (!PGlite) {
        console.error('[sqlite-pglite] PGlite module contents:', Object.keys(pgliteMod));
        console.error('[sqlite-pglite] pgliteMod.default:', pgliteMod.default);
        console.error('[sqlite-pglite] pgliteMod.default type:', typeof pgliteMod.default);
        console.error('[sqlite-pglite] pgliteMod.default keys:', pgliteMod.default ? Object.keys(pgliteMod.default) : 'N/A');
        throw new Error(`Failed to find PGlite in @electric-sql/pglite module. Available exports: ${Object.keys(pgliteMod).join(', ')}`);
      }
      
      console.log('[sqlite-pglite] PGlite class found:', typeof PGlite);
      
      // Manually construct Drizzle database using core classes
      // This is faster than loading the full drizzle-orm/pglite driver
      const { PgDialect } = await import('drizzle-orm/pg-core/dialect');
      const { PgDatabase } = await import('drizzle-orm/pg-core/db');
      const { PgSession, PgPreparedQuery } = await import('drizzle-orm/pg-core/session');
      
      // Create a minimal prepared query wrapper that uses PGlite's query method
      class PglitePreparedQuery extends PgPreparedQuery {
        private client: any;
        private dialect: any;
        constructor(client: any, dialect: any, query: any, cache: any, queryMetadata: any, cacheConfig: any) {
          super(query, cache, queryMetadata, cacheConfig);
          this.client = client;
          this.dialect = dialect;
        }
        
        async execute(): Promise<any> {
          const queryObj = this.getQuery();
          if (!queryObj || typeof queryObj !== 'object' || !('sql' in queryObj)) {
            throw new Error('Invalid query object from getQuery()');
          }
          
          const sqlString = queryObj.sql;
          const params = queryObj.params || [];
          
          const result = await this.client.query(sqlString, params);
          return result.rows || [];
        }
      }
      
      // Create a minimal session wrapper
      class PgliteSession extends PgSession {
        private client: any;
        private dialect: any;
        constructor(client: any, dialect: any, schema: any, options: any) {
          super(dialect);
          this.client = client;
          this.dialect = dialect;
        }
        
        prepareQuery(query: any, fields: any, name: any, isResponseInArrayMode: any, customResultMapper: any, queryMetadata: any, cacheConfig: any): any {
          return new PglitePreparedQuery(this.client, this.dialect, query, undefined, queryMetadata, cacheConfig);
        }
        
        async transaction(transactionFn: any, config: any): Promise<any> {
          // PGlite doesn't support transactions in the same way, so just execute the function
          return await transactionFn(this as any);
        }
      }
      
      // Create drizzle function that manually constructs the database
      const drizzle = (client: any, config: any = {}) => {
        const dialect = new PgDialect({ casing: config.casing });
        const session = new PgliteSession(client, dialect, undefined, {
          logger: config.logger,
          cache: config.cache,
        });
        const db = new PgDatabase(dialect, session, undefined) as any;
        db.$client = client;
        return db;
      };

      // PGlite uses IndexedDB for persistence
      // Format: 'idb://database-name' stores in IndexedDB
      // PGlite automatically handles persistence - no manual save needed!
      // We need to provide the data file from the public directory
      // since Metro bundling interferes with loading it from node_modules
      // PGlite expects the file to be exactly 4939155 bytes
      let fsBundle: Blob | undefined;
      try {
        // Try to load the data file from public directory
        const response = await fetch('/pglite/pglite.data');
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          console.log('[sqlite-pglite] Loaded pglite.data from public directory:', arrayBuffer.byteLength, 'bytes');
          
          // Verify the size matches what PGlite expects
          if (arrayBuffer.byteLength === 4939155) {
            fsBundle = new Blob([arrayBuffer]);
            console.log('[sqlite-pglite] ✅ File size matches expected size');
          } else {
            console.warn(`[sqlite-pglite] ⚠️ File size mismatch: got ${arrayBuffer.byteLength}, expected 4939155. PGlite will try to load it automatically.`);
            fsBundle = undefined; // Let PGlite handle it
          }
        } else {
          console.warn('[sqlite-pglite] Could not load pglite.data from public directory (status:', response.status, '), PGlite will try to load it automatically');
        }
      } catch (error) {
        console.warn('[sqlite-pglite] Error loading pglite.data from public directory:', error);
        // PGlite will try to load it automatically
      }
      
      // Load WASM file from public directory to avoid MIME type issues
      let wasmModule: WebAssembly.Module | undefined;
      try {
        const wasmResponse = await fetch('/pglite/pglite.wasm');
        if (wasmResponse.ok) {
          const wasmArrayBuffer = await wasmResponse.arrayBuffer();
          console.log('[sqlite-pglite] Loaded pglite.wasm from public directory:', wasmArrayBuffer.byteLength, 'bytes');
          wasmModule = await WebAssembly.compile(wasmArrayBuffer);
          console.log('[sqlite-pglite] ✅ WASM module compiled successfully');
        } else {
          console.warn('[sqlite-pglite] Could not load pglite.wasm from public directory (status:', wasmResponse.status, '), PGlite will try to load it automatically');
        }
      } catch (error) {
        console.warn('[sqlite-pglite] Error loading pglite.wasm from public directory:', error);
        // PGlite will try to load it automatically
      }
      
      const pglite = new PGlite(`idb://${name}`, {
        // Auto-save is built-in - PGlite persists automatically
        // Provide the data bundle if we loaded it successfully
        ...(fsBundle ? { fsBundle } : {}),
        // Provide the WASM module if we loaded it successfully
        ...(wasmModule ? { wasmModule } : {}),
      });

      // Wait for PGlite to initialize
      await pglite.waitReady;

      // Create Drizzle database instance using standard PGlite driver
      // Don't pass logger option - let Drizzle use its default (which should work with CDN)
      const db = drizzle(pglite);

      // Store PGlite instance reference for getTableNames
      (db as any)._pglite = pglite;

      return db as DatabaseAdapter;
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

  /**
   * Get all table names in the database
   * 
   * Queries PostgreSQL's information_schema to get all user tables.
   * 
   * @param db - The database instance (must be from this adapter)
   * @returns Array of table names (excluding system tables and migration tables)
   */
  async getTableNames(db: DatabaseAdapter): Promise<string[]> {
    try {
      const dbWithPglite = db as any;
      if (!dbWithPglite._pglite) {
        return [];
      }

      // Query PostgreSQL's information_schema
      const result = await dbWithPglite._pglite.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          AND table_name NOT LIKE '__%'
        ORDER BY table_name
      `);

      if (result.rows && Array.isArray(result.rows)) {
        return result.rows.map((row: any) => row.table_name || '').filter(Boolean);
      }

      return [];
    } catch (error) {
      console.error('Error getting table names:', error);
      return [];
    }
  }
}

