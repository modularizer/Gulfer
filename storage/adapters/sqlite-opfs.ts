/**
 * SQLite OPFS Adapter
 * 
 * Implements the Adapter interface for SQLite WASM with OPFS (Origin Private File System).
 * This adapter provides real persistent SQLite databases in the browser.
 * 
 * ✅ Real file-based persistence (not in-memory)
 * ✅ Automatic persistence (OPFS handles it - NO EXPORTS NEEDED!)
 * ✅ Efficient incremental writes (OPFS writes directly to disk)
 * ✅ Full Drizzle ORM support (via sqlite-opfs-drizzle.ts)
 * 
 * Requirements:
 * - Browser must support OPFS (Chrome 86+, Edge 86+, Safari 15.2+)
 * - Server must send COOP/COEP headers:
 *   Cross-Origin-Opener-Policy: same-origin
 *   Cross-Origin-Embedder-Policy: require-corp
 * 
 * Architecture:
 * - This file: Adapter interface implementation (getDatabaseByName, getTableNames, etc.)
 * - sqlite-opfs-drizzle.ts: Drizzle ORM integration (OpfsSession, OpfsPreparedQuery, etc.)
 */

// Dynamic import to avoid import.meta issues with Metro bundler
// We'll load this at runtime instead of at module load time
import { SQLiteAsyncDialect } from 'drizzle-orm/sqlite-core/dialect';
import { NoopLogger } from 'drizzle-orm/logger';
import type { Adapter, DatabaseAdapter, AdapterCapabilities } from './types';
import { createOpfsDrizzleDatabase } from './sqlite-opfs-drizzle';

/**
 * SQLite OPFS Adapter Implementation
 * 
 * This class implements the Adapter interface, handling:
 * - Adapter initialization and capabilities
 * - Database name registration
 * - Opening databases via OPFS
 * - Table name queries
 * 
 * The actual Drizzle ORM integration is handled by sqlite-opfs-drizzle.ts
 */
export class SqliteOpfsAdapter implements Adapter {
  private promiser: any = null;
  private initialized = false;
  private dialect: SQLiteAsyncDialect;

  constructor() {
    this.dialect = new SQLiteAsyncDialect();
  }

  getCapabilities(): AdapterCapabilities {
    return {
      supportsNamedDatabases: true,
      supportsGetTableNames: true,
      databaseType: 'sqlite',
      platform: 'web',
    };
  }

  /**
   * Check if OPFS prerequisites are available
   * OPFS requires SharedArrayBuffer and Atomics, which are only available
   * when the server sends COOP/COEP headers
   */
  private checkOpfsAvailability(): void {
    if (typeof window === 'undefined') {
      throw new Error('OPFS adapter requires a browser environment');
    }

    const missing: string[] = [];
    
    if (typeof SharedArrayBuffer === 'undefined') {
      missing.push('SharedArrayBuffer');
    }
    if (typeof Atomics === 'undefined') {
      missing.push('Atomics');
    }
    if (!navigator?.storage?.getDirectory) {
      missing.push('navigator.storage.getDirectory (OPFS API)');
    }

    if (missing.length > 0) {
      throw new Error(
        `OPFS is not available. Missing: ${missing.join(', ')}\n\n` +
        `OPFS requires COOP/COEP headers from your server:\n` +
        `  Cross-Origin-Opener-Policy: same-origin\n` +
        `  Cross-Origin-Embedder-Policy: require-corp\n\n` +
        `Expo's dev server doesn't send these headers by default.\n` +
        `For development, you may need to:\n` +
        `  1. Use a different adapter (e.g., sqlite-mobile for testing)\n` +
        `  2. Configure a proxy/server to add these headers\n` +
        `  3. Deploy to production where headers can be configured`
      );
    }
  }

  /**
   * Initialize the SQLite worker promiser
   * This must be called before opening any databases
   */
  private async initialize(): Promise<void> {
    if (this.initialized && this.promiser) {
      return;
    }

    // Check OPFS availability first (fail fast with clear error)
    this.checkOpfsAvailability();

    try {
      // Wait for sqlite3Worker1Promiser to be available globally
      // It's loaded via script tag in app/_layout.tsx (to avoid Metro's import.meta issue)
      let sqlite3Worker1Promiser = (globalThis as any).sqlite3Worker1Promiser;
      
      // Wait up to 5 seconds for the script to load
      if (!sqlite3Worker1Promiser) {
        const maxWait = 5000; // 5 seconds
        const checkInterval = 100; // Check every 100ms
        const startTime = Date.now();
        
        while (!sqlite3Worker1Promiser && (Date.now() - startTime) < maxWait) {
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          sqlite3Worker1Promiser = (globalThis as any).sqlite3Worker1Promiser;
        }
      }
      
      if (!sqlite3Worker1Promiser) {
        throw new Error(
          'sqlite3Worker1Promiser not found. ' +
          'The @sqlite.org/sqlite-wasm package should be loaded via script tag. ' +
          'Check that app/_layout.tsx is loading it correctly.'
        );
      }

      this.promiser = await new Promise((resolve, reject) => {
        // TypeScript types don't include onready/onerror, but they're supported at runtime
        const _promiser = sqlite3Worker1Promiser({
          onready: () => {
            this.initialized = true;
            resolve(_promiser);
          },
          onerror: (err: any) => {
            reject(err);
          },
        } as any);
      });
    } catch (error) {
      throw new Error(
        `Failed to initialize SQLite OPFS. Make sure your server sends COOP/COEP headers:\n` +
        `  Cross-Origin-Opener-Policy: same-origin\n` +
        `  Cross-Origin-Embedder-Policy: require-corp\n` +
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get or create a database by name
   * 
   * Opens an OPFS database file and returns a Drizzle database instance.
   * The database is automatically persisted by OPFS - no manual save needed!
   * 
   * @param name - The logical database name (e.g., "gulfer-test")
   *               Stored as "{name}.sqlite3" in OPFS
   * @returns A Drizzle database instance that implements DatabaseAdapter
   */
  async getDatabaseByName(name: string): Promise<DatabaseAdapter> {
    // Register the database name in the registry
    if (typeof window !== 'undefined') {
      try {
        const { registerDatabaseName } = await import('./list-databases');
        await registerDatabaseName(name);
      } catch {
        // Ignore errors if module not available
      }
    }

    // Initialize the SQLite WASM promiser if needed
    await this.initialize();

    // Open database with OPFS
    // Format: 'file:dbname.sqlite3?vfs=opfs'
    const filename = `file:${name}.sqlite3?vfs=opfs`;

    try {
      const openResponse = await this.promiser('open', { filename });
      const { dbId } = openResponse;

      // Create Drizzle database instance using the Drizzle driver
      // This handles all the Drizzle ORM integration (session, prepared queries, etc.)
      const db = createOpfsDrizzleDatabase(
        this.promiser,
        dbId,
        this.dialect,
        undefined, // schema - can be passed if needed
        { logger: new NoopLogger() }
      );

      return db as DatabaseAdapter;
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'object' && error !== null
        ? JSON.stringify(error, Object.getOwnPropertyNames(error))
        : String(error);
      
      throw new Error(
        `Failed to open OPFS database ${name}.\n` +
        `OPFS requires COOP/COEP headers:\n` +
        `  Cross-Origin-Opener-Policy: same-origin\n` +
        `  Cross-Origin-Embedder-Policy: require-corp\n` +
        `\nFor local development, you may need to configure Expo to send these headers.\n` +
        `Error: ${errorMessage}`
      );
    }
  }

  /**
   * Get all table names in the database
   * 
   * Queries the sqlite_master table to get all user tables.
   * 
   * @param db - The database instance (must be from this adapter)
   * @returns Array of table names (excluding system tables and migration tables)
   */
  async getTableNames(db: DatabaseAdapter): Promise<string[]> {
    try {
      const dbWithOpfs = db as any;
      if (!dbWithOpfs._opfsDbId || !dbWithOpfs._opfsPromiser) {
        return [];
      }

      const result = await dbWithOpfs._opfsPromiser('exec', {
        dbId: dbWithOpfs._opfsDbId,
        sql: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__%'",
        returnValue: 'resultRows',
      });

      if (result.result && Array.isArray(result.result)) {
        return result.result.map((row: any) => {
          if (typeof row === 'string') return row;
          if (row && typeof row === 'object') {
            return row.name || row[0] || '';
          }
          return '';
        }).filter(Boolean);
      }

      return [];
    } catch (error) {
      console.error('Error getting table names:', error);
      return [];
    }
  }
}
