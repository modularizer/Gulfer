/**
 * Sport Service
 * 
 * Object-oriented service for managing sports.
 * Provides high-level methods for sport operations.
 */

import { BaseTableService } from './base-table-service';
import { like, eq } from 'drizzle-orm';
import {schema} from '../tables';
import type { Sport } from '../tables';
import { generateUUID } from '../../../../xp-deeby/utils';

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
      await schema.sports.using(this.db).upsertWhere(sport, 'name');
  }

  /**
   * Create a new sport
   */
  async createSport(sport: Partial<Sport>): Promise<Sport> {
    // Check if a sport with this name already exists
    if (sport.name) {
      const existing = await this.getAllSports();
      const found = existing.find(s => s.name?.toLowerCase() === sport.name!.toLowerCase());
      if (found) {
        // Sport already exists - update it instead
        return await this.updateSport(found.id, {
          name: sport.name,
          notes: sport.notes ?? found.notes,
          lat: sport.lat ?? found.lat,
          lng: sport.lng ?? found.lng,
          metadata: sport.metadata ?? found.metadata,
        });
      }
    }
    
    // No existing sport found - create new one
    const sportData: Partial<Sport> = {
      id: sport.id || generateUUID(),
      name: sport.name || null,
      notes: sport.notes || null,
      lat: sport.lat ?? null,
      lng: sport.lng ?? null,
      metadata: sport.metadata || null,
    };
    
    // Direct insert to avoid condition-based upsert that might match existing records
    const table = this.getTable();
    await this.db.insert(table).values(sportData);
    
    // Retrieve the inserted sport - this must work or there's a fundamental problem
    const saved = await this.getSport(sportData.id!);
    
    if (!saved) {
      // Query failed - investigate why
      const directQuery = await this.db
        .select()
        .from(table)
        .where(eq(table.id, sportData.id!))
        .limit(1);
      
      const allSports = await this.getAllSports();
      
      throw new Error(
        `Failed to create sport: could not retrieve sport with id ${sportData.id} after insert. ` +
        `Direct query returned ${directQuery.length} result(s). ` +
        `Direct query result: ${JSON.stringify(directQuery, null, 2)}. ` +
        `Total sports in database: ${allSports.length}. ` +
        `All sports IDs: ${allSports.map(s => s.id).join(', ')}`
      );
    }
    
    // Verify the saved sport has an ID
    if (!saved.id) {
      const savedKeys = Object.keys(saved);
      throw new Error(
        `Failed to create sport: retrieved sport does not have an ID. ` +
        `Expected ID: ${sportData.id}, ` +
        `Retrieved keys: ${savedKeys.join(', ')}, ` +
        `Retrieved object: ${JSON.stringify(saved, null, 2)}`
      );
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
    
    if (!existing.id) {
      throw new Error(`Existing sport does not have an ID: ${JSON.stringify(existing, null, 2)}`);
    }
    
    const updated = { ...existing, ...updates };
    await this.saveSport(updated);
    
    const saved = await this.getSport(sportId);
    if (!saved) {
      throw new Error(`Failed to update sport: could not retrieve sport with id ${sportId} after update`);
    }
    
    // Verify the saved sport has an ID
    if (!saved.id) {
      const savedKeys = Object.keys(saved);
      throw new Error(
        `Failed to update sport: retrieved sport does not have an ID. ` +
        `Expected ID: ${sportId}, ` +
        `Retrieved keys: ${savedKeys.join(', ')}, ` +
        `Retrieved object: ${JSON.stringify(saved, null, 2)}`
      );
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

