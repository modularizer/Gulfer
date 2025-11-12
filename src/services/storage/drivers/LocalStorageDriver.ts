/**
 * Local storage driver factory
 * Automatically selects the appropriate driver based on platform
 * Uses WebStorageDriver on web and MobileStorageDriver on React Native
 */

import { Platform } from 'react-native';
import { IStorageDriver } from './IStorageDriver';
import { WebStorageDriver } from './WebStorageDriver';
import { MobileStorageDriver } from './MobileStorageDriver';

/**
 * Local storage driver
 * Factory class that wraps the appropriate platform-specific driver
 * Implements IStorageDriver by delegating to WebStorageDriver or MobileStorageDriver
 */
export class LocalStorageDriver implements IStorageDriver {
  private driver: IStorageDriver;

  constructor() {
    // Select the appropriate driver based on platform
    if (Platform.OS === 'web') {
      this.driver = new WebStorageDriver();
    } else {
      this.driver = new MobileStorageDriver();
    }
  }

  async select<T extends { id: string }>(
    tableName: string,
    options?: import('./IStorageDriver').SelectOptions
  ): Promise<T[]> {
    return this.driver.select<T>(tableName, options);
  }

  async insert<T extends { id?: string }>(
    tableName: string,
    entity: T
  ): Promise<T & { id: string }> {
    return this.driver.insert<T>(tableName, entity);
  }

  async upsert<T extends { id: string }>(
    tableName: string,
    entity: T
  ): Promise<void> {
    return this.driver.upsert<T>(tableName, entity);
  }

  async delete(
    tableName: string,
    filter: import('../filters').Filter
  ): Promise<number> {
    return this.driver.delete(tableName, filter);
  }

  async deleteById(
    tableName: string,
    id: string
  ): Promise<boolean> {
    return this.driver.deleteById(tableName, id);
  }

  async exists(
    tableName: string,
    filter: import('../filters').Filter
  ): Promise<boolean> {
    return this.driver.exists(tableName, filter);
  }

  async count(
    tableName: string,
    filter?: import('../filters').Filter
  ): Promise<number> {
    return this.driver.count(tableName, filter);
  }
}

/**
 * Default storage driver instance
 * This is the driver used throughout the application
 * Automatically selects the appropriate platform-specific driver
 * Can be swapped out for other drivers (e.g., SQLite, Postgres, etc.)
 */
export const defaultStorageDriver = new LocalStorageDriver();
