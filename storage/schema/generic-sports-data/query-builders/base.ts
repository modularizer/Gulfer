/**
 * Base utilities for query builders
 * Shared functionality across all query builders
 */

import type { SQL } from 'drizzle-orm';

/**
 * Query builder state for common operations
 */
export interface QueryBuilderState {
  whereCondition?: SQL;
  limitValue?: number;
  offsetValue?: number;
}

/**
 * Apply common query modifiers (where, limit, offset) to a query
 */
export function applyQueryModifiers<T>(
  query: T,
  state: QueryBuilderState,
  applyWhere: (q: T, condition: SQL) => T,
  applyLimit: (q: T, n: number) => T,
  applyOffset: (q: T, n: number) => T
): T {
  let result = query;
  
  if (state.whereCondition) {
    result = applyWhere(result, state.whereCondition);
  }
  if (state.limitValue !== undefined) {
    result = applyLimit(result, state.limitValue);
  }
  if (state.offsetValue !== undefined) {
    result = applyOffset(result, state.offsetValue);
  }
  
  return result;
}

