/**
 * Generic storage service for entities
 * Provides common CRUD operations that can be reused across all entity types
 * Supports custom cleanup, validation, and transformation hooks
 * Supports foreign key relationships and cascade deletes
 * Supports structured filter conditions
 */

import { getItem, setItem } from './drivers';
import { z } from 'zod';
import {
  FilterCondition,
  ConditionOperator,
  SingleCondition,
  Filter,
  findWhere,
  matchExists,
  countWhere,
} from './filters';
import { evaluateFilter } from './filters/evaluator';
import { generateUniqueUUID } from '../../utils/uuid';

// Re-export filter types for convenience
export type { FilterCondition, SingleCondition, Filter };
export { ConditionOperator };

/**
 * Foreign key relationship definition
 */
export interface ForeignKeyRelationship {
  /**
   * Field name in this entity that contains the foreign key
   */
  field: string;
  
  /**
   * The storage service key for the referenced entity type
   * This should match the storageKey of the referenced service
   */
  referencesStorageKey: string;
  
  /**
   * Whether to cascade delete (delete child entities when parent is deleted)
   * Defaults to false
   */
  cascadeDelete?: boolean;
  
  /**
   * Optional: Custom filter function to find child entities
   * If not provided, uses field equality check
   */
  findChildren?: (parentId: string, allChildren: any[]) => any[];
}

/**
 * Configuration for generated fields
 */
export interface GeneratedFieldContext<T> {
  entity: Partial<T>;
  existingEntities: T[];
  generateId: () => Promise<string>;
}

export type GeneratedFieldGenerator<T> = (
  context: GeneratedFieldContext<T>
) => any | Promise<any>;

export interface GeneratedFieldDefinition<T> {
  field: string;
  generator?: GeneratedFieldGenerator<T>;
}

/**
 * Configuration for generic storage operations
 */
export interface GenericStorageConfig<T> {
  storageKey: string;
  schema: z.ZodSchema<T>;
  entityName: string; // For error messages
  
  /**
   * Optional: Cleanup function before saving
   * Called prior to validation to normalize entities
   */
  cleanupBeforeSave?: (entity: Partial<T>) => Partial<T>;

  /**
   * Optional: Custom validation before saving
   * Can add additional validation beyond schema validation
   */
  customValidation?: (entity: T, allEntities: T[]) => void | Promise<void>;
  
  /**
   * Optional: Find existing entity by custom criteria
   * Defaults to finding by id
   */
  findExisting?: (entity: T, allEntities: T[]) => number;
  
  /**
   * Optional: Allow restore flag - if false, don't restore deleted entities
   * Used for entities like rounds that shouldn't be auto-restored
   */
  allowRestore?: boolean;
  
  /**
   * Optional: Check name uniqueness (only for entities with name property)
   * Defaults to true if entity has a name property
   */
  checkNameUniqueness?: boolean;

  /**
   * Optional: Fields that must be unique across all entities
   */
  uniqueFields?: (keyof T | string)[];

  /**
   * Optional: Field combinations that must be unique together
   */
  uniqueFieldCombos?: Array<(keyof T | string)[]>;

  /**
   * Optional: Fields that should be generated when missing
   */
  generatedFields?: GeneratedFieldDefinition<T>[];
  
  /**
   * Optional: Foreign key relationships
   * Defines which other entities reference this entity
   * Used for cascade deletes and referential integrity
   */
  foreignKeys?: ForeignKeyRelationship[];
}

/**
 * Storage service registry
 * Tracks all storage services to enable cascade deletes and foreign key lookups
 */
const storageServiceRegistry = new Map<string, GenericStorageService<any>>();

/**
 * Generic storage service
 * Provides common CRUD operations for any entity type with an id field
 */
export class GenericStorageService<T extends { id: string }> {
    constructor(private config: GenericStorageConfig<T>) {
        // Register this service in the global registry
        storageServiceRegistry.set(config.storageKey, this);
    }

  async select({filter, limit, offset}: {filter?: Filter; limit?: number; offset?: number} = {}): Promise<T[]> {
        const data = await getItem(this.config.storageKey);
        if (data) {
            const parsed = JSON.parse(data);
            return findWhere(parsed, {filter, limit, offset});
        }
        return [];
    }

    async exists(filter: Filter): Promise<boolean> {
        const data = await getItem(this.config.storageKey);
        if (data) {
            const parsed = JSON.parse(data);
            return matchExists(parsed, filter);
        }
        return false;
    }
    async count(filter: Filter): Promise<number> {
        const data = await getItem(this.config.storageKey);
        if (data) {
            const parsed = JSON.parse(data);
            return countWhere(parsed, filter);
        }
        return 0;
    }
  
  
  /**
   * Get all entities
   */
  async getAll(): Promise<T[]> {
    return this.select();
  }

  async getWhere(filter?: Filter, {limit, offset}: {limit?: number; offset?: number} = {}): Promise<T[]> {
    return this.select({ filter, limit, offset });
  }
  
  /**
   * Get the storage key for this service
   */
  getStorageKey(): string {
    return this.config.storageKey;
  }
  
  /**
   * Get one entity matching the filter conditions
   * Returns the first matching entity or null if none found
   * Takes the same arguments as getAll but returns a single entity
   */
  async getOne(filter?: Filter): Promise<T | null> {
    const entities = await this.getWhere(filter, { limit: 1 });
    return entities.length > 0 ? entities[0] : null;
  }

  /**
   * Get entity by ID
   */
  async getById(id: string): Promise<T | null> {
    return await this.getOne({id});
  }
  
  /**
   * Get entity by name
   * Only works for entities with a 'name' property
   */
  async getByName(name: string): Promise<T | null> {
    return await this.getOne({name});
  }
  
  /**
   * Save an entity
   * Validates, applies generated fields, checks uniqueness, and saves
   */
  async save(entity: Partial<T>, allowRestore?: boolean): Promise<void> {
    try {
      const entities = await this.getAll();
      const draft: any = { ...entity };

      const existingIds = new Set(entities.map(e => e.id));
      const generateIdFromEntities = async () => {
        const newId = await generateUniqueUUID(existingIds);
        existingIds.add(newId);
        return newId;
      };

      if (this.config.generatedFields) {
        for (const definition of this.config.generatedFields) {
          const fieldName = definition.field as string;
          const currentValue = draft[fieldName];
          if (currentValue === undefined || currentValue === null || currentValue === '') {
            let generatedValue: any;
            if (definition.generator) {
              generatedValue = await definition.generator({
                entity: draft,
                existingEntities: entities,
                generateId: generateIdFromEntities,
              });
            } else if (fieldName === 'id') {
              generatedValue = await generateIdFromEntities();
            }

            if (generatedValue === undefined) {
              throw new Error(
                `No generator provided for generated field "${fieldName}" on ${this.config.entityName}`
              );
            }

            draft[fieldName] = generatedValue;
          }
        }
      }

      if (draft.id === undefined || draft.id === null || draft.id === '') {
        draft.id = await generateIdFromEntities();
      } else {
        existingIds.add(draft.id);
      }

      const cleaned = this.config.cleanupBeforeSave
        ? this.config.cleanupBeforeSave(draft)
        : draft;

      const validation = this.config.schema.safeParse(cleaned);
      if (!validation.success) {
        const errorMessage = validation.error.errors
          .map(err => `${err.path.join('.')}: ${err.message}`)
          .join('; ');
        throw new Error(`Invalid ${this.config.entityName} data: ${errorMessage}`);
      }

      const entityToSave = validation.data;
      const findExisting =
        this.config.findExisting ||
        ((e: T, all: T[]) => all.findIndex(item => item.id === e.id));
      const existingIndex = findExisting(entityToSave, entities);
      const comparisonEntities =
        existingIndex >= 0
          ? entities.filter((_, idx) => idx !== existingIndex)
          : entities;

      if (this.config.uniqueFields) {
        for (const field of this.config.uniqueFields) {
          const fieldName = field as string;
          const value = (entityToSave as any)[fieldName];
          if (value === undefined || value === null) {
            continue;
          }
          const conflict = comparisonEntities.find(
            e => (e as any)[fieldName] === value
          );
          if (conflict) {
            throw new Error(
              `A ${this.config.entityName} with ${fieldName} "${value}" already exists`
            );
          }
        }
      }

      if (this.config.uniqueFieldCombos) {
        for (const combo of this.config.uniqueFieldCombos) {
          const values = combo.map(field => ({
            field: field as string,
            value: (entityToSave as any)[field as string],
          }));

          if (values.some(({ value }) => value === undefined || value === null)) {
            continue;
          }

          const conflict = comparisonEntities.find(other =>
            values.every(({ field, value }) => (other as any)[field] === value)
          );

          if (conflict) {
            const description = values
              .map(({ field, value }) => `${field} "${value}"`)
              .join(', ');
            throw new Error(
              `A ${this.config.entityName} with ${description} already exists`
            );
          }
        }
      }

      if (
        this.config.checkNameUniqueness !== false &&
        'name' in entityToSave &&
        typeof (entityToSave as any).name === 'string'
      ) {
        const trimmedName = (entityToSave as any).name.trim().toLowerCase();
        const conflict = comparisonEntities.find(
          (e: any) =>
            e.name && e.name.trim().toLowerCase() === trimmedName
        );
        if (conflict) {
          throw new Error(
            `A ${this.config.entityName} with the name "${trimmedName}" already exists`
          );
        }
      }

      if (this.config.customValidation) {
        await this.config.customValidation(entityToSave, entities);
      }

      const shouldRestore =
        allowRestore !== undefined
          ? allowRestore
          : this.config.allowRestore !== false;

      if (existingIndex >= 0) {
        entities[existingIndex] = entityToSave;
      } else if (shouldRestore) {
        entities.push(entityToSave);
      } else {
        console.warn(
          `Attempted to save ${this.config.entityName} "${entityToSave.id}" that doesn't exist. Skipping save.`
        );
        return;
      }

      await setItem(this.config.storageKey, JSON.stringify(entities));
    } catch (error: any) {
      console.error(`Error saving ${this.config.entityName}:`, error);

      if (
        error?.name === 'QuotaExceededError' ||
        error?.message?.includes('quota') ||
        error?.message?.includes('QuotaExceeded')
      ) {
        const quotaError = new Error(
          `Storage quota exceeded. Please delete some old ${this.config.entityName} data to free up space.`
        );
        (quotaError as any).name = 'QuotaExceededError';
        throw quotaError;
      }

      throw error;
    }
  }
  
  /**
   * Save multiple entities at once
   */
  async saveMany(entitiesToSave: Array<Partial<T>>, allowRestore?: boolean): Promise<void> {
    for (const entity of entitiesToSave) {
      await this.save(entity, allowRestore);
    }
  }
  
  /**
   * Delete entity by ID
   * Handles cascade deletes for foreign key relationships
   */
  async delete(id: string, cascade: boolean = true): Promise<void> {
    try {
      // Handle cascade deletes if enabled
      if (cascade && this.config.foreignKeys) {
        for (const fk of this.config.foreignKeys) {
          if (fk.cascadeDelete) {
            const childService = storageServiceRegistry.get(fk.referencesStorageKey);
            if (childService) {
              // Find all child entities that reference this parent
              const findChildren = fk.findChildren || ((parentId: string, allChildren: any[]) => {
                return allChildren.filter((child: any) => (child as any)[fk.field] === parentId);
              });
              
              const allChildren = await childService.getAll();
              const childrenToDelete = findChildren(id, allChildren);
              
              if (childrenToDelete.length > 0) {
                // Delete all child entities
                const childIds = childrenToDelete.map((child: any) => child.id);
                await childService.deleteMany(childIds, cascade);
              }
            } else {
              console.warn(`Foreign key references storage key "${fk.referencesStorageKey}" but service not found in registry`);
            }
          }
        }
      }
      
      // Delete this entity
      const entities = await this.getAll();
      const filtered = entities.filter((e) => e.id !== id);
      await setItem(this.config.storageKey, JSON.stringify(filtered));
    } catch (error) {
      console.error(`Error deleting ${this.config.entityName}:`, error);
      throw error;
    }
  }
  
  /**
   * Delete multiple entities by IDs
   * Handles cascade deletes for foreign key relationships
   */
  async deleteMany(ids: string[], cascade: boolean = true): Promise<void> {
    try {
      // Handle cascade deletes if enabled
      if (cascade && this.config.foreignKeys) {
        for (const fk of this.config.foreignKeys) {
          if (fk.cascadeDelete) {
            const childService = storageServiceRegistry.get(fk.referencesStorageKey);
            if (childService) {
              // Find all child entities that reference any of the parents being deleted
              const findChildren = fk.findChildren || ((parentId: string, allChildren: any[]) => {
                return allChildren.filter((child: any) => (child as any)[fk.field] === parentId);
              });
              
              const allChildren = await childService.getAll();
              const childrenToDelete: any[] = [];
              
              for (const parentId of ids) {
                const children = findChildren(parentId, allChildren);
                childrenToDelete.push(...children);
              }
              
              if (childrenToDelete.length > 0) {
                // Delete all child entities
                const childIds = childrenToDelete.map((child: any) => child.id);
                await childService.deleteMany(childIds, cascade);
              }
            } else {
              console.warn(`Foreign key references storage key "${fk.referencesStorageKey}" but service not found in registry`);
            }
          }
        }
      }
      
      // Delete these entities
      const entities = await this.getAll();
      const filtered = entities.filter((e) => !ids.includes(e.id));
      await setItem(this.config.storageKey, JSON.stringify(filtered));
    } catch (error) {
      console.error(`Error deleting ${this.config.entityName}s:`, error);
      throw error;
    }
  }
  
  /**
   * Find entities by foreign key
   * Useful for finding all children of a parent entity
   */
  async findByForeignKey(field: string, foreignId: string): Promise<T[]> {
    const entities = await this.getAll();
    return entities.filter(entity => (entity as any)[field] === foreignId);
  }
  
  /**
   * Generate a new unique entity ID
   */
  async generateId(): Promise<string> {
    const entities = await this.getAll();
    const existingIds = new Set(entities.map(e => e.id));
    return generateUniqueUUID(existingIds);
  }
  
  /**
   * Check if a name is available (for entities with name property)
   */
  async isNameAvailable(name: string, excludeId?: string): Promise<boolean> {
    try {
      const entities = await this.getAll();
      const trimmedName = name.trim().toLowerCase();
      return !entities.some((e: any) => 
        e.name && 
        e.name.trim().toLowerCase() === trimmedName && 
        e.id !== excludeId
      );
    } catch (error) {
      console.error(`Error checking ${this.config.entityName} name availability:`, error);
      return false;
    }
  }
  
  /**
   * Filter entities by a predicate (legacy method for backward compatibility)
   */
  async filter(predicate: (entity: T) => boolean): Promise<T[]> {
    try {
      const entities = await this.getAll();
      return entities.filter(predicate);
    } catch (error) {
      console.error(`Error filtering ${this.config.entityName}:`, error);
      return [];
    }
  }
  
  /**
   * Find entity by predicate (legacy method for backward compatibility)
   */
  async find(predicate: (entity: T) => boolean): Promise<T | null> {
    try {
      const entities = await this.getAll();
      return entities.find(predicate) || null;
    } catch (error) {
      console.error(`Error finding ${this.config.entityName}:`, error);
      return null;
    }
  }
  
  /**
   * Find entities by filter conditions
   * @deprecated Use getAll() directly with filters
   */
  async findByFilters(filters: FilterCondition | FilterCondition[]): Promise<T[]> {
    const entities = await this.getAll();
    return entities.filter(entity => evaluateFilter(entity, filters));
  }
  
  /**
   * Find first entity matching filter conditions
   */
  async findOneByFilters(filters: FilterCondition | FilterCondition[]): Promise<T | null> {
    const entities = await this.findByFilters(filters);
    return entities.length > 0 ? entities[0] : null;
  }
}

