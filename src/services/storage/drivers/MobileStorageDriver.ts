/**
 * Mobile storage driver implementation
 * Uses AsyncStorage for React Native platforms
 * Implements IStorageDriver for localStorage-based storage on mobile
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { IStorageDriver, SelectOptions } from './IStorageDriver';
import { Filter } from '../filters';
import { findWhere, matchExists, countWhere, evaluateCondition } from '../filters/evaluator';
import { generateUniqueUUID } from '@/utils/uuid';

/**
 * Mobile storage driver
 * Implements IStorageDriver using AsyncStorage
 * This implementation fetches all entities then filters in memory
 * For SQL/NoSQL drivers, filtering would be pushed to the database
 */
export class MobileStorageDriver implements IStorageDriver {
  private readonly STORAGE_PREFIX = '@gulfer_';

  /**
   * Convert tableName to storageKey
   * Adds the @gulfer_ prefix if not already present
   */
  private tableNameToStorageKey(tableName: string): string {
    if (tableName.startsWith('@gulfer_')) {
      return tableName;
    }
    return `${this.STORAGE_PREFIX}${tableName}`;
  }

  /**
   * Get a value from storage by key
   */
  private async getRaw(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error(`Error getting item ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in storage by key
   */
  private async setRaw(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error: any) {
      console.error(`Error setting item ${key}:`, error);
      
      // Check if it's a quota exceeded error
      if (
        error?.name === 'QuotaExceededError' ||
        error?.message?.includes('quota') ||
        error?.message?.includes('QuotaExceeded')
      ) {
        const quotaError = new Error(`Storage quota exceeded`);
        (quotaError as any).name = 'QuotaExceededError';
        throw quotaError;
      }
      
      throw error;
    }
  }

  /**
   * Select entities matching the filter conditions
   * For localStorage, we fetch all then filter in memory
   */
  async select<T extends { id: string }>(
    tableName: string,
    options?: SelectOptions
  ): Promise<T[]> {
    try {
      const storageKey = this.tableNameToStorageKey(tableName);
      const data = await this.getRaw(storageKey);
      if (!data) {
        return [];
      }
      
      const parsed = JSON.parse(data) as T[];
      return findWhere(parsed, options || {});
    } catch (error) {
      console.error(`Error selecting from ${tableName}:`, error);
      return [];
    }
  }

  /**
   * Insert a new entity
   * If entity.id is missing or empty, it will be generated automatically
   * Returns the entity with the generated ID
   */
  async insert<T extends { id?: string }>(
    tableName: string,
    entity: T
  ): Promise<T & { id: string }> {
    try {
      const storageKey = this.tableNameToStorageKey(tableName);
      const entities = await this.select<{ id: string }>(tableName);
      
      // Generate ID if missing or empty
      let entityWithId: T & { id: string };
      if (!entity.id || entity.id.trim() === '') {
        const generatedId = await generateUniqueUUID();
        entityWithId = { ...entity, id: generatedId } as T & { id: string };
      } else {
        entityWithId = entity as T & { id: string };
      }
      
      entities.push(entityWithId);
      await this.setRaw(storageKey, JSON.stringify(entities));
      
      return entityWithId;
    } catch (error: any) {
      console.error(`Error inserting into ${tableName}:`, error);
      
      // Check if it's a quota exceeded error
      if (
        error?.name === 'QuotaExceededError' ||
        error?.message?.includes('quota') ||
        error?.message?.includes('QuotaExceeded')
      ) {
        const quotaError = new Error(`Storage quota exceeded`);
        (quotaError as any).name = 'QuotaExceededError';
        throw quotaError;
      }
      
      throw error;
    }
  }

  /**
   * Upsert an entity (insert if new, update if exists)
   */
  async upsert<T extends { id: string }>(
    tableName: string,
    entity: T
  ): Promise<void> {
    try {
      const storageKey = this.tableNameToStorageKey(tableName);
      const entities = await this.select<T>(tableName);
      const existingIndex = entities.findIndex(e => e.id === entity.id);
      
      if (existingIndex >= 0) {
        entities[existingIndex] = entity;
      } else {
        entities.push(entity);
      }
      
      await this.setRaw(storageKey, JSON.stringify(entities));
    } catch (error: any) {
      console.error(`Error upserting into ${tableName}:`, error);
      
      // Check if it's a quota exceeded error
      if (
        error?.name === 'QuotaExceededError' ||
        error?.message?.includes('quota') ||
        error?.message?.includes('QuotaExceeded')
      ) {
        const quotaError = new Error(`Storage quota exceeded`);
        (quotaError as any).name = 'QuotaExceededError';
        throw quotaError;
      }
      
      throw error;
    }
  }

  /**
   * Delete entities matching the filter
   * Returns the number of entities deleted
   */
  async delete(
    tableName: string,
    filter: Filter
  ): Promise<number> {
    try {
      const storageKey = this.tableNameToStorageKey(tableName);
      const entities = await this.select<{ id: string }>(tableName);
      const initialCount = entities.length;
      
      // Filter out entities that match the filter
      const filtered = entities.filter(entity => {
        // Keep entities that DON'T match the filter
        return !evaluateCondition(entity, filter);
      });
      
      const deletedCount = initialCount - filtered.length;
      await this.setRaw(storageKey, JSON.stringify(filtered));
      
      return deletedCount;
    } catch (error) {
      console.error(`Error deleting from ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Delete entity by ID
   * Returns true if entity was found and deleted, false otherwise
   */
  async deleteById(
    tableName: string,
    id: string
  ): Promise<boolean> {
    try {
      const storageKey = this.tableNameToStorageKey(tableName);
      const entities = await this.select<{ id: string }>(tableName);
      const initialLength = entities.length;
      const filtered = entities.filter(e => e.id !== id);
      
      if (filtered.length < initialLength) {
        await this.setRaw(storageKey, JSON.stringify(filtered));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Error deleting ${id} from ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Check if any entities match the filter
   */
  async exists(
    tableName: string,
    filter: Filter
  ): Promise<boolean> {
    try {
      const storageKey = this.tableNameToStorageKey(tableName);
      const data = await this.getRaw(storageKey);
      if (!data) {
        return false;
      }
      
      const parsed = JSON.parse(data);
      return matchExists(parsed, filter);
    } catch (error) {
      console.error(`Error checking existence in ${tableName}:`, error);
      return false;
    }
  }

  /**
   * Count entities matching the filter
   */
  async count(
    tableName: string,
    filter?: Filter
  ): Promise<number> {
    try {
      const storageKey = this.tableNameToStorageKey(tableName);
      const data = await this.getRaw(storageKey);
      if (!data) {
        return 0;
      }
      
      const parsed = JSON.parse(data);
      return countWhere(parsed, filter);
    } catch (error) {
      console.error(`Error counting in ${tableName}:`, error);
      return 0;
    }
  }

}

