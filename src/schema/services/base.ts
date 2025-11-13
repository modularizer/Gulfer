/**
 * Base Service Class
 * 
 * Provides common functionality for all entity services.
 * All services should extend this base class.
 */

import type { Database } from '@services/storage/db';
import * as schema from '../tables';
import { eq, and, inArray, type SQL } from 'drizzle-orm';

export abstract class BaseService {
  protected db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Get a single entity by ID
   */
  protected async getById<T>(
    table: any,
    id: string
  ): Promise<T | null> {
    const results = await this.db
      .select()
      .from(table)
      .where(eq(table.id, id))
      .limit(1);
    
    return results.length > 0 ? (results[0] as T) : null;
  }

  /**
   * Get multiple entities by IDs
   */
  protected async getByIds<T>(
    table: any,
    ids: string[]
  ): Promise<T[]> {
    if (ids.length === 0) return [];
    
    const results = await this.db
      .select()
      .from(table)
      .where(inArray(table.id, ids));
    
    return results as T[];
  }

  /**
   * Get all entities with optional filtering
   */
  protected async getAll<T>(
    table: any,
    whereCondition?: SQL
  ): Promise<T[]> {
    let query = this.db.select().from(table);
    
    if (whereCondition) {
      query = query.where(whereCondition);
    }
    
    const results = await query;
    return results as T[];
  }

  /**
   * Check if an entity exists by ID
   */
  protected async exists(
    table: any,
    id: string
  ): Promise<boolean> {
    const result = await this.getById(table, id);
    return result !== null;
  }

  /**
   * Delete an entity by ID
   */
  protected async deleteById(
    table: any,
    id: string
  ): Promise<void> {
    await this.db
      .delete(table)
      .where(eq(table.id, id));
  }

  /**
   * Delete multiple entities by IDs
   */
  protected async deleteByIds(
    table: any,
    ids: string[]
  ): Promise<void> {
    if (ids.length === 0) return;
    
    await this.db
      .delete(table)
      .where(inArray(table.id, ids));
  }
}

