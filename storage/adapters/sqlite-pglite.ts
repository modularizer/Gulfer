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

import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { NoopLogger } from 'drizzle-orm/logger';
import type { Adapter, DatabaseAdapter, AdapterCapabilities } from './types';

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
        await registerDatabaseName(name);
      } catch {
        // Ignore errors if module not available
      }
    }

    try {
      // PGlite uses IndexedDB for persistence
      // Format: 'idb://database-name' stores in IndexedDB
      // PGlite automatically handles persistence - no manual save needed!
      const pglite = new PGlite(`idb://${name}`, {
        // Auto-save is built-in - PGlite persists automatically
      });

      // Wait for PGlite to initialize
      await pglite.waitReady;

      // Create Drizzle database instance using built-in PGlite driver
      const db = drizzle(pglite, {
        logger: new NoopLogger(),
      });

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

