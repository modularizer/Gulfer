/**
 * SQL Transformation Utilities
 * 
 * Generic utilities for transforming SQL strings between dialects
 * and making SQL statements idempotent.
 * 
 * These are pure string manipulation functions with no dependencies.
 */

/**
 * Convert CREATE TABLE to CREATE TABLE IF NOT EXISTS (idempotent)
 * Also converts CREATE INDEX to CREATE INDEX IF NOT EXISTS
 * 
 * @param sql - SQL string to make idempotent
 * @returns SQL string with IF NOT EXISTS added to CREATE statements
 * 
 * @example
 * ```ts
 * const sql = 'CREATE TABLE users (id INTEGER PRIMARY KEY);';
 * const idempotent = makeIdempotent(sql);
 * // Returns: 'CREATE TABLE IF NOT EXISTS "users" (id INTEGER PRIMARY KEY);'
 * ```
 */
export function makeIdempotent(sql: string): string {
  let result = sql;
  
  // Remove statement-breakpoint comments first
  result = result.replace(/--> statement-breakpoint\n/gi, '');
  
  // Replace CREATE TABLE with CREATE TABLE IF NOT EXISTS (only if not already present)
  // Match: CREATE TABLE (optional quotes) table_name
  // But NOT: CREATE TABLE IF NOT EXISTS
  result = result.replace(/CREATE TABLE\s+(?!IF NOT EXISTS\s+)(["']?)(\w+)\1/gi, 'CREATE TABLE IF NOT EXISTS "$2"');
  
  // Replace CREATE INDEX with CREATE INDEX IF NOT EXISTS (only if not already present)
  // Match: CREATE (UNIQUE )?INDEX (optional quotes) index_name
  // But NOT: CREATE INDEX IF NOT EXISTS
  result = result.replace(/CREATE (UNIQUE )?INDEX\s+(?!IF NOT EXISTS\s+)(["']?)(\w+)\2/gi, 'CREATE $1INDEX IF NOT EXISTS "$3"');
  
  return result;
}

/**
 * Convert SQLite SQL to PostgreSQL SQL
 * 
 * Handles common dialect differences:
 * - INTEGER PRIMARY KEY AUTOINCREMENT -> SERIAL PRIMARY KEY
 * - text(length) -> VARCHAR(length)
 * - Backticks -> Double quotes (if needed)
 * 
 * @param sql - SQLite SQL string
 * @returns PostgreSQL-compatible SQL string
 * 
 * @example
 * ```ts
 * const sqlite = 'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name text(200));';
 * const postgres = convertToPostgres(sqlite);
 * // Returns: 'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(200));'
 * ```
 */
export function convertToPostgres(sql: string): string {
  let result = sql;
  
  // SQLite uses INTEGER PRIMARY KEY AUTOINCREMENT
  // PostgreSQL uses SERIAL PRIMARY KEY
  result = result.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');
  
  // SQLite uses text(length) for VARCHAR
  // PostgreSQL doesn't allow type modifiers on text, must use VARCHAR(length)
  // Match: "column_name" text(200), with any whitespace (tabs, spaces, newlines)
  result = result.replace(/"(\w+)"\s+text\((\d+)\)/gi, '"$1" VARCHAR($2)');
  // Also match standalone text(200) without quotes (fallback)
  result = result.replace(/\btext\((\d+)\)/gi, 'VARCHAR($1)');
  
  // SQLite uses INTEGER for booleans with mode: 'boolean'
  // PostgreSQL also uses INTEGER (we keep it for compatibility)
  // Schema definitions should use 0/1 for defaults, not false/true
  
  // SQLite timestamp is INTEGER with mode: 'timestamp'
  // PostgreSQL uses TIMESTAMP or BIGINT
  // Keep as INTEGER for now (can store Unix timestamps)
  
  // Foreign key syntax differences
  // SQLite: ON UPDATE no action ON DELETE cascade
  // PostgreSQL: ON UPDATE NO ACTION ON DELETE CASCADE (uppercase, but both work)
  
  return result;
}

/**
 * Convert backticks to double quotes in SQL (SQLite/PostgreSQL standard)
 * 
 * @param sql - SQL string with backticks
 * @returns SQL string with double quotes
 */
export function convertBackticksToQuotes(sql: string): string {
  return sql.replace(/`/g, '"');
}

/**
 * Generate hash from SQL content
 * 
 * Note: In Node.js environments, this uses the built-in crypto module.
 * For browser/mobile use, this falls back to a simple hash function.
 * 
 * @param sql - SQL string to hash
 * @param algorithm - Hash algorithm ('md5' or 'sha256')
 * @param length - Length of hash to return (default: 16)
 * @returns Hash string
 */
export function hashSQL(sql: string, algorithm: 'md5' | 'sha256' = 'md5', length: number = 16): string {
  // Try to use Node.js crypto module if available
  try {
    // Use dynamic import for ESM or require for CommonJS
    let crypto: any;
    if (typeof require !== 'undefined') {
      crypto = require('crypto');
    } else if (typeof window === 'undefined' && typeof globalThis !== 'undefined') {
      // Try to import crypto in ESM context (Node.js)
      // This will be handled at build time for Node.js scripts
      try {
        crypto = eval('require')('crypto');
      } catch {
        // Fall through to fallback
      }
    }
    
    if (crypto && crypto.createHash) {
      return crypto.createHash(algorithm).update(sql).digest('hex').substring(0, length);
    }
  } catch {
    // Fall through to fallback
  }
  
  // Fallback for environments without Node.js crypto
  // This is a simple hash that's not cryptographically secure, but works for content hashing
  let hash = 0;
  for (let i = 0; i < sql.length; i++) {
    const char = sql.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).substring(0, length).padStart(length, '0');
}

