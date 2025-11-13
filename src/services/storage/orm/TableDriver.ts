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
  Filter,
} from '../filters';
import { and, eq, ne } from '../filters/builders';
import {IStorageDriver, LimitOffset, FieldSelection} from '../drivers/IStorageDriver';
import { defaultStorageDriver } from '@services/storage/drivers/LocalStorageDriver';
import {TableConfigBuilder} from "@services/storage/orm/table";
import {ResolvedTableConfig, Columns} from "@services/storage/orm/types";



/**
 * Storage service registry
 * Tracks all storage services to enable cascade deletes and foreign key lookups
 */
export const storageServiceRegistry = new Map<string, TableDriver<any>>();



/**
 * Generic storage service
 * Provides common CRUD operations for any entity type with an id field
 * This service is driver-agnostic and works with any IStorageDriver implementation
 */
export class TableDriver<T extends { id: string }> {
    private capabilities: ReturnType<IStorageDriver['getCapabilities']>;

    constructor(private builder: TableConfigBuilder<T>, private driver: IStorageDriver = defaultStorageDriver) {
        this.capabilities = this.driver.getCapabilities();

        // Register this service in the global registry
        storageServiceRegistry.set(builder.fullName, this);
    }

    get config(): ResolvedTableConfig<T> {
        return this.builder.config;
    }

    get tableName(): string {
        return this.config.tableName;
    }

    /**
     * Filter entity to only include specified fields
     */
    private _resolve(entity: T, columns: Columns): T {
        const columnNames = this.builder.resolveColumns(columns);

        const filtered = {} as any;
        for (const cn of columnNames) {
            if (cn in entity) {
                filtered[this.builder.columnDisplayNames[cn]] = (entity as any)[cn];
            }
        }
        return filtered as T;
    }

    /**
     * Filter multiple entities to only include specified fields
     */
    private _resolveMany(entities: T[], columns: Columns): T[] {
        return entities.map(entity => this._resolve(entity, columns));
    }

    async getAll(columns: Columns = '*'): Promise<T[]> {
        const columnNames = this.builder.resolveColumns(columns);
        const entities = await this.driver.select<T>(this.config, {  columnNames });
        return this._resolveMany(entities, columnNames);
    }

    async getAllWhere(columns: Columns = '*', filter?: Filter, {limit, offset}: LimitOffset = {}): Promise<T[]> {
        const columnNames = this.builder.resolveColumns(columns);
        const entities = await this.driver.select<T>(this.config, { filter, limit, offset, columnNames });
        return this._resolveMany(entities, columnNames);
    }

    async getOneWhere(columns: Columns = '*', filter?: Filter): Promise<T | null> {
        const entities = await this.getAllWhere(columns, filter, { limit: 1 });
        return entities.length > 0 ? entities[0] : null;
    }

    async getById(id: string, columns: Columns = '*'): Promise<T | null> {
        return await this.getOneWhere(columns, {id});
    }

    async getByName(name: string, columns: Columns = '*'): Promise<T | null> {
        return await this.getOneWhere(columns, {name});
    }


    async existsWhere(filter: Filter): Promise<boolean> {
        return this.driver.exists(this.config, filter);
    }

    async countAll(): Promise<number> {
        return this.driver.count(this.config);
    }

    async countWhere(filter: Filter): Promise<number> {
        return this.driver.count(this.config, filter);
    }


    async upsert(entity: Partial<T>): Promise<void> {
        const entityToSave = await this._prepare(entity, true);
        await this.driver.upsert(this.config, entityToSave);
    }

    async insert(entity: Partial<T>): Promise<void> {
        const entityToSave = await this._prepare(entity, false);
        await this.driver.insert(this.config, entityToSave);
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
        const recordIds = (await this.getAllWhere(undefined, filter)).map(r => r.id);
        if (!recordIds.length) return [];

        // Handle cascade deletes if enabled (only if driver doesn't handle it natively)
        if (cascade && !this.capabilities.handlesFKDeletionCascade && this.config.foreignKeys) {
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
            await this.driver.deleteById(this.config, id);
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

        // Validate schema
        const validation = this.config.schema.safeParse(
            Object.fromEntries(data)
        );
        if (!validation.success) {
            const errorMessage = validation.error.errors
                .map(err => `${err.path.join('.')}: ${err.message}`)
                .join('; ');
            throw new Error(`Invalid ${this.config.tableName} data: ${errorMessage}`);
        }

        const entityToSave = validation.data;

        // Enforce foreign key constraints (only if driver doesn't handle it natively)
        if (!this.capabilities.enforcesForeignKeys && this.config.foreignKeys) {
            for (const fk of this.config.foreignKeys) {
                const fkValue = (entityToSave as any)[fk.field];
                
                // Only validate if FK value is provided (null/undefined are allowed if FK is optional)
                if (fkValue !== undefined && fkValue !== null && fkValue !== '') {
                    const referencedService = storageServiceRegistry.get(fk.referencesTableName);
                    
                    if (!referencedService) {
                        throw new Error(
                            `Foreign key "${fk.field}" references table "${fk.referencesTableName}" but service not found in registry`
                        );
                    }
                    
                    // Check if the referenced entity exists
                    // Use getById if referencesField is 'id', otherwise use getOneWhere with filter
                    const referencedEntity = fk.referencesField === 'id'
                        ? await referencedService.getById(fkValue)
                        : await referencedService.getOneWhere('*', { [fk.referencesField]: fkValue });
                    
                    if (!referencedEntity) {
                        throw new Error(
                            `Foreign key constraint violation: ${fk.field}="${fkValue}" references non-existent entity in table "${fk.referencesTableName}" (field: ${fk.referencesField})`
                        );
                    }
                }
            }
        }

        // Check unique fields (only if driver doesn't handle it natively)
        if (!this.capabilities.enforcesUniqueConstraints && this.config.uniqueFields) {
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

        // Check unique field combinations (only if driver doesn't handle it natively)
        if (!this.capabilities.enforcesUniqueConstraints && this.config.uniqueFieldCombos) {
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

