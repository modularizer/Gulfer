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
export class PgliteAdapter implements Adapter {
  // Cache database connections to avoid re-importing PGlite and creating new instances
  private connectionCache = new Map<string, DatabaseAdapter>();
  
  // Cache PGlite module and Drizzle classes to avoid re-importing
  private pgliteModule: any = null;
  private drizzleClasses: {
    PgDialect: any;
    PgDatabase: any;
    PgSession: any;
    PgPreparedQuery: any;
  } | null = null;

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
    // Return cached connection if available
    if (this.connectionCache.has(name)) {
      return this.connectionCache.get(name)!;
    }
    // Register the database name in the registry BEFORE creating the database
    // This ensures it's registered even if database creation fails
    if (typeof window !== 'undefined') {
      try {
        const { registerDatabaseName } = await import('./list-databases');
        await registerDatabaseName(name, 'pglite');
        console.log(`[pglite] ✅ Registered database name in registry: ${name} (pglite)`);
      } catch (error) {
        // Log error but don't fail - registry is for convenience, not required
        console.error(`[pglite] ❌ Could not register database name in registry:`, error);
        // Re-throw if it's a critical error, but for now just warn
      }
    }

    try {
      // Import PGlite module (cached after first import)
      if (!this.pgliteModule) {
        console.log('[pglite] Importing @electric-sql/pglite...');
        
        // Try ES module import first
        try {
          this.pgliteModule = await import('@electric-sql/pglite');
        } catch (importError: any) {
          console.error('[pglite] ES module import failed:', importError);
          // Try CommonJS require as fallback
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            this.pgliteModule = require('@electric-sql/pglite');
          } catch (requireError: any) {
            console.error('[pglite] CommonJS require also failed:', requireError);
            throw new Error(`Failed to import @electric-sql/pglite: ES module error: ${importError?.message}, CommonJS error: ${requireError?.message}`);
          }
        }
        
        console.log('[pglite] PGlite module imported, keys:', Object.keys(this.pgliteModule || {}));
      }
      
      // Check what we got from the import
      if (!this.pgliteModule) {
        throw new Error('Failed to import @electric-sql/pglite: module is undefined');
      }
      
      // Extract PGlite class from module
      let PGlite: any = this.pgliteModule.PGlite;
      
      // If PGlite is in the keys but the value is undefined, Metro might have transformed it
      if (!PGlite && 'PGlite' in this.pgliteModule) {
        console.warn('[pglite] PGlite key exists but value is undefined/null');
        // Try accessing via bracket notation in case it's a getter
        try {
          PGlite = this.pgliteModule['PGlite'];
        } catch (e) {
          console.error('[pglite] Error accessing PGlite:', e);
        }
      }
      
      // If still not found, check if default has it (Metro CommonJS transformation)
      if (!PGlite && this.pgliteModule.default) {
        if (typeof this.pgliteModule.default === 'object') {
          PGlite = this.pgliteModule.default.PGlite;
        } else if (typeof this.pgliteModule.default === 'function') {
          PGlite = this.pgliteModule.default;
        }
      }
      
      if (!PGlite) {
        console.error('[pglite] PGlite module contents:', Object.keys(this.pgliteModule));
        throw new Error(`Failed to find PGlite in @electric-sql/pglite module. Available exports: ${Object.keys(this.pgliteModule).join(', ')}`);
      }
      
      // Import Drizzle classes (cached after first import)
      if (!this.drizzleClasses) {
        const { PgDialect } = await import('drizzle-orm/pg-core/dialect');
        const { PgDatabase } = await import('drizzle-orm/pg-core/db');
        const { PgSession, PgPreparedQuery } = await import('drizzle-orm/pg-core/session');
        this.drizzleClasses = { PgDialect, PgDatabase, PgSession, PgPreparedQuery };
      }
      
      const { PgDialect, PgDatabase, PgSession, PgPreparedQuery } = this.drizzleClasses;
      
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
          
          const sqlString = queryObj.sql;
          const params = queryObj.params || [];
          
          const result = await this.client.query(sqlString, params);
          const rows = result.rows || [];
          
          // Apply Drizzle's column mapping if fields are provided
          // Fields contain the schema definition with proper column name mapping
          if (this.fields && this.fields.length > 0) {
            // Log field structure for debugging
            if (rows.length > 0) {
              console.log('[PgliteAdapter] Mapping fields. First field sample:', this.fields[0]);
              console.log('[PgliteAdapter] First row before mapping:', rows[0]);
            }
            
            return rows.map((row: any) => {
              const mapped: any = {};
              
              // Map each field from database column name to TypeScript property name
              for (const field of this.fields) {
                // Field structure: {path: Array(1), field: SQLiteText}
                // field.field is the SQLite column definition (SQLiteText, SQLiteReal, etc.)
                // field.field.name is the database column name (e.g., 'venue_id')
                // The TypeScript property name comes from the path or field.name
                let dbColumnName: string | undefined;
                let tsPropertyName: string | undefined;
                
                // Get database column name from SQLite column definition
                // SQLite column types (SQLiteText, SQLiteReal, etc.) have a 'name' property
                if (field.field?.name) {
                  dbColumnName = field.field.name;
                } else if (field.sourceColumn?.name) {
                  dbColumnName = field.sourceColumn.name;
                } else if (field.column?.name) {
                  dbColumnName = field.column.name;
                }
                
                // Get TypeScript property name from path or field.name
                // path is typically ['tableName', 'propertyName'] or ['propertyName']
                if (field.path && Array.isArray(field.path) && field.path.length > 0) {
                  // Last element of path is usually the property name
                  tsPropertyName = field.path[field.path.length - 1];
                } else if (field.name) {
                  tsPropertyName = field.name;
                } else if (field.field?.name) {
                  // Fallback: use column name as property name
                  tsPropertyName = field.field.name;
                }
                
                if (!dbColumnName || !tsPropertyName) {
                  console.warn('[PgliteAdapter] Cannot determine mapping for field:', JSON.stringify(field, null, 2));
                  continue;
                }
                
                // Map from database column name (snake_case) to TypeScript property name (camelCase)
                if (row[dbColumnName] !== undefined) {
                  mapped[tsPropertyName] = row[dbColumnName];
                } else if (row[tsPropertyName] !== undefined) {
                  // Already mapped or same name
                  mapped[tsPropertyName] = row[tsPropertyName];
                }
              }
              
              // For joined tables or computed fields, preserve original keys
              // These might be namespaced (e.g., row.venues, row.events) or flat
              for (const key in row) {
                if (!(key in mapped)) {
                  mapped[key] = row[key];
                }
              }
              
              if (rows.length > 0 && rows.indexOf(row) === 0) {
                console.log('[PgliteAdapter] First row after mapping:', mapped);
              }
              
              return mapped;
            });
          }
          
          // If no fields provided, return as-is (for raw queries)
          return rows;
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
          return new PglitePreparedQuery(this.client, this.dialect, query, fields, name, isResponseInArrayMode, customResultMapper, queryMetadata, cacheConfig);
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
          console.log('[pglite] Loaded pglite.data from public directory:', arrayBuffer.byteLength, 'bytes');
          
          // Verify the size matches what PGlite expects
          if (arrayBuffer.byteLength === 4939155) {
            fsBundle = new Blob([arrayBuffer]);
            console.log('[pglite] ✅ File size matches expected size');
          } else {
            console.warn(`[pglite] ⚠️ File size mismatch: got ${arrayBuffer.byteLength}, expected 4939155. PGlite will try to load it automatically.`);
            fsBundle = undefined; // Let PGlite handle it
          }
        } else {
          console.warn('[pglite] Could not load pglite.data from public directory (status:', response.status, '), PGlite will try to load it automatically');
        }
      } catch (error) {
        console.warn('[pglite] Error loading pglite.data from public directory:', error);
        // PGlite will try to load it automatically
      }
      
      // Load WASM file from public directory to avoid MIME type issues
      let wasmModule: WebAssembly.Module | undefined;
      try {
        const wasmResponse = await fetch('/pglite/pglite.wasm');
        if (wasmResponse.ok) {
          const wasmArrayBuffer = await wasmResponse.arrayBuffer();
          console.log('[pglite] Loaded pglite.wasm from public directory:', wasmArrayBuffer.byteLength, 'bytes');
          wasmModule = await WebAssembly.compile(wasmArrayBuffer);
          console.log('[pglite] ✅ WASM module compiled successfully');
        } else {
          console.warn('[pglite] Could not load pglite.wasm from public directory (status:', wasmResponse.status, '), PGlite will try to load it automatically');
        }
      } catch (error) {
        console.warn('[pglite] Error loading pglite.wasm from public directory:', error);
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

      // Cache the connection
      this.connectionCache.set(name, db as DatabaseAdapter);

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

      // Check all tables in all schemas
      const allTablesResult = await dbWithPglite._pglite.query(`
        SELECT table_schema, table_name, table_type
        FROM information_schema.tables 
        WHERE table_type = 'BASE TABLE'
        ORDER BY table_schema, table_name
      `);
      
      // Filter in JavaScript instead of SQL (PGLite WHERE clause might have issues)
      if (allTablesResult.rows && Array.isArray(allTablesResult.rows)) {
        const publicTables = allTablesResult.rows
          .filter((row: any) => {
            const schema = row.table_schema || row['table_schema'];
            const tableName = row.table_name || row['table_name'];
            const isPublic = schema === 'public';
            const isNotSystemTable = tableName && !tableName.startsWith('__');
            return isPublic && isNotSystemTable;
          })
          .map((row: any) => {
            const tableName = row.table_name || row['table_name'] || '';
            return tableName;
          })
          .filter(Boolean);
        
        return publicTables;
      }

      return [];
    } catch (error) {
      console.error('[pglite.getTableNames] Error getting table names:', error);
      throw error; // Re-throw so caller can see the error
    }
  }
}

