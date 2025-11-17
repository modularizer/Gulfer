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
import {Database, DrizAndClient} from '../../abstract/database';
import {initializePglite} from "./setup";
import {AdapterCapabilities} from "../../abstract/capabilities";
import {adapterName, capabilities, RegistryEntry} from "./capabilities";


/**
 * SQLite PGlite Adapter Implementation
 * 
 * Note: This uses PostgreSQL, not SQLite, but provides the same interface.
 * Your schema should work with PostgreSQL (which is more feature-rich than SQLite).
 */
export class PgliteAdapter extends Database {
    getCapabilities(): AdapterCapabilities {
        return capabilities;
    }

  constructor() {
    super(adapterName);
  }


  async makeRegistryEntry(name: string): Promise<RegistryEntry> {
    return {
      name,
      adapterType: adapterName,
    };
  }

  /**
   * Open a database connection from a registry entry
   * Sets this.db and returns this adapter instance
   */
  async _openFromRegistry(entry: RegistryEntry): Promise<DrizAndClient> {
    const name = entry.name;
    const createDB = await initializePglite();
    return await createDB(entry);
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
  async _deleteDatabase(entry: RegistryEntry): Promise<void> {
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

  }
}
