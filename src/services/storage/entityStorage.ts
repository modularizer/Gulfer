/**
 * Shared storage driver for entities with base entity fields
 * Provides common CRUD operations for entities that have id, name, notes, and location
 * 
 * This module provides convenience functions that use the default storage driver.
 * For custom drivers, use the StorageDriver class directly.
 */

import { defaultStorageDriver, EntityStorageConfig } from './drivers';
import { BaseEntity } from '@/types';

/**
 * Re-export EntityStorageConfig for convenience
 */
export type { EntityStorageConfig };

/**
 * Get all entities of a given type
 */
export async function getAllEntities<T extends BaseEntity>(
  config: EntityStorageConfig<T>
): Promise<T[]> {
  return defaultStorageDriver.getAllEntities(config);
}

/**
 * Get an entity by ID
 */
export async function getEntityById<T extends BaseEntity>(
  config: EntityStorageConfig<T>,
  entityId: string
): Promise<T | null> {
  return defaultStorageDriver.getEntityById(config, entityId);
}

/**
 * Save an entity
 * Validates the entity against schema before saving
 * Enforces local uniqueness of names (case-insensitive)
 */
export async function saveEntity<T extends BaseEntity>(
  config: EntityStorageConfig<T>,
  entity: T
): Promise<void> {
  return defaultStorageDriver.saveEntity(config, entity);
}

/**
 * Save multiple entities at once
 */
export async function saveEntities<T extends BaseEntity>(
  config: EntityStorageConfig<T>,
  entitiesToSave: T[]
): Promise<void> {
  return defaultStorageDriver.saveEntities(config, entitiesToSave);
}

/**
 * Delete an entity by ID
 */
export async function deleteEntity<T extends BaseEntity>(
  config: EntityStorageConfig<T>,
  entityId: string
): Promise<void> {
  return defaultStorageDriver.deleteEntity(config, entityId);
}

/**
 * Delete multiple entities by IDs
 */
export async function deleteEntities<T extends BaseEntity>(
  config: EntityStorageConfig<T>,
  entityIds: string[]
): Promise<void> {
  return defaultStorageDriver.deleteEntities(config, entityIds);
}

/**
 * Generate a new unique entity ID
 */
export async function generateEntityId<T extends BaseEntity>(
  config: EntityStorageConfig<T>
): Promise<string> {
  return defaultStorageDriver.generateEntityId(config);
}

/**
 * Get entities by name (case-insensitive)
 */
export async function getEntitiesByName<T extends BaseEntity>(
  config: EntityStorageConfig<T>,
  name: string
): Promise<T[]> {
  return defaultStorageDriver.getEntitiesByName(config, name);
}

/**
 * Get an entity by name (case-insensitive) - returns first match or null
 */
export async function getEntityByName<T extends BaseEntity>(
  config: EntityStorageConfig<T>,
  name: string
): Promise<T | null> {
  return defaultStorageDriver.getEntityByName(config, name);
}

