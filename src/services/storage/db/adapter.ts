/**
 * Cross-platform database adapter for Drizzle ORM
 * Supports web (sql.js), React Native (expo-sqlite), and Node.js
 */

import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { drizzle as drizzleExpo } from 'drizzle-orm/expo-sqlite';
import { drizzle as drizzleSqlJs } from 'drizzle-orm/sql-js';
import { ExpoSqliteDatabase, SqlJsDatabase as DrizzleSqlJsDatabase } from 'drizzle-orm/sqlite';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

export type Database = ExpoSqliteDatabase | DrizzleSqlJsDatabase;

let dbInstance: Database | null = null;
let sqlJsDb: SqlJsDatabase | null = null;
let sqlJsModule: typeof import('sql.js') | null = null;

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
    
    if (!sqlJsDb) {
      // If not loaded from IndexedDB, create new database
      sqlJsModule = await initSqlJs({
        locateFile: (file: string) => {
          // In a web environment, sql.js will load the WASM file
          // You may need to configure this path based on your build setup
          return `https://sql.js.org/dist/${file}`;
        },
      });
      sqlJsDb = new sqlJsModule.Database();
      dbInstance = drizzleSqlJs(sqlJsDb);
    }
  } else {
    // React Native: Use expo-sqlite
    const sqlite = await SQLite.openDatabaseAsync('gulfer.db');
    dbInstance = drizzleExpo(sqlite);
  }

  return dbInstance;
}

/**
 * Get the database instance (initializes if needed)
 */
export async function getDatabase(): Promise<Database> {
  if (!dbInstance) {
    return await initDatabase();
  }
  return dbInstance;
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
                sqlJsModule = await initSqlJs({
                  locateFile: (file: string) => {
                    return `https://sql.js.org/dist/${file}`;
                  },
                });
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

