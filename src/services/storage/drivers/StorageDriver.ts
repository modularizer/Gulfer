/**
 * Abstract base class for storage drivers
 * Defines the interface that all storage implementations must follow
 * Separates generic storage logic from implementation-specific details
 */

import { z } from 'zod';
import { BaseEntity, validateArray } from '@/types';
import { generateUniqueUUID } from '../../utils/uuid';

/**
 * Configuration for entity storage operations
 */
export interface EntityStorageConfig<T extends BaseEntity> {
  storageKey: string;
  schema: z.ZodSchema<T>;
  entityName: string; // For error messages
}

/**
 * Abstract storage driver base class
 * Provides generic CRUD operations while delegating low-level storage to implementations
 */
export abstract class StorageDriver {
  /**
   * Abstract methods that must be implemented by concrete drivers
   */
  
  /**
   * Get a value from storage by key
   * @param key Storage key
   * @returns The stored value or null if not found
   */
  protected abstract getRaw(key: string): Promise<string | null>;
  
  /**
   * Set a value in storage by key
   * @param key Storage key
   * @param value Value to store (as string)
   */
  protected abstract setRaw(key: string, value: string): Promise<void>;
  
  /**
   * Remove a value from storage by key
   * @param key Storage key
   */
  protected abstract removeRaw(key: string): Promise<void>;
  
  /**
   * Get all keys from storage
   * @returns Array of all storage keys
   */
  protected abstract getAllKeys(): Promise<string[]>;
  
  /**
   * Clear all storage
   */
  protected abstract clearAll(): Promise<void>;
  
  /**
   * Generic operations (implemented in base class using abstract methods above)
   */
  
  /**
   * Get all entities of a given type
   */
  async getAllEntities<T extends BaseEntity>(
    config: EntityStorageConfig<T>
  ): Promise<T[]> {
    try {
      const data = await this.getRaw(config.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        const result = validateArray(config.schema, parsed, config.entityName);
        if (result.success) {
          return result.data;
        } else {
          console.error(`Error validating ${config.entityName}:`, result.error);
          return [];
        }
      }
      return [];
    } catch (error) {
      console.error(`Error loading ${config.entityName}:`, error);
      return [];
    }
  }
  
  /**
   * Get an entity by ID
   */
  async getEntityById<T extends BaseEntity>(
    config: EntityStorageConfig<T>,
    entityId: string
  ): Promise<T | null> {
    try {
      const entities = await this.getAllEntities(config);
      return entities.find((e) => e.id === entityId) || null;
    } catch (error) {
      console.error(`Error loading ${config.entityName} by ID:`, error);
      return null;
    }
  }
  
  /**
   * Save an entity
   * Validates the entity against schema before saving
   * Enforces local uniqueness of names (case-insensitive)
   */
  async saveEntity<T extends BaseEntity>(
    config: EntityStorageConfig<T>,
    entity: T
  ): Promise<void> {
    try {
      // Validate the entity before saving
      const validation = config.schema.safeParse(entity);
      if (!validation.success) {
        const errorMessage = validation.error.errors
          .map(err => `${err.path.join('.')}: ${err.message}`)
          .join('; ');
        throw new Error(`Invalid ${config.entityName} data: ${errorMessage}`);
      }
      
      const entities = await this.getAllEntities(config);
      const existingIndex = entities.findIndex((e) => e.id === validation.data.id);
      
      // Check for name uniqueness (case-insensitive, excluding current entity)
      const trimmedName = validation.data.name.trim();
      const nameConflict = entities.find(e => 
        e.id !== validation.data.id && 
        e.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      
      if (nameConflict) {
        throw new Error(`A ${config.entityName} with the name "${trimmedName}" already exists`);
      }
      
      if (existingIndex >= 0) {
        // Entity exists, update it
        entities[existingIndex] = validation.data;
      } else {
        // New entity, add it
        entities.push(validation.data);
      }
      
      await this.setRaw(config.storageKey, JSON.stringify(entities));
    } catch (error: any) {
      console.error(`Error saving ${config.entityName}:`, error);
      
      // Check if it's a quota exceeded error
      if (error?.name === 'QuotaExceededError' || error?.message?.includes('quota') || error?.message?.includes('QuotaExceeded')) {
        const quotaError = new Error(`Storage quota exceeded. Please delete some old ${config.entityName} data to free up space.`);
        (quotaError as any).name = 'QuotaExceededError';
        throw quotaError;
      }
      
      throw error;
    }
  }
  
  /**
   * Save multiple entities at once
   */
  async saveEntities<T extends BaseEntity>(
    config: EntityStorageConfig<T>,
    entitiesToSave: T[]
  ): Promise<void> {
    try {
      const allEntities = await this.getAllEntities(config);
      const existingIds = new Set(allEntities.map(e => e.id));
      
      for (const entity of entitiesToSave) {
        // Validate each entity
        const validation = config.schema.safeParse(entity);
        if (!validation.success) {
          const errorMessage = validation.error.errors
            .map(err => `${err.path.join('.')}: ${err.message}`)
            .join('; ');
          throw new Error(`Invalid ${config.entityName} data: ${errorMessage}`);
        }
        
        const existingIndex = allEntities.findIndex((e) => e.id === validation.data.id);
        if (existingIndex >= 0) {
          allEntities[existingIndex] = validation.data;
        } else {
          allEntities.push(validation.data);
        }
      }
      
      await this.setRaw(config.storageKey, JSON.stringify(allEntities));
    } catch (error: any) {
      console.error(`Error saving ${config.entityName}s:`, error);
      
      // Check if it's a quota exceeded error
      if (error?.name === 'QuotaExceededError' || error?.message?.includes('quota') || error?.message?.includes('QuotaExceeded')) {
        const quotaError = new Error(`Storage quota exceeded. Please delete some old ${config.entityName} data to free up space.`);
        (quotaError as any).name = 'QuotaExceededError';
        throw quotaError;
      }
      
      throw error;
    }
  }
  
  /**
   * Delete an entity by ID
   */
  async deleteEntity<T extends BaseEntity>(
    config: EntityStorageConfig<T>,
    entityId: string
  ): Promise<void> {
    try {
      const entities = await this.getAllEntities(config);
      const filtered = entities.filter((e) => e.id !== entityId);
      await this.setRaw(config.storageKey, JSON.stringify(filtered));
    } catch (error) {
      console.error(`Error deleting ${config.entityName}:`, error);
      throw error;
    }
  }
  
  /**
   * Delete multiple entities by IDs
   */
  async deleteEntities<T extends BaseEntity>(
    config: EntityStorageConfig<T>,
    entityIds: string[]
  ): Promise<void> {
    try {
      const entities = await this.getAllEntities(config);
      const filtered = entities.filter((e) => !entityIds.includes(e.id));
      await this.setRaw(config.storageKey, JSON.stringify(filtered));
    } catch (error) {
      console.error(`Error deleting ${config.entityName}s:`, error);
      throw error;
    }
  }
  
  /**
   * Generate a new unique entity ID
   */
  async generateEntityId<T extends BaseEntity>(
    config: EntityStorageConfig<T>
  ): Promise<string> {
    const entities = await this.getAllEntities(config);
    const existingIds = new Set(entities.map(e => e.id));
    return generateUniqueUUID(existingIds);
  }
  
  /**
   * Get entities by name (case-insensitive)
   */
  async getEntitiesByName<T extends BaseEntity>(
    config: EntityStorageConfig<T>,
    name: string
  ): Promise<T[]> {
    try {
      const entities = await this.getAllEntities(config);
      const trimmedName = name.trim().toLowerCase();
      return entities.filter((e) => e.name.trim().toLowerCase() === trimmedName);
    } catch (error) {
      console.error(`Error loading ${config.entityName} by name:`, error);
      return [];
    }
  }
  
  /**
   * Get an entity by name (case-insensitive) - returns first match or null
   */
  async getEntityByName<T extends BaseEntity>(
    config: EntityStorageConfig<T>,
    name: string
  ): Promise<T | null> {
    try {
      const entities = await this.getEntitiesByName(config, name);
      return entities[0] || null;
    } catch (error) {
      console.error(`Error loading ${config.entityName} by name:`, error);
      return null;
    }
  }
  
  /**
   * Generic operations for non-entity data (scores, photos, etc.)
   * These can be overridden by drivers for optimization
   */
  
  /**
   * Get raw data by key (for non-entity storage)
   */
  async getItem(key: string): Promise<string | null> {
    return this.getRaw(key);
  }
  
  /**
   * Set raw data by key (for non-entity storage)
   */
  async setItem(key: string, value: string): Promise<void> {
    return this.setRaw(key, value);
  }
  
  /**
   * Remove raw data by key (for non-entity storage)
   */
  async removeItem(key: string): Promise<void> {
    return this.removeRaw(key);
  }
  
  /**
   * Get all storage keys
   */
  async getAllStorageKeys(): Promise<string[]> {
    return this.getAllKeys();
  }
  
  /**
   * Clear all storage
   */
  async clear(): Promise<void> {
    return this.clearAll();
  }
}

