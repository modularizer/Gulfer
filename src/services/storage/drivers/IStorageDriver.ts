/**
 * Abstract storage driver interface
 * Defines the contract that all storage implementations must follow
 * This interface is driver-agnostic and can be implemented by:
 * - LocalStorageDriver (localStorage/IndexedDB)
 * - SQLiteDriver (SQLite database)
 * - PostgresDriver (PostgreSQL)
 * - MongoDriver (MongoDB)
 * - RestApiDriver (REST API)
 * - etc.
 */

import { Filter } from '../filters';


export interface LimitOffset {
    limit?: number;
    offset?: number;
}


/**
 * Field selection type
 * '*' or undefined means all fields, array of strings means only those fields
 */
export type FieldSelection = '*' | string[] | undefined;

/**
 * Options for select queries
 */
export interface SelectOptions extends LimitOffset{
  filter?: Filter;
  fields?: FieldSelection;
}

/**
 * Driver capabilities
 * Indicates what features the driver handles natively
 * If a capability is true, the driver handles it natively and TableDriver should skip it
 * If false, TableDriver will handle the enforcement
 */
export interface DriverCapabilities {
  /**
   * Whether the driver handles field generation natively
   * (e.g., auto-increment, generated columns)
   */
  handlesFieldGeneration?: boolean;
  
  /**
   * Whether the driver enforces unique constraints natively
   * (e.g., UNIQUE constraints in SQL)
   */
  enforcesUniqueConstraints?: boolean;
  
  /**
   * Whether the driver enforces foreign key constraints natively
   * (e.g., FOREIGN KEY constraints in SQL)
   */
  enforcesForeignKeys?: boolean;
  
  /**
   * Whether the driver handles foreign key deletion cascades natively
   * (e.g., ON DELETE CASCADE in SQL)
   */
  handlesFKDeletionCascade?: boolean;
}

/**
 * Storage driver interface
 * All storage implementations must implement these methods
 * Uses tableName for a database-like interface - drivers convert to storageKey internally
 */
export interface IStorageDriver {
  /**
   * Get the capabilities of this driver
   * Indicates what features are handled natively vs. requiring TableDriver enforcement
   */
  getCapabilities(): DriverCapabilities;
  
  /**
   * Select entities matching the filter conditions
   * This is the core query method - implementations can optimize based on storage type
   * For SQL: push filters to WHERE clause
   * For NoSQL: use native query language
   * For localStorage: fetch all then filter in memory
   */
  select<T extends { id: string }>(
    tableName: string,
    options?: SelectOptions
  ): Promise<T[]>;

  /**
   * Insert a new entity
   * If entity.id is missing or empty, it will be generated automatically
   * Should throw if entity with same ID already exists (unless upsert is used)
   * The entity will be modified in place to include the generated ID
   */
  insert<T extends { id?: string }>(
    tableName: string,
    entity: T
  ): Promise<T & { id: string }>;

  /**
   * Upsert an entity (insert if new, update if exists)
   * This is the primary save operation
   */
  upsert<T extends { id: string }>(
    tableName: string,
    entity: T
  ): Promise<void>;

  /**
   * Delete entities matching the filter
   * Returns the number of entities deleted
   */
  delete(
    tableName: string,
    filter: Filter
  ): Promise<number>;

  /**
   * Delete entity by ID
   */
  deleteById(
    tableName: string,
    id: string
  ): Promise<boolean>;

  /**
   * Check if any entities match the filter
   */
  exists(
    tableName: string,
    filter: Filter
  ): Promise<boolean>;

  /**
   * Count entities matching the filter
   */
  count(
    tableName: string,
    filter?: Filter
  ): Promise<number>;
}

