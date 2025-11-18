/**
 * Filter condition type definitions
 * Used for structured querying of entities in GenericStorageService
 */

/**
 * Single condition operators
 */
export enum ConditionOperator {
    Equal = 'eq',           // field === value
    NotEqual = 'ne',
    LessThan = 'lt',           // field < value
    LessThanOrEqual = 'lte',   // field <= value
    GreaterThan = 'gt',         // field > value
    GreaterThanOrEqual = 'gte', // field >= value
    AnyOf = 'anyOf',           // field in value (value is array)
    Contains = 'contains',     // field contains value (for strings/arrays)
    StartsWith = 'startsWith', // field starts with value (for strings)
    EndsWith = 'endsWith',     // field ends with value (for strings)
    MinLength = 'minLength',   // field.length >= value (for strings/arrays)
    MaxLength = 'maxLength',   // field.length <= value (for strings/arrays)
    Truthy = 'truthy',         // !!field === true
    IsNull = 'isNull',         // field === null || field === undefined
    IsNotNull = 'isNotNull',   // field !== null && field !== undefined
    AND = 'and',
    OR = 'or',
    NOT = 'not',
}


/**
 * Single condition
 */
export interface BaseCondition {
    field: string;
    operator: ConditionOperator;
    value: any;
}

export type SingleCondition = BaseCondition | boolean | Record<string, any> | undefined | null

/**
 * Filter condition - can be a single condition, AND, or OR
 * Supports nested conditions for complex queries
 */
export type FilterCondition =
    | SingleCondition
    | { operator: ConditionOperator.AND, value: FilterCondition[] }
    | { operator: ConditionOperator.OR, value: FilterCondition[] }
    | { operator: ConditionOperator.NOT, value: FilterCondition };

/**
 * Filter type - accepts FilterCondition, array of FilterConditions, Record (converted to matchesAll), or undefined/null
 * This is the main type used for filtering in GenericStorageService
 */
export type Filter = FilterCondition | FilterCondition[];
