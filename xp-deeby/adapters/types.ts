/**
 * Adapter Types and Interface
 * 
 * Defines the contract that all database adapters must implement.
 * This allows the codebase to work with adapters before knowing which one will be used.
 */

import type { SQL } from 'drizzle-orm';

/**
 * Base interface for database operations
 * All adapters must implement this interface
 */
export interface DatabaseAdapter {
  /**
   * Execute a raw SQL query
   */
  execute(query: SQL): Promise<any>;
  
  /**
   * Start a select query builder
   */
  select(): any;
  
  /**
   * Start an insert query builder
   */
  insert(table: any): any;
  
  /**
   * Start an update query builder
   */
  update(table: any): any;
  
  /**
   * Start a delete query builder
   */
  delete(table: any): any;
}

/**
 * Adapter capabilities
 * Different adapters may support different features
 */
export interface AdapterCapabilities {
  /**
   * Whether this adapter supports named databases
   */
  supportsNamedDatabases: boolean;
  
  /**
   * Whether this adapter supports getting table names
   */
  supportsGetTableNames: boolean;
  
  /**
   * Database type identifier (e.g., 'sqlite', 'postgres')
   */
  databaseType: string;
  
  /**
   * Platform identifier
   */
  platform: string; // Note: This is kept as string for backward compatibility, but should match PlatformName enum values
}

/**
 * Adapter interface with capabilities
 * 
 * Note: The Adapter itself does NOT have execute/select/insert/update/delete methods.
 * These methods are only available on DatabaseAdapter instances returned by getDatabaseByName().
 */
export interface Adapter {
  /**
   * Get adapter capabilities
   */
  getCapabilities(): AdapterCapabilities;
  
  /**
   * Get or create a database by name
   * Only available if supportsNamedDatabases is true
   * Returns a DatabaseAdapter instance that has execute/select/insert/update/delete methods
   */
  getDatabaseByName?(name: string): Promise<DatabaseAdapter>;
  
  /**
   * Get all table names in the database
   * Only available if supportsGetTableNames is true
   */
  getTableNames?(db: DatabaseAdapter): Promise<string[]>;
}

/**
 * Generic Database type
 * This is the type that will be used throughout the codebase
 */
export type Database = DatabaseAdapter;

