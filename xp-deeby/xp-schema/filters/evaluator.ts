/**
 * Filter condition evaluator
 * Evaluates filter conditions against entities
 */

import { FilterCondition, ConditionOperator, Filter } from './types';
import { matchesAll } from './builders';

/**
 * Evaluate a filter condition (recursive for and/or/not/list)
 * Can accept a single condition or an array of conditions
 * Arrays are treated as AND logic (all conditions must match)
 * Plain Record objects are converted to matchesAll filters
 */
export function evaluateCondition<T extends Record<string, any>>(
    entity: T,
    condition: Filter
): boolean {
    if (condition === null || condition === undefined) return true;
    if (condition === true) return true;
    if (condition === false) return true;
    if (Array.isArray(condition)) return condition.every(c => evaluateCondition(entity, c));
    if (isPlainRecord(condition)) {
        condition = matchesAll(condition);
    }



    const fieldValue = entity[condition.field];

    switch (condition.operator) {
        case ConditionOperator.AND:
            return condition.value.every((c: FilterCondition) => evaluateCondition(entity, c));

        case ConditionOperator.OR:
            return condition.value.some((c: FilterCondition) => evaluateCondition(entity, c));

        case ConditionOperator.NOT:
            return !evaluateCondition(entity, condition.value);

        case ConditionOperator.Equal:
            return fieldValue === condition.value;

        case ConditionOperator.NotEqual:
            return fieldValue !== condition.value;

        case ConditionOperator.LessThan:
            return fieldValue < condition.value;

        case ConditionOperator.LessThanOrEqual:
            return fieldValue <= condition.value;

        case ConditionOperator.GreaterThan:
            return fieldValue > condition.value;

        case ConditionOperator.GreaterThanOrEqual:
            return fieldValue >= condition.value;

        case ConditionOperator.AnyOf:
            if (!Array.isArray(condition.value)) {
                return false;
            }
            return condition.value.includes(fieldValue);

        case ConditionOperator.Contains:
            if (typeof fieldValue === 'string') {
                return fieldValue.includes(String(condition.value));
            }
            if (Array.isArray(fieldValue)) {
                return fieldValue.includes(condition.value);
            }
            return false;

        case ConditionOperator.StartsWith:
            if (typeof fieldValue === 'string') {
                return fieldValue.startsWith(String(condition.value));
            }
            return false;

        case ConditionOperator.EndsWith:
            if (typeof fieldValue === 'string') {
                return fieldValue.endsWith(String(condition.value));
            }
            return false;

        case ConditionOperator.MinLength:
            if (typeof fieldValue === 'string' || Array.isArray(fieldValue)) {
                return fieldValue.length >= condition.value;
            }
            return false;

        case ConditionOperator.MaxLength:
            if (typeof fieldValue === 'string' || Array.isArray(fieldValue)) {
                return fieldValue.length <= condition.value;
            }
            return false;

        case ConditionOperator.Truthy:
            return !!fieldValue;

        case ConditionOperator.IsNull:
            return fieldValue === null || fieldValue === undefined;

        case ConditionOperator.IsNotNull:
            return fieldValue !== null && fieldValue !== undefined;

        default:
            return false;
    }
}


export function getEvaluator(condition: Filter){
    function evaluate<T extends Record<string, any>>(entity: T){
        return evaluateCondition(entity, condition);
    }
    return evaluate;
}

/**
 * Check if a value is a plain Record (object) that should be converted to matchesAll
 */
function isPlainRecord(value: any): value is Record<string, any> {
    if (!value || typeof value !== 'object') {
        return false;
    }

    // Exclude arrays
    if (Array.isArray(value)) {
        return false;
    }

    // Exclude special objects like Date, RegExp, etc.
    if (value instanceof Date || value instanceof RegExp) {
        return false;
    }

    // Exclude objects with filter condition keys (field/operator, and, or)
    if ('field' in value && 'operator' in value) {
        return false;
    }
    if ('and' in value || 'or' in value) {
        return false;
    }

    // It's a plain object/Record
    return true;
}



/**
 * Filter an array of entities using a filter condition
 * Convenience function that applies evaluateFilter to each entity
 *
 * @param entities Array of entities to filter
 * @param filter Filter condition to apply
 * @returns Filtered array of entities
 *
 * @example
 * const filtered = filterEntities(users, { name: 'John', age: 30 });
 * const filtered = filterEntities(rounds, eq('courseId', 'abc123'));
 * const filtered = filterEntities(scores, [eq('roundId', 'round123'), gt('throws', 2)]);
 */
export function filterEntities<T extends Record<string, any>>(
    entities: T[],
    filter?: Filter
): T[] {
    return entities.filter(getEvaluator(filter));
}

/**
 * Find the first entity matching a filter condition
 * Convenience function that returns the first matching entity or null
 *
 * @param entities Array of entities to search
 * @param filter Filter condition to apply
 * @returns First matching entity or null if none found
 *
 * @example
 * const user = findFirst(users, { name: 'John', age: 30 });
 * const round = findFirst(rounds, eq('courseId', 'abc123'));
 * const score = findFirst(scores, [eq('roundId', 'round123'), gt('throws', 2)]);
 */
export function findFirst<T extends Record<string, any>>(
    entities: T[],
    filter?: Filter
): T | null {
    return entities.find(getEvaluator(filter)) || null;
}


export function matchExists<T extends Record<string, any>>(
    entities: T[],
    filter?: Filter
): boolean {
    if (!filter) {
        return entities.length > 0;
    }
    return entities.some(getEvaluator(filter));
}

export function countWhere<T extends Record<string, any>>(
    entities: T[],
    filter?: Filter
): number {
    return entities.filter(getEvaluator(filter)).length;
}

/**
 * Find entities matching a filter condition with pagination support
 * Convenience function that applies filter, offset, and limit
 * Optimized to stop filtering once enough results are found (when limit is set)
 *
 * @param entities Array of entities to search
 * @param filter Filter condition to apply
 * @param limit Maximum number of results to return (optional)
 * @param offset Number of results to skip before returning (optional)
 * @returns Filtered and paginated array of entities
 *
 * @example
 * // Get first 10 users named John
 * const users = findWhere(allUsers, { name: 'John' }, 10, 0);
 *
 * // Get next 10 users (pagination)
 * const moreUsers = findWhere(allUsers, { name: 'John' }, 10, 10);
 *
 * // Get all rounds for a course with limit
 * const rounds = findWhere(allRounds, eq('courseId', 'abc123'), 20);
 */
export function findWhere<T extends Record<string, any>>(
    entities: T[],
    {filter, limit, offset}: {filter?: Filter, limit?: number, offset?: number} = {}
): T[] {
    // If no filter, just handle pagination
    if (!filter) {
        const start = offset ?? 0;
        const end = limit !== undefined ? start + limit : undefined;
        return entities.slice(start, end);
    }

    // If limit is set, we can optimize by stopping early
    const hasLimit = limit !== undefined && limit > 0;
    const skipCount = offset ?? 0;

    const results: T[] = [];
    let skipped = 0;

    for (const entity of entities) {
        if (evaluateCondition(entity, filter)) {
            // Skip entities until we reach the offset
            if (skipped < skipCount) {
                skipped++;
                continue;
            }

            // Add to results
            results.push(entity);

            // Stop early if we've collected enough results
            if (hasLimit && results.length >= limit) {
                break;
            }
        }
    }

    return results;
}
