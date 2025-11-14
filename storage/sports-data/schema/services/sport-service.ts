/**
 * Sport Service
 * 
 * Object-oriented service for managing sports.
 * Provides high-level methods for sport operations.
 */

import { BaseTableService } from './base-table-service';
import type { Database } from '../../../adapters';
import { eq, like } from 'drizzle-orm';
import * as schema from '../tables';
import type { Sport } from '../tables';
import { upsertEntity } from '../query-builders';
import { generateUUID } from '@utils/uuid';

export class SportService extends BaseTableService<Sport> {
  protected getTableName(): string {
    return 'sports';
  }

  protected getTable(): any {
    return schema.sports;
  }
  /**
   * Get a sport by ID
   */
  async getSport(sportId: string): Promise<Sport | null> {
    return await this.getById<Sport>(schema.sports, sportId);
  }

  /**
   * Get multiple sports by IDs
   */
  async getSports(sportIds: string[]): Promise<Sport[]> {
    return await this.getByIds<Sport>(schema.sports, sportIds);
  }

  /**
   * Get all sports
   */
  async getAllSports(): Promise<Sport[]> {
    return await this.getAll<Sport>(schema.sports);
  }

  /**
   * Get sports by name (case-insensitive search)
   */
  async getSportsByName(name: string): Promise<Sport[]> {
    return await this.getAll<Sport>(
      schema.sports,
      like(schema.sports.name, `%${name}%`)
    );
  }

  /**
   * Create or update a sport
   */
  async saveSport(sport: Partial<Sport>): Promise<void> {
    await upsertEntity(this.db, schema.sports, sport);
  }

  /**
   * Create a new sport
   */
  async createSport(sport: Partial<Sport>): Promise<Sport> {
    const sportData: Partial<Sport> = {
      id: sport.id || generateUUID(),
      name: sport.name || null,
      notes: sport.notes || null,
      lat: sport.lat ?? 0,
      lng: sport.lng ?? 0,
      metadata: sport.metadata || null,
    };
    
    await this.saveSport(sportData);
    
    const saved = await this.getSport(sportData.id!);
    if (!saved) {
      throw new Error('Failed to create sport');
    }
    
    return saved;
  }

  /**
   * Update a sport
   */
  async updateSport(sportId: string, updates: Partial<Sport>): Promise<Sport> {
    const existing = await this.getSport(sportId);
    if (!existing) {
      throw new Error(`Sport not found: ${sportId}`);
    }
    
    const updated = { ...existing, ...updates };
    await this.saveSport(updated);
    
    const saved = await this.getSport(sportId);
    if (!saved) {
      throw new Error('Failed to update sport');
    }
    
    return saved;
  }

  /**
   * Delete a sport
   */
  async deleteSport(sportId: string): Promise<void> {
    await this.deleteById(schema.sports, sportId);
  }
}

