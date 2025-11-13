/**
 * View driver for entities
 * Provides computed fields and joins on top of base TableDriver
 * Views are read-only and provide enhanced querying capabilities
 */

import { Filter } from '../filters';
import { FieldSelection, LimitOffset } from '../drivers/IStorageDriver';
import { ViewConfig, ComputedColumnConfig, ResolvedForeignKeyConfig } from './types';
import { TableDriver } from './TableDriver';
import { getFullTableName, tableConfigRegistry } from './table';
import { storageServiceRegistry } from './TableDriver';

/**
 * View driver
 * Wraps a TableDriver and adds computed fields and join capabilities
 */
export class ViewDriver<T extends { id: string }> {
  constructor(private config: ViewConfig<T>) {}

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

  /**
   * Helper to find the keyName (application field name) for a foreign key column
   */
  private _findKeyNameForForeignKeyColumn(fk: ResolvedForeignKeyConfig, tableBuilder: any): string | undefined {
    for (const [keyName, colConfig] of Object.entries(tableBuilder.config.columns)) {
      if (colConfig === fk.column) {
        return keyName as string;
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
   * Apply joins to a single entity
   */
  private async _applyJoins(entity: T): Promise<T> {
    if (!this.config.joins || this.config.joins.length === 0) {
      return entity;
    }

    const entityWithJoins = { ...entity } as any;

    for (const join of this.config.joins) {
      const { foreignKey, type, alias, fields = '*' } = join;
      const fullTableName = getFullTableName(foreignKey.referencesTableName, foreignKey.referencesSchemaName);
      const relatedService = storageServiceRegistry.get(fullTableName) as TableDriver<any>;

      if (!relatedService) {
        console.warn(`Join references table "${foreignKey.referencesTableName}" but service not found in registry`);
        continue;
      }

      // Find the keyName for the foreign key field
      const fkKeyName = this._findKeyNameForForeignKeyColumn(foreignKey, this.config.tableDriver['builder']);
      if (!fkKeyName) {
        console.warn(`Could not find keyName for foreign key column ${foreignKey.column.columnName}`);
        continue;
      }

      const fieldValue = (entity as any)[fkKeyName];
      if (fieldValue === undefined || fieldValue === null) {
        // No foreign key value, set join field to null or empty array
        entityWithJoins[alias || foreignKey.referencesTableName] = type === 'one-to-many' ? [] : null;
        continue;
      }

      try {
        if (type === 'one-to-one' || type === 'many-to-one') {
          // Join a single related entity
          const relatedEntity = await relatedService.getById(fieldValue, fields);
          entityWithJoins[alias || foreignKey.referencesTableName] = relatedEntity;
        } else if (type === 'one-to-many') {
          // Join an array of related entities
          // Find entities where their foreign key field matches this entity's ID
          const referencesKeyName = this._findKeyNameForReferencedColumn(foreignKey.referencesColumnName, foreignKey.referencesTableName) || 'id';
          const filter = { [referencesKeyName]: entity.id };
          const relatedEntities = await relatedService.getAllWhere(fields, filter);
          entityWithJoins[alias || foreignKey.referencesTableName] = relatedEntities;
        }
      } catch (error) {
        console.error(`Error applying join for ${foreignKey.referencesTableName}:`, error);
        entityWithJoins[alias || foreignKey.referencesTableName] = type === 'one-to-many' ? [] : null;
      }
    }

    return entityWithJoins as T;
  }

  /**
   * Apply joins to multiple entities
   */
  private async _applyJoinsToMany(entities: T[]): Promise<T[]> {
    if (!this.config.joins || this.config.joins.length === 0) {
      return entities;
    }

    return Promise.all(entities.map(entity => this._applyJoins(entity)));
  }

  /**
   * Filter entity to only include specified fields
   */
  private _filterFields(entity: T, fields: FieldSelection): T {
    if (fields === '*' || fields === undefined) {
      return entity;
    }

    const filtered = {} as any;
    for (const field of fields) {
      if (field in entity) {
        filtered[field] = (entity as any)[field];
      }
    }
    return filtered as T;
  }

  /**
   * Filter multiple entities to only include specified fields
   */
  private _filterFieldsToMany(entities: T[], fields: FieldSelection): T[] {
    if (fields === '*' || fields === undefined) {
      return entities;
    }

    return entities.map(entity => this._filterFields(entity, fields));
  }

  async getAll(fields: FieldSelection = '*'): Promise<T[]> {
    const entities = await this.config.tableDriver.getAll();
    const withComputed = await this._applyComputedFieldsToMany(entities);
    const withJoins = await this._applyJoinsToMany(withComputed);
    return this._filterFieldsToMany(withJoins, fields);
  }

  async getAllWhere(fields: FieldSelection = '*', filter?: Filter, {limit, offset}: LimitOffset = {}): Promise<T[]> {
    const entities = await this.config.tableDriver.getAllWhere(fields, filter, {limit, offset});
    const withComputed = await this._applyComputedFieldsToMany(entities);
    const withJoins = await this._applyJoinsToMany(withComputed);
    return this._filterFieldsToMany(withJoins, fields);
  }

  async getOneWhere(fields: FieldSelection = '*', filter?: Filter): Promise<T | null> {
    const entities = await this.getAllWhere(fields, filter, { limit: 1 });
    return entities.length > 0 ? entities[0] : null;
  }

  async getById(id: string, fields: FieldSelection = '*'): Promise<T | null> {
    return await this.getOneWhere(fields, {id});
  }

  async getByName(name: string, fields: FieldSelection = '*'): Promise<T | null> {
    return await this.getOneWhere(fields, {name});
  }

  async existsWhere(filter: Filter): Promise<boolean> {
    return this.config.tableDriver.existsWhere(filter);
  }

  async countAll(): Promise<number> {
    return this.config.tableDriver.countAll();
  }

  async countWhere(filter: Filter): Promise<number> {
    return this.config.tableDriver.countWhere(filter);
  }
}

