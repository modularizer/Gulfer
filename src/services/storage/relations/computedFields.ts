/**
 * Configuration for computed fields
 * Computed fields are not stored but computed dynamically from the record on select
 */

/**
 * Computed field generator function
 * Takes the entity record and returns the computed value
 */
export type ComputedFieldGenerator<T> = (
  entity: T
) => any | Promise<any>;

/**
 * Definition for a computed field
 */
export interface ComputedFieldDefinition<T> {
  /**
   * Field name to add to the entity
   */
  field: string;
  
  /**
   * Generator function that computes the field value from the entity
   */
  generator: ComputedFieldGenerator<T>;
}

