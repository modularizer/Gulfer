/**
 * Score Format Service
 * 
 * Object-oriented service for managing score formats.
 * Score formats define how scores are structured and calculated (e.g., stroke play, match play).
 */

import { BaseTableService } from './base-table-service';
import { eq, like } from 'drizzle-orm';
import * as schema from '../tables';
import type { ScoreFormat } from '../tables';
import { upsertEntity } from '../query-builders';
import { generateUUID } from '@utils/uuid';

export class ScoreFormatService extends BaseTableService<ScoreFormat> {
  protected getTableName(): string {
    return 'score_formats';
  }

  protected getTable(): any {
    return schema.scoreFormats;
  }
  /**
   * Get a score format by ID
   */
  async getScoreFormat(scoreFormatId: string): Promise<ScoreFormat | null> {
    return await this.getById<ScoreFormat>(schema.scoreFormats, scoreFormatId);
  }

  /**
   * Get multiple score formats by IDs
   */
  async getScoreFormats(scoreFormatIds: string[]): Promise<ScoreFormat[]> {
    return await this.getByIds<ScoreFormat>(schema.scoreFormats, scoreFormatIds);
  }

  /**
   * Get all score formats
   */
  async getAllScoreFormats(): Promise<ScoreFormat[]> {
    return await this.getAll<ScoreFormat>(schema.scoreFormats);
  }

  /**
   * Get score formats by name (case-insensitive search)
   */
  async getScoreFormatsByName(name: string): Promise<ScoreFormat[]> {
    return await this.getAll<ScoreFormat>(
      schema.scoreFormats,
      like(schema.scoreFormats.name, `%${name}%`)
    );
  }

  /**
   * Get score formats by scoring method name
   */
  async getScoreFormatsByScoringMethod(scoringMethodName: string): Promise<ScoreFormat[]> {
    return await this.getAll<ScoreFormat>(
      schema.scoreFormats,
      eq(schema.scoreFormats.scoringMethodName, scoringMethodName)
    );
  }

  /**
   * Create or update a score format
   */
  async saveScoreFormat(scoreFormat: Partial<ScoreFormat>): Promise<void> {
    const condition: Record<string, any> = {};
    if (scoreFormat.name) condition.name = scoreFormat.name;
    if (scoreFormat.sportId) condition.sportId = scoreFormat.sportId;
    if (scoreFormat.scoringMethodName) condition.scoringMethodName = scoreFormat.scoringMethodName;
    await upsertEntity(this.db, schema.scoreFormats, scoreFormat, condition);
  }

  /**
   * Create a new score format
   */
  async createScoreFormat(scoreFormat: Partial<ScoreFormat>): Promise<ScoreFormat> {
    const scoreFormatData: Partial<ScoreFormat> = {
      id: scoreFormat.id || generateUUID(),
      name: scoreFormat.name || null,
      notes: scoreFormat.notes || null,
      lat: scoreFormat.lat ?? null,
      lng: scoreFormat.lng ?? null,
      metadata: scoreFormat.metadata || null,
      sportId: scoreFormat.sportId || null,
      scoringMethodName: scoreFormat.scoringMethodName!,
    };
    
    await this.saveScoreFormat(scoreFormatData);
    
    const saved = await this.getScoreFormat(scoreFormatData.id!);
    if (!saved) {
      throw new Error('Failed to create score format');
    }
    
    return saved;
  }

  /**
   * Update a score format
   */
  async updateScoreFormat(scoreFormatId: string, updates: Partial<ScoreFormat>): Promise<ScoreFormat> {
    const existing = await this.getScoreFormat(scoreFormatId);
    if (!existing) {
      throw new Error(`Score format not found: ${scoreFormatId}`);
    }
    
    const updated = { ...existing, ...updates };
    await this.saveScoreFormat(updated);
    
    const saved = await this.getScoreFormat(scoreFormatId);
    if (!saved) {
      throw new Error('Failed to update score format');
    }
    
    return saved;
  }

  /**
   * Delete a score format
   */
  async deleteScoreFormat(scoreFormatId: string): Promise<void> {
    await this.deleteById(schema.scoreFormats, scoreFormatId);
  }
}

