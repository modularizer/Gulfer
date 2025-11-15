/**
 * Cross-platform database adapter for Drizzle ORM
 * Supports web (sql.js), React Native (expo-sqlite), and Node.js
 */

import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import initSqlJs, { Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js';
import { drizzle as drizzleExpo } from 'drizzle-orm/expo-sqlite';
import { drizzle as drizzleSqlJs } from 'drizzle-orm/sql-js';

export type Database = ReturnType<typeof drizzleExpo> | ReturnType<typeof drizzleSqlJs>;

let dbInstance: Database | null = null;
let sqlJsDb: SqlJsDatabase | null = null;
let sqlJsModule: SqlJsStatic | null = null;
let saveTimeout: NodeJS.Timeout | null = null;

// Debounce save operations to avoid excessive IndexedDB writes
const SAVE_DEBOUNCE_MS = 100;

/**
 * Initialize the database adapter based on platform
 */
export async function initDatabase(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  if (Platform.OS === 'web') {
    // Web: Use sql.js (WASM SQLite)
    // Try to load from IndexedDB first
    await loadDatabase();
    
    if (!dbInstance && !sqlJsDb) {
      // If not loaded from IndexedDB, create new database
      const sqlJs = await initSqlJs({
        locateFile: (file: string) => {
          // In a web environment, sql.js will load the WASM file
          // You may need to configure this path based on your build setup
          return `https://sql.js.org/dist/${file}`;
        },
      });
      sqlJsModule = sqlJs;
      sqlJsDb = new sqlJs.Database();
      dbInstance = drizzleSqlJs(sqlJsDb);
    }
  } else {
    // React Native: Use expo-sqlite
    const sqlite = await SQLite.openDatabaseAsync('gulfer.db');
    dbInstance = drizzleExpo(sqlite);
  }

  if (!dbInstance) {
    throw new Error('Failed to initialize database');
  }

  return dbInstance;
}

/**
 * Get the database instance (initializes if needed)
 * Returns a wrapped database that automatically saves after write operations
 */
export async function getDatabase(): Promise<Database> {
  if (!dbInstance) {
    await initDatabase();
  }
  
  if (!dbInstance) {
    throw new Error('Database not initialized');
  }
  
  // Return a wrapped database that auto-saves after write operations
  return wrapDatabaseWithAutoSave(dbInstance);
}

/**
 * Schedule a debounced save operation
 * This ensures we don't save too frequently during rapid writes
 */
function scheduleAutoSave(): void {
  // Clear existing timeout
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  
  // Schedule a new save
  saveTimeout = setTimeout(async () => {
    await saveDatabase();
    saveTimeout = null;
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Wrap database with auto-save functionality
 * Automatically schedules saveDatabase() after insert, update, and delete operations
 */
function wrapDatabaseWithAutoSave(db: Database): Database {
  // Create a proxy that intercepts method calls
  return new Proxy(db, {
    get(target, prop) {
      const value = (target as any)[prop];
      
      // Wrap insert, update, and delete methods to auto-save
      if (prop === 'insert' || prop === 'update' || prop === 'delete') {
        // Return a function that wraps the builder
        return function(...args: any[]) {
          const builder = value.apply(target, args);
          
          // Wrap the builder's methods to detect when queries are executed
          return wrapBuilderWithAutoSave(builder);
        };
      }
      
      // For other properties/methods, return as-is
      if (typeof value === 'function') {
        return value.bind(target);
      }
      return value;
    }
  }) as Database;
}

/**
 * Wrap a Drizzle query builder to auto-save when executed
 */
function wrapBuilderWithAutoSave(builder: any): any {
  // Create a proxy that intercepts method calls on the builder
  return new Proxy(builder, {
    get(target, prop) {
      const value = (target as any)[prop];
      
      // If it's a method that returns a promise (query execution), wrap it
      if (typeof value === 'function') {
        return function(...args: any[]) {
          const result = value.apply(target, args);
          
          // If the result is a promise (query execution), schedule auto-save
          if (result && typeof result.then === 'function') {
            // Schedule save after query completes
            result.then(() => scheduleAutoSave()).catch(() => {
              // Don't save on error, but clear timeout if needed
              if (saveTimeout) {
                clearTimeout(saveTimeout);
                saveTimeout = null;
              }
            });
          }
          
          return result;
        };
      }
      
      // For non-function properties, return as-is
      return value;
    }
  });
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (Platform.OS === 'web' && sqlJsDb) {
    sqlJsDb.close();
    sqlJsDb = null;
  }
  dbInstance = null;
}

/**
 * Save database to IndexedDB (web only)
 * This allows persistence across page reloads
 */
export async function saveDatabase(): Promise<void> {
  if (Platform.OS === 'web' && sqlJsDb) {
    const data = sqlJsDb.export();
    const indexedDB = window.indexedDB;
    if (indexedDB) {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('gulfer_db', 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('database')) {
            db.createObjectStore('database');
          }
        };
        request.onsuccess = () => {
          const transaction = request.result.transaction(['database'], 'readwrite');
          const store = transaction.objectStore('database');
          const putRequest = store.put(data, 'main');
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = reject;
        };
        request.onerror = reject;
      });
    }
  }
}

/**
 * Load database from IndexedDB (web only)
 */
export async function loadDatabase(): Promise<void> {
  if (Platform.OS === 'web') {
    const indexedDB = window.indexedDB;
    if (indexedDB) {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('gulfer_db', 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('database')) {
            db.createObjectStore('database');
          }
        };
        request.onsuccess = async () => {
          const transaction = request.result.transaction(['database'], 'readonly');
          const store = transaction.objectStore('database');
          const getRequest = store.get('main');
          getRequest.onsuccess = async () => {
            if (getRequest.result) {
              if (!sqlJsModule) {
                const sqlJs = await initSqlJs({
                  locateFile: (file: string) => {
                    return `https://sql.js.org/dist/${file}`;
                  },
                });
                sqlJsModule = sqlJs;
              }
              sqlJsDb = new sqlJsModule.Database(getRequest.result);
              dbInstance = drizzleSqlJs(sqlJsDb);
            }
            resolve();
          };
          getRequest.onerror = reject;
        };
        request.onerror = reject;
      });
    }
  }
}

