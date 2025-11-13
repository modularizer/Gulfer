/**
 * Event Format Service
 * 
 * Object-oriented service for managing event formats.
 * Event formats define the structure and rules for events (e.g., "18-hole golf", "best-of-3 tennis").
 */

import { BaseService } from './base';
import type { Database } from '@services/storage/db';
import { eq, and, like } from 'drizzle-orm';
import * as schema from '../tables';
import type { EventFormat, Sport, ScoreFormat } from '../tables';
import { upsertEntity } from '../query-builders';
import { generateUUID } from '@/utils/uuid';
import { SportService } from './sport-service';
import { ScoreFormatService } from './score-format-service';

export class EventFormatService extends BaseService {
  /**
   * Get an event format by ID
   */
  async getEventFormat(eventFormatId: string): Promise<EventFormat | null> {
    return await this.getById<EventFormat>(schema.eventFormats, eventFormatId);
  }

  /**
   * Get multiple event formats by IDs
   */
  async getEventFormats(eventFormatIds: string[]): Promise<EventFormat[]> {
    return await this.getByIds<EventFormat>(schema.eventFormats, eventFormatIds);
  }

  /**
   * Get all event formats
   */
  async getAllEventFormats(): Promise<EventFormat[]> {
    return await this.getAll<EventFormat>(schema.eventFormats);
  }

  /**
   * Get event formats by sport
   */
  async getEventFormatsBySport(sportId: string): Promise<EventFormat[]> {
    return await this.getAll<EventFormat>(
      schema.eventFormats,
      eq(schema.eventFormats.sportId, sportId)
    );
  }

  /**
   * Get event formats by name (case-insensitive search)
   */
  async getEventFormatsByName(name: string): Promise<EventFormat[]> {
    return await this.getAll<EventFormat>(
      schema.eventFormats,
      like(schema.eventFormats.name, `%${name}%`)
    );
  }

  /**
   * Create or update an event format
   */
  async saveEventFormat(eventFormat: Partial<EventFormat>): Promise<void> {
    await upsertEntity(this.db, schema.eventFormats, eventFormat);
  }

  /**
   * Create a new event format
   */
  async createEventFormat(
    eventFormat: Partial<EventFormat>,
    options: {
      sport?: Partial<Sport>;
      scoreFormat?: Partial<ScoreFormat>;
    } = {}
  ): Promise<EventFormat> {
    // Create sport if provided
    if (options.sport) {
      const sportService = new SportService(this.db);
      const sport = await sportService.createSport(options.sport);
      eventFormat.sportId = sport.id;
    }
    
    // Create score format if provided
    if (options.scoreFormat) {
      const scoreFormatService = new ScoreFormatService(this.db);
      const scoreFormat = await scoreFormatService.createScoreFormat(options.scoreFormat);
      eventFormat.scoreFormatId = scoreFormat.id;
    }
    
    const eventFormatData: Partial<EventFormat> = {
      id: eventFormat.id || generateUUID(),
      name: eventFormat.name || null,
      notes: eventFormat.notes || null,
      lat: eventFormat.lat ?? 0,
      lng: eventFormat.lng ?? 0,
      metadata: eventFormat.metadata || null,
      sportId: eventFormat.sportId || null,
      scoreFormatId: eventFormat.scoreFormatId || null,
    };
    
    await this.saveEventFormat(eventFormatData);
    
    const saved = await this.getEventFormat(eventFormatData.id!);
    if (!saved) {
      throw new Error('Failed to create event format');
    }
    
    return saved;
  }

  /**
   * Update an event format
   */
  async updateEventFormat(
    eventFormatId: string,
    updates: Partial<EventFormat>
  ): Promise<EventFormat> {
    const existing = await this.getEventFormat(eventFormatId);
    if (!existing) {
      throw new Error(`Event format not found: ${eventFormatId}`);
    }
    
    const updated = { ...existing, ...updates };
    await this.saveEventFormat(updated);
    
    const saved = await this.getEventFormat(eventFormatId);
    if (!saved) {
      throw new Error('Failed to update event format');
    }
    
    return saved;
  }

  /**
   * Delete an event format
   */
  async deleteEventFormat(eventFormatId: string): Promise<void> {
    await this.deleteById(schema.eventFormats, eventFormatId);
  }

  /**
   * Get the sport for an event format
   */
  async getSport(eventFormatId: string): Promise<Sport | null> {
    const eventFormat = await this.getEventFormat(eventFormatId);
    if (!eventFormat?.sportId) {
      return null;
    }
    
    const sportService = new SportService(this.db);
    return await sportService.getSport(eventFormat.sportId);
  }

  /**
   * Get the score format for an event format
   */
  async getScoreFormat(eventFormatId: string): Promise<ScoreFormat | null> {
    const eventFormat = await this.getEventFormat(eventFormatId);
    if (!eventFormat?.scoreFormatId) {
      return null;
    }
    
    const scoreFormatService = new ScoreFormatService(this.db);
    return await scoreFormatService.getScoreFormat(eventFormat.scoreFormatId);
  }
}

