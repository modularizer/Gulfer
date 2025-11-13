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
import {TableConfigBuilder, getFullTableName, tableConfigRegistry} from "@services/storage/orm/table";
import {ResolvedTableConfig, Columns, ResolvedColumnConfig} from "@services/storage/orm/types";



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
     * Transform entity from storage format (columnNames) to application format (keyNames)
     * and filter to only include specified fields
     */
    private async _resolve(entity: Record<string, any>, columns: Columns): Promise<T> {
        // First, transform from storage format (columnNames) to application format (keyNames)
        const appEntity = await this.builder.fromStorageFormat(entity);
        
        // If columns is '*', return the full transformed entity
        if (columns === '*') {
            return appEntity as T;
        }
        
        // Otherwise, filter to only include specified columns
        const columnNames = this.builder.resolveColumns(columns);
        const keyNames = this.builder.resolveKeyNames(columnNames);
        
        const filtered = {} as any;
        for (const keyName of keyNames) {
            if (keyName in appEntity) {
                filtered[keyName] = appEntity[keyName];
            }
        }
        return filtered as T;
    }

    /**
     * Transform multiple entities from storage format to application format
     * and filter to only include specified fields
     */
    private async _resolveMany(entities: Record<string, any>[], columns: Columns): Promise<T[]> {
        return Promise.all(entities.map(entity => this._resolve(entity, columns)));
    }

    async getAll(columns: Columns = '*'): Promise<T[]> {
        const columnNames = this.builder.resolveColumns(columns);
        const entities = await this.driver.select<Record<string, any>>(this.config, { fields: columnNames.length > 0 && columnNames.length < Object.keys(this.builder.columnNames).length ? columnNames : undefined });
        return this._resolveMany(entities, columns);
    }

    async getAllWhere(columns: Columns = '*', filter?: Filter, {limit, offset}: LimitOffset = {}): Promise<T[]> {
        const columnNames = this.builder.resolveColumns(columns);
        // Transform filter from keyNames to columnNames for storage
        const storageFilter = this._transformFilterToStorageFormat(filter);
        const entities = await this.driver.select<Record<string, any>>(this.config, { filter: storageFilter, limit, offset, fields: columnNames.length > 0 && columnNames.length < Object.keys(this.builder.columnNames).length ? columnNames : undefined });
        return this._resolveMany(entities, columns);
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
        // Transform filter from keyNames to columnNames for storage
        const storageFilter = this._transformFilterToStorageFormat(filter);
        return this.driver.exists(this.config, storageFilter);
    }

    async countAll(): Promise<number> {
        return this.driver.count(this.config);
    }

    async countWhere(filter: Filter): Promise<number> {
        // Transform filter from keyNames to columnNames for storage
        const storageFilter = this._transformFilterToStorageFormat(filter);
        return this.driver.count(this.config, storageFilter);
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
                  const fullTableName = getFullTableName(fk.referencesTableName, fk.referencesSchemaName);
                  const childService = storageServiceRegistry.get(fullTableName);
                  if (childService) {
                      // Find the keyName for the referenced column
                      const referencesKeyName = this._findKeyNameForReferencedColumn(fk.referencesColumnName, fk.referencesTableName) || 'id';
                      for (let id of recordIds) {
                          await childService.delete({[referencesKeyName]: id}, cascade);
                      }
                  } else {
                      throw new Error(`Foreign key references storage key "${fk.referencesTableName}" but service not found in registry`);
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



    /**
     * Helper to find the keyName (application field name) for a column config
     */
    private _findKeyNameForColumn(column: ResolvedColumnConfig): keyof T | undefined {
        for (const [keyName, colConfig] of Object.entries(this.config.columns)) {
            if (colConfig === column) {
                return keyName as keyof T;
            }
        }
        return undefined;
    }

    /**
     * Helper to find the keyName (application field name) for a referenced column
     */
    private _findKeyNameForReferencedColumn(columnName: string, tableName: string): string | undefined {
        const fullTableName = getFullTableName(tableName, undefined);
        const referencedTable = tableConfigRegistry.get(fullTableName);
        if (!referencedTable) return undefined;
        
        for (const [keyName, colConfig] of Object.entries(referencedTable.config.columns)) {
            if (colConfig.columnName === columnName) {
                return keyName as string;
            }
        }
        return undefined;
    }

    /**
     * Transform filter from application format (keyNames) to storage format (columnNames)
     * Handles plain Record objects, condition objects, and nested AND/OR/NOT structures
     */
    private _transformFilterToStorageFormat(filter: Filter | undefined): Filter | undefined {
        if (!filter) return undefined;
        
        // Handle plain Record objects (e.g., {id: '123', name: 'test'})
        // These are converted to matchesAll filters by the evaluator, so we transform the keys
        if (typeof filter === 'object' && !Array.isArray(filter) && 'field' in filter === false && 'operator' in filter === false) {
            const transformed: Record<string, any> = {};
            for (const [keyName, value] of Object.entries(filter)) {
                const columnName = this.builder.columnNames[keyName as keyof T] || keyName;
                transformed[columnName] = value;
            }
            return transformed;
        }
        
        // Handle arrays
        if (Array.isArray(filter)) {
            return filter.map(f => this._transformFilterToStorageFormat(f) as any);
        }
        
        // Handle condition objects with 'field' property
        if (typeof filter === 'object' && 'field' in filter && 'operator' in filter) {
            const condition = filter as any;
            const columnName = this.builder.columnNames[condition.field as keyof T] || condition.field;
            return { ...condition, field: columnName };
        }
        
        // Handle AND/OR/NOT structures (using operator and value)
        if (typeof filter === 'object' && 'operator' in filter && 'value' in filter) {
            const op = (filter as any).operator;
            if (op === 'and' || op === 'or') {
                return {
                    ...filter,
                    value: (filter as any).value.map((f: any) => this._transformFilterToStorageFormat(f))
                };
            } else if (op === 'not') {
                return {
                    ...filter,
                    value: this._transformFilterToStorageFormat((filter as any).value)
                };
            }
        }
        
        // For other types (boolean, null, etc.), return as-is
        return filter;
    }

    private async _prepare(entity: Partial<T>, existsOk?: boolean): Promise<Record<string, any>> {
        // Validate schema - entity comes in with keyNames (application format)
        const validation = this.config.schema.safeParse(entity);
        if (!validation.success) {
            const errorMessage = validation.error.errors
                .map(err => `${err.path.join('.')}: ${err.message}`)
                .join('; ');
            throw new Error(`Invalid ${this.config.tableName} data: ${errorMessage}`);
        }

        const validatedEntity = validation.data as T;

        // Enforce foreign key constraints (only if driver doesn't handle it natively)
        if (!this.capabilities.enforcesForeignKeys && this.config.foreignKeys) {
            for (const fk of this.config.foreignKeys) {
                // Find the keyName for the foreign key column
                const fkKeyName = this._findKeyNameForColumn(fk.column);
                if (!fkKeyName) {
                    throw new Error(`Could not find keyName for foreign key column ${fk.column.columnName}`);
                }
                
                const fkValue = (validatedEntity as any)[fkKeyName];
                
                // Only validate if FK value is provided (null/undefined are allowed if FK is optional)
                if (fkValue !== undefined && fkValue !== null && fkValue !== '') {
                    const fullTableName = getFullTableName(fk.referencesTableName, fk.referencesSchemaName);
                    const referencedService = storageServiceRegistry.get(fullTableName);
                    
                    if (!referencedService) {
                        throw new Error(
                            `Foreign key "${fkKeyName as string}" references table "${fk.referencesTableName}" but service not found in registry`
                        );
                    }
                    
                    // Find the keyName for the referenced column
                    const referencesKeyName = this._findKeyNameForReferencedColumn(fk.referencesColumnName, fk.referencesTableName) || 'id';
                    
                    // Check if the referenced entity exists
                    // Use getById if referencesColumnName is 'id', otherwise use getOneWhere with filter
                    const referencedEntity = fk.referencesColumnName === 'id'
                        ? await referencedService.getById(fkValue)
                        : await referencedService.getOneWhere('*', { [referencesKeyName]: fkValue });
                    
                    if (!referencedEntity) {
                        throw new Error(
                            `Foreign key constraint violation: ${fkKeyName as string}="${fkValue}" references non-existent entity in table "${fk.referencesTableName}" (column: ${fk.referencesColumnName})`
                        );
                    }
                }
            }
        }

        // Check unique fields - iterate through columns that are marked as unique
        if (!this.capabilities.enforcesUniqueConstraints) {
            for (const [keyName, colConfig] of Object.entries(this.config.columns)) {
                if (colConfig.unique && colConfig.enforceUnique) {
                    const value = (validatedEntity as any)[keyName];
                    if (value !== undefined && value !== null) {
                        // Build filter: field matches value AND (if updating) id is not equal to current id
                        // Use columnName for storage format
                        const idColumnName = this.builder.columnNames.id || 'id';
                        const filter: Filter = (validatedEntity.id && existsOk)
                            ? and(eq(colConfig.columnName, value), ne(idColumnName, validatedEntity.id))
                            : eq(colConfig.columnName, value);

                        const conflict = await this.existsWhere(filter);
                        if (conflict) {
                            throw new Error(
                                `A ${this.config.tableName} with ${keyName as string} "${value}" already exists`
                            );
                        }
                    }
                }
            }
        }

        // Check unique field combinations (only if driver doesn't handle it natively)
        if (!this.capabilities.enforcesUniqueConstraints && this.config.uniqueFieldCombos) {
            for (const combo of this.config.uniqueFieldCombos) {
                const filterObj: Record<string, any> = {};
                let allValuesPresent = true;

                // combo.columnNames contains storage column names, need to map to keyNames
                for (const columnName of combo.columnNames) {
                    const keyName = this.builder.columnDisplayNames[columnName];
                    if (!keyName) {
                        // If columnName not found in display names, this is an error
                        // We can't use columnName directly because validatedEntity is in application format (keyNames)
                        console.warn(`Column name ${columnName} in unique constraint not found in columnDisplayNames - skipping constraint check`);
                        allValuesPresent = false;
                        break;
                    }
                    // Get value from validatedEntity using keyName (application format)
                    const value = (validatedEntity as any)[keyName];
                    if (value === undefined || value === null) {
                        allValuesPresent = false;
                        break;
                    }
                    // Use columnName for the filter (storage format)
                    filterObj[columnName] = value;
                }

                if (allValuesPresent) {
                    // Build filter: all fields match AND (if updating) id is not equal to current id
                    // filterObj already uses columnNames, so we can use them directly
                    const idColumnName = this.builder.columnNames.id || 'id';
                    const filter: Filter = validatedEntity.id
                        ? and(...Object.entries(filterObj).map(([field, value]) => eq(field, value)), ne(idColumnName, validatedEntity.id))
                        : filterObj;

                    const conflict = await this.existsWhere(filter);
                    if (conflict) {
                        const description = Object.entries(filterObj)
                            .map(([field, value]) => {
                                const keyName = this.builder.columnDisplayNames[field];
                                return `${keyName || field} "${value}"`;
                            })
                            .join(', ');
                        throw new Error(
                            `A ${this.config.tableName} with ${description} already exists`
                        );
                    }
                }
            }
        }
        

        // Transform from application format (keyNames) to storage format (columnNames) before saving
        return await this.builder.toStorageFormat(validatedEntity);
    }
}

