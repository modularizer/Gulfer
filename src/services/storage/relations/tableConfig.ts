import { z } from 'zod';

import {IStorageDriver} from "@services/storage/drivers";
import {GeneratedFieldDefinition} from "@services/storage/relations/generatedFields";
import {ComputedFieldDefinition} from "@services/storage/relations/computedFields";
import {ForeignKeyRelationship} from "@services/storage/relations/fks";


/**
 * Configuration for generic storage operations
 */
export interface TableConfig<T> {
    tableName: string;
    schema: z.ZodSchema<T>;

    /**
     * Optional: Storage driver to use
     * Defaults to LocalStorageDriver
     */
    driver?: IStorageDriver;

    /**
     * Optional: Cleanup function before saving
     * Called prior to validation to normalize entities
     */
    cleanupBeforeSave?: (entity: Partial<T>) => Partial<T>;

    /**
     * Optional: Custom validation before saving
     * Can add additional validation beyond schema validation
     */
    customValidation?: (entity: T) => void | Promise<void>;


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
     * Optional: Computed fields that are computed from the record on select
     * These fields are not stored but computed dynamically when entities are retrieved
     */
    computedFields?: ComputedFieldDefinition<T>[];

    /**
     * Optional: Foreign key relationships
     * Defines which other entities reference this entity
     * Used for cascade deletes and referential integrity
     */
    foreignKeys?: ForeignKeyRelationship[];
}