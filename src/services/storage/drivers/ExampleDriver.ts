/**
 * Example storage driver implementation
 * This demonstrates how to create a new storage driver
 * 
 * This is a template/example - not used in production
 * To create a new driver, copy this file and implement the abstract methods
 */

import { StorageDriver, EntityStorageConfig } from './StorageDriver';
import { BaseEntity } from '@/types';

/**
 * Example: SQLite-based storage driver
 * This shows how you might implement a driver for SQLite
 * 
 * Note: This is just an example - actual implementation would depend on
 * the SQLite library you're using (e.g., react-native-sqlite-storage, expo-sqlite, etc.)
 */
export class ExampleSQLiteDriver extends StorageDriver {
  // In a real implementation, you'd initialize your database connection here
  // private db: SQLiteDatabase;
  
  /**
   * Get a value from storage by key
   * Example: Query SQLite database
   */
  protected async getRaw(key: string): Promise<string | null> {
    // Example implementation:
    // const result = await this.db.query('SELECT value FROM storage WHERE key = ?', [key]);
    // return result.rows[0]?.value || null;
    
    // For now, throw an error to indicate this is just an example
    throw new Error('ExampleSQLiteDriver is not implemented - this is just a template');
  }
  
  /**
   * Set a value in storage by key
   * Example: Insert/Update in SQLite database
   */
  protected async setRaw(key: string, value: string): Promise<void> {
    // Example implementation:
    // await this.db.query(
    //   'INSERT OR REPLACE INTO storage (key, value) VALUES (?, ?)',
    //   [key, value]
    // );
    
    throw new Error('ExampleSQLiteDriver is not implemented - this is just a template');
  }
  
  /**
   * Remove a value from storage by key
   * Example: Delete from SQLite database
   */
  protected async removeRaw(key: string): Promise<void> {
    // Example implementation:
    // await this.db.query('DELETE FROM storage WHERE key = ?', [key]);
    
    throw new Error('ExampleSQLiteDriver is not implemented - this is just a template');
  }
  
  /**
   * Get all keys from storage
   * Example: Query all keys from SQLite database
   */
  protected async getAllKeys(): Promise<string[]> {
    // Example implementation:
    // const result = await this.db.query('SELECT key FROM storage');
    // return result.rows.map(row => row.key);
    
    throw new Error('ExampleSQLiteDriver is not implemented - this is just a template');
  }
  
  /**
   * Clear all storage
   * Example: Delete all rows from SQLite database
   */
  protected async clearAll(): Promise<void> {
    // Example implementation:
    // await this.db.query('DELETE FROM storage');
    
    throw new Error('ExampleSQLiteDriver is not implemented - this is just a template');
  }
  
  /**
   * Optional: Override saveEntities for transaction support
   * This shows how you can optimize operations for your specific storage backend
   */
  async saveEntities<T extends BaseEntity>(
    config: EntityStorageConfig<T>,
    entitiesToSave: T[]
  ): Promise<void> {
    // Example: Use a transaction for better performance
    // await this.db.transaction(async (tx) => {
    //   for (const entity of entitiesToSave) {
    //     // Validate and save in transaction
    //   }
    // });
    
    // For now, fall back to base implementation
    return super.saveEntities(config, entitiesToSave);
  }
}

/**
 * Example: REST API-based storage driver
 * This shows how you might implement a driver for a remote API
 */
export class ExampleRestApiDriver extends StorageDriver {
  private baseUrl: string;
  
  constructor(baseUrl: string) {
    super();
    this.baseUrl = baseUrl;
  }
  
  protected async getRaw(key: string): Promise<string | null> {
    // Example: Fetch from REST API
    // const response = await fetch(`${this.baseUrl}/storage/${key}`);
    // if (!response.ok) return null;
    // return await response.text();
    
    throw new Error('ExampleRestApiDriver is not implemented - this is just a template');
  }
  
  protected async setRaw(key: string, value: string): Promise<void> {
    // Example: POST/PUT to REST API
    // await fetch(`${this.baseUrl}/storage/${key}`, {
    //   method: 'PUT',
    //   body: value,
    //   headers: { 'Content-Type': 'application/json' }
    // });
    
    throw new Error('ExampleRestApiDriver is not implemented - this is just a template');
  }
  
  protected async removeRaw(key: string): Promise<void> {
    // Example: DELETE from REST API
    // await fetch(`${this.baseUrl}/storage/${key}`, { method: 'DELETE' });
    
    throw new Error('ExampleRestApiDriver is not implemented - this is just a template');
  }
  
  protected async getAllKeys(): Promise<string[]> {
    // Example: GET list from REST API
    // const response = await fetch(`${this.baseUrl}/storage/keys`);
    // const data = await response.json();
    // return data.keys;
    
    throw new Error('ExampleRestApiDriver is not implemented - this is just a template');
  }
  
  protected async clearAll(): Promise<void> {
    // Example: DELETE all from REST API
    // await fetch(`${this.baseUrl}/storage`, { method: 'DELETE' });
    
    throw new Error('ExampleRestApiDriver is not implemented - this is just a template');
  }
}

