/**
 * View driver for entities
 * Provides computed fields and joins on top of base TableDriver
 * Views are read-only and provide enhanced querying capabilities
 */

import { Filter } from '../filters';
import { FieldSelection, LimitOffset } from '../drivers/IStorageDriver';
import { ViewConfig } from './viewConfig';
import { TableDriver } from './TableDriver';
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
   * Apply joins to a single entity
   */
  private async _applyJoins(entity: T): Promise<T> {
    if (!this.config.joins || this.config.joins.length === 0) {
      return entity;
    }

    const entityWithJoins = { ...entity } as any;

    for (const join of this.config.joins) {
      const { foreignKey, type, alias, fields = '*' } = join;
      const relatedTableName = foreignKey.referencesTableName;
      const relatedService = storageServiceRegistry.get(relatedTableName) as TableDriver<any>;

      if (!relatedService) {
        console.warn(`Join references table "${relatedTableName}" but service not found in registry`);
        continue;
      }

      const fieldValue = (entity as any)[foreignKey.field];
      if (fieldValue === undefined || fieldValue === null) {
        // No foreign key value, set join field to null or empty array
        entityWithJoins[alias || relatedTableName] = type === 'one-to-many' ? [] : null;
        continue;
      }

      try {
        if (type === 'one-to-one' || type === 'many-to-one') {
          // Join a single related entity
          const relatedEntity = await relatedService.getById(fieldValue, fields);
          entityWithJoins[alias || relatedTableName] = relatedEntity;
        } else if (type === 'one-to-many') {
          // Join an array of related entities
          // Find entities where their foreign key field matches this entity's ID
          const filter = { [foreignKey.referencesField]: entity.id };
          const relatedEntities = await relatedService.getAllWhere(fields, filter);
          entityWithJoins[alias || relatedTableName] = relatedEntities;
        }
      } catch (error) {
        console.error(`Error applying join for ${relatedTableName}:`, error);
        entityWithJoins[alias || relatedTableName] = type === 'one-to-many' ? [] : null;
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

