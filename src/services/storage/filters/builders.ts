/**
 * Filter condition builders
 * Helper functions for constructing filter conditions
 */

import { FilterCondition, SingleCondition, ConditionOperator } from './types';

/**
 * Create an equality condition
 */
export function eq(field: string, value: any): SingleCondition {
  return {
    field,
    operator: ConditionOperator.Equal,
    value,
  };
}

/**
 * Create a not equal condition
 */
export function ne(field: string, value: any): SingleCondition {
  return {
    field,
    operator: ConditionOperator.NotEqual,
    value,
  };
}

/**
 * Create a less than condition
 */
export function lt(field: string, value: number | string | Date): SingleCondition {
  return {
    field,
    operator: ConditionOperator.LessThan,
    value,
  };
}

/**
 * Create a less than or equal condition
 */
export function lte(field: string, value: number | string | Date): SingleCondition {
  return {
    field,
    operator: ConditionOperator.LessThanOrEqual,
    value,
  };
}

/**
 * Create a greater than condition
 */
export function gt(field: string, value: number | string | Date): SingleCondition {
  return {
    field,
    operator: ConditionOperator.GreaterThan,
    value,
  };
}

/**
 * Create a greater than or equal condition
 */
export function gte(field: string, value: number | string | Date): SingleCondition {
  return {
    field,
    operator: ConditionOperator.GreaterThanOrEqual,
    value,
  };
}

/**
 * Create an anyOf condition (field value must be in the provided array)
 */
export function anyOf(field: string, values: any[]): SingleCondition {
  return {
    field,
    operator: ConditionOperator.AnyOf,
    value: values,
  };
}

/**
 * Create a contains condition (field contains the value)
 */
export function contains(field: string, value: string | any): SingleCondition {
  return {
    field,
    operator: ConditionOperator.Contains,
    value,
  };
}

/**
 * Create a startsWith condition
 */
export function startsWith(field: string, value: string): SingleCondition {
  return {
    field,
    operator: ConditionOperator.StartsWith,
    value,
  };
}

/**
 * Create an endsWith condition
 */
export function endsWith(field: string, value: string): SingleCondition {
  return {
    field,
    operator: ConditionOperator.EndsWith,
    value,
  };
}

/**
 * Create a minLength condition (field length >= value)
 * Works for strings and arrays
 */
export function minLength(field: string, value: number): SingleCondition {
  return {
    field,
    operator: ConditionOperator.MinLength,
    value,
  };
}

/**
 * Create a maxLength condition (field length <= value)
 * Works for strings and arrays
 */
export function maxLength(field: string, value: number): SingleCondition {
  return {
    field,
    operator: ConditionOperator.MaxLength,
    value,
  };
}

/**
 * Create a truthy condition (field is truthy)
 */
export function truthy(field: string): SingleCondition {
  return {
    field,
    operator: ConditionOperator.Truthy,
    value: true, // Value is not used for truthy, but required by interface
  };
}

/**
 * Create an isNull condition (field === null || field === undefined)
 */
export function isNull(field: string): SingleCondition {
  return {
    field,
    operator: ConditionOperator.IsNull,
    value: null, // Value is not used for isNull, but required by interface
  };
}

/**
 * Create an isNotNull condition (field !== null && field !== undefined)
 */
export function isNotNull(field: string): SingleCondition {
  return {
    field,
    operator: ConditionOperator.IsNotNull,
    value: null, // Value is not used for isNotNull, but required by interface
  };
}

/**
 * Create a matchesAll condition
 * Builds an AND condition of equals for each key-value pair in the record
 * 
 * @example
 * matchesAll({ name: 'John', age: 30 })
 * // Equivalent to: and(eq('name', 'John'), eq('age', 30))
 */
export function matchesAll(record: Record<string, any>): { and: FilterCondition[] } {
  const conditions: FilterCondition[] = Object.entries(record).map(([field, value]) => 
    eq(field, value)
  );
  return { and: conditions };
}

/**
 * Create an AND condition (all conditions must match)
 */
export function and(...conditions: (FilterCondition | undefined | null)[]): { and: FilterCondition[] } {
  return { and: conditions.filter(c => !!c) as FilterCondition[] };
}

/**
 * Create an OR condition (any condition must match)
 */
export function or(...conditions: FilterCondition[]): { or: FilterCondition[] } {
  return { or: conditions };
}

