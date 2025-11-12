/**
 * Generic storage service for entities
 * Provides common CRUD operations that can be reused across all entity types
 * Supports custom cleanup, validation, and transformation hooks
 * Supports foreign key relationships and cascade deletes
 * Supports structured filter conditions
 * 
 * This service is driver-agnostic and works with any IStorageDriver implementation
 */
import {
  FilterCondition,
  ConditionOperator,
  SingleCondition,
  Filter,
} from '../filters';
import { and, eq, ne } from '../filters/builders';
import {IStorageDriver, LimitOffset} from '../drivers/IStorageDriver';
import { defaultStorageDriver } from '@services/storage/drivers/LocalStorageDriver';
import {TableConfig} from "@services/storage/relations/tableConfig";
import {ComputedFieldDefinition} from "@services/storage/relations/computedFields";

// Re-export filter types for convenience
export type { FilterCondition, SingleCondition, Filter };
export { ConditionOperator };



/**
 * Storage service registry
 * Tracks all storage services to enable cascade deletes and foreign key lookups
 */
const storageServiceRegistry = new Map<string, TableDriver<any>>();

/**
 * Generic storage service
 * Provides common CRUD operations for any entity type with an id field
 * This service is driver-agnostic and works with any IStorageDriver implementation
 */
export class TableDriver<T extends { id: string }> {
    private driver: IStorageDriver;

    constructor(private config: TableConfig<T>) {
    // Use provided driver or default to LocalStorageDriver
    this.driver = config.driver || defaultStorageDriver as IStorageDriver;

    // Register this service in the global registry
    storageServiceRegistry.set(config.tableName, this);
    }

    get tableName(): string {
        return this.config.tableName;
    }

    getTableName(): string {
        return this.config.tableName;
    }

    /**
     * Apply computed fields to a single entity
     */
    private async _applyComputedFields(entity: T): Promise<T> {
        if (!this.config.computedFields || this.config.computedFields.length === 0) {
            return entity;
        }

        const entityWithComputed = { ...entity } as any;
        
        for (const definition of this.config.computedFields) {
            const fieldName = definition.field;
            entityWithComputed[fieldName] = await definition.generator(entity);
        }

        return entityWithComputed as T;
    }

    /**
     * Apply computed fields to multiple entities
     */
    private async _applyComputedFieldsToMany(entities: T[]): Promise<T[]> {
        if (!this.config.computedFields || this.config.computedFields.length === 0) {
            return entities;
        }

        return Promise.all(entities.map(entity => this._applyComputedFields(entity)));
    }

    async getAll(): Promise<T[]> {
        const entities = await this.driver.select<T>(this.config.tableName);
        return this._applyComputedFieldsToMany(entities);
    }

    async getAllWhere(filter?: Filter, {limit, offset}: LimitOffset = {}): Promise<T[]> {
        const entities = await this.driver.select<T>(this.config.tableName, { filter, limit, offset });
        return this._applyComputedFieldsToMany(entities);
    }

    async getOneWhere(filter?: Filter): Promise<T | null> {
        const entities = await this.getAllWhere(filter, { limit: 1 });
        return entities.length > 0 ? entities[0] : null;
    }

    async getById(id: string): Promise<T | null> {
        return await this.getOneWhere({id});
    }

    async getByName(name: string): Promise<T | null> {
        return await this.getOneWhere({name});
    }


    async existsWhere(filter: Filter): Promise<boolean> {
        return this.driver.exists(this.config.tableName, filter);
    }

    async countAll(): Promise<number> {
        return this.driver.count(this.config.tableName);
    }

    async countWhere(filter: Filter): Promise<number> {
        return this.driver.count(this.config.tableName, filter);
    }


    async upsert(entity: Partial<T>): Promise<void> {
        const entityToSave = await this._prepare(entity, true);
        await this.driver.upsert(this.config.tableName, entityToSave);
    }

    async insert(entity: Partial<T>): Promise<void> {
        const entityToSave = await this._prepare(entity, false);
        await this.driver.insert(this.config.tableName, entityToSave);
    }

    async upsertMany(entitiesToSave: Array<Partial<T>>): Promise<void> {
        for (const entity of entitiesToSave) {
          await this.upsert(entity);
        }
    }

    async deleteById(id: string, cascade: boolean = true): Promise<boolean> {
        return (await this.delete({id}, cascade)).length > 0;
    }

    async delete(filter: Filter, cascade: boolean = true): Promise<string[]> {
        // identify records to delete
        const recordIds = (await this.getAllWhere(filter)).map(r => r.id);
        if (!recordIds.length) return [];

        // Handle cascade deletes if enabled
        if (cascade && this.config.foreignKeys) {
            for (const fk of this.config.foreignKeys) {
              if (fk.cascadeDelete) {
                  for (let id of recordIds) {
                      const childService = storageServiceRegistry.get(fk.referencesTableName);
                      if (childService) {
                          await childService.delete({[fk.referencesField]: id}, cascade);
                      } else {
                          throw new Error(`Foreign key references storage key "${fk.referencesTableName}" but service not found in registry`);
                      }
                  }
              }
            }
        }
        for (let id of recordIds) {
            await this.driver.deleteById(this.config.tableName, id);
        }
        return recordIds;
    }
  

    async deleteManyById(ids: string[], cascade: boolean = true): Promise<void> {
      for (const id of ids) {
        await this.deleteById(id, cascade);
      }
    }
  

    async isNameAvailable(name: string): Promise<boolean> {
      return !(await this.existsWhere({name}));
    }



    private async _prepare(entity: Partial<T>, existsOk?: boolean): Promise<T> {
        let draft: any = { ...entity };

        // Generate fields if needed
        if (this.config.generatedFields) {
            for (const definition of this.config.generatedFields) {
                const fieldName = definition.field as string;

                const currentValue = draft[fieldName];
                if (currentValue === undefined || currentValue === null || currentValue === '') {
                    if (!definition.generator) {
                        throw new Error(
                            `No generator provided for generated field "${fieldName}" on ${this.config.tableName}`
                        );
                    }
                    draft[fieldName] = await definition.generator(draft);
                }
            }
        }

        // Cleanup before validation
        if (this.config.cleanupBeforeSave) {
            draft = this.config.cleanupBeforeSave(draft);
        }

        // Validate schema
        const validation = this.config.schema.safeParse(draft);
        if (!validation.success) {
            const errorMessage = validation.error.errors
                .map(err => `${err.path.join('.')}: ${err.message}`)
                .join('; ');
            throw new Error(`Invalid ${this.config.tableName} data: ${errorMessage}`);
        }

        const entityToSave = validation.data;

        // Check unique fields
        if (this.config.uniqueFields) {
            for (const field of this.config.uniqueFields) {
                const fieldName = field as string;
                const value = (entityToSave as any)[fieldName];
                if (value !== undefined && value !== null) {
                    // Build filter: field matches value AND (if updating) id is not equal to current id
                    const filter: Filter = (entityToSave.id && existsOk)
                        ? and(eq(fieldName, value), ne('id', entityToSave.id))
                        : eq(fieldName, value);

                    const conflict = await this.existsWhere(filter);
                    if (conflict) {
                        throw new Error(
                            `A ${this.config.tableName} with ${fieldName} "${value}" already exists`
                        );
                    }
                }
            }
        }

        // Check unique field combinations
        if (this.config.uniqueFieldCombos) {
            for (const combo of this.config.uniqueFieldCombos) {
                const filterObj: Record<string, any> = {};
                let allValuesPresent = true;

                for (const field of combo) {
                    const fieldName = field as string;
                    const value = (entityToSave as any)[fieldName];
                    if (value === undefined || value === null) {
                        allValuesPresent = false;
                        break;
                    }
                    filterObj[fieldName] = value;
                }

                if (allValuesPresent) {
                    // Build filter: all fields match AND (if updating) id is not equal to current id
                    const filter: Filter = entityToSave.id
                        ? and(...Object.entries(filterObj).map(([field, value]) => eq(field, value)), ne('id', entityToSave.id))
                        : filterObj;

                    const conflict = await this.existsWhere(filter);
                    if (conflict) {
                        const description = Object.entries(filterObj)
                            .map(([field, value]) => `${field} "${value}"`)
                            .join(', ');
                        throw new Error(
                            `A ${this.config.tableName} with ${description} already exists`
                        );
                    }
                }
            }
        }



        // Custom validation
        if (this.config.customValidation) {
            await this.config.customValidation(entityToSave);
        }

        return entityToSave;
    }
}

