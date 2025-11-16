/**
 * Event Format Service
 * 
 * Object-oriented service for managing event formats.
 * Event formats define the structure and rules for events (e.g., "18-hole golf", "best-of-3 tennis").
 * 
 * Event formats include recursive stages, which are the core structure (e.g., holes for golf, sets/games for tennis).
 */

import { BaseTableService } from './base-table-service';
import { eq, like } from 'drizzle-orm';
import * as schema from '../tables';
import type { EventFormat, Sport, ScoreFormat, EventFormatStage} from '../tables';
import { upsertEntity } from '../query-builders';
import { queryStages, upsertStagesWithDetails, type StageWithDetails } from '../query-builders';
import { generateUUID } from '../../../../xp-deeby/utils/uuid';
import { SportService } from './sport-service';
import { ScoreFormatService } from './score-format-service';

/**
 * Event format with recursive stages
 */
export type EventFormatWithDetails = EventFormat & {
  stages: StageWithDetails[];
};

/**
 * Simplified stage input type for creating event formats
 */
export type StageInput = {
  number?: number;
  name?: string | null;
  notes?: string | null;
  metadata?: Record<string, any> | null;
  stages?: StageInput[]; // Recursive substages
};

export class EventFormatService extends BaseTableService<EventFormat> {
  protected getTableName(): string {
    return 'event_formats';
  }

  protected getTable(): any {
    return schema.eventFormats;
  }
  /**
   * Get an event format by ID (without stages)
   */
  async getEventFormat(eventFormatId: string): Promise<EventFormat | null> {
    return await this.getById<EventFormat>(schema.eventFormats, eventFormatId);
  }

  /**
   * Get an event format with all recursive stages
   */
  async getEventFormatWithStages(eventFormatId: string): Promise<EventFormatWithDetails | null> {
    const eventFormat = await this.getEventFormat(eventFormatId);
    if (!eventFormat) {
      return null;
    }

    const stages = await queryStages(this.db)
      .forEventFormat(eventFormatId)
      .execute();

    return {
      ...eventFormat,
      stages,
    };
  }

  /**
   * Get multiple event formats by IDs (without stages)
   */
  async getEventFormats(eventFormatIds: string[]): Promise<EventFormat[]> {
    return await this.getByIds<EventFormat>(schema.eventFormats, eventFormatIds);
  }

  /**
   * Get multiple event formats with stages
   */
  async getEventFormatsWithStages(eventFormatIds: string[]): Promise<EventFormatWithDetails[]> {
    const eventFormats = await this.getEventFormats(eventFormatIds);
    const results: EventFormatWithDetails[] = [];

    for (const eventFormat of eventFormats) {
      const stages = await queryStages(this.db)
        .forEventFormat(eventFormat.id)
        .execute();
      
      results.push({
        ...eventFormat,
        stages,
      });
    }

    return results;
  }

  /**
   * Get all event formats
   */
  async getAllEventFormats(): Promise<EventFormat[]> {
    return await this.getAll<EventFormat>(schema.eventFormats);
  }

  /**
   * Get event formats by sport (without stages)
   */
  async getEventFormatsBySport(sportId: string): Promise<EventFormat[]> {
    return await this.getAll<EventFormat>(
      schema.eventFormats,
      eq(schema.eventFormats.sportId, sportId)
    );
  }

  /**
   * Get event formats by sport with stages
   */
  async getEventFormatsBySportWithStages(sportId: string): Promise<EventFormatWithDetails[]> {
    const eventFormats = await this.getEventFormatsBySport(sportId);
    const results: EventFormatWithDetails[] = [];

    for (const eventFormat of eventFormats) {
      const stages = await queryStages(this.db)
        .forEventFormat(eventFormat.id)
        .execute();
      
      results.push({
        ...eventFormat,
        stages,
      });
    }

    return results;
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
    await upsertEntity(this.db, schema.eventFormats, eventFormat, {
      name: eventFormat.name,
      sportId: eventFormat.sportId,
    });
  }

  /**
   * Convert StageInput to StageWithDetails for upsert
   */
  private convertStageInputToStageWithDetails(
    stageInput: StageInput,
    eventFormatId: string,
    scoreFormatId: string,
    parentId: string | null = null
  ): StageWithDetails {
    const stageId = generateUUID();
    const eventFormatStage: EventFormatStage = {
      id: stageId,
      name: stageInput.name || null,
      notes: stageInput.notes || null,
      lat: null,
      lng: null,
      eventFormatId,
      scoreFormatId,
      number: stageInput.number ?? 0,
      parentId,
      metadata: stageInput.metadata || null,
    };

    const subStages = (stageInput.stages || []).map(subStage =>
      this.convertStageInputToStageWithDetails(subStage, eventFormatId, scoreFormatId, stageId)
    );

    return {
      eventFormatStage,
      scores: [],
      subStages,
    };
  }

  /**
   * Create a new event format with stages
   * This is the primary method for registering event formats with their stage structure
   */
  async createEventFormatWithStages(
    eventFormat: Partial<EventFormat>,
    stages: StageInput[],
    options: {
      sport?: Partial<Sport>;
      scoreFormat?: Partial<ScoreFormat>;
    } = {}
  ): Promise<EventFormatWithDetails> {
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
    
    if (!eventFormat.scoreFormatId) {
      throw new Error('scoreFormatId is required for event format with stages');
    }

    const eventFormatId = eventFormat.id || generateUUID();
    const eventFormatData: Partial<EventFormat> = {
      id: eventFormatId,
      name: eventFormat.name || null,
      notes: eventFormat.notes || null,
      lat: eventFormat.lat ?? null,
      lng: eventFormat.lng ?? null,
      metadata: eventFormat.metadata || null,
      sportId: eventFormat.sportId,
      scoreFormatId: eventFormat.scoreFormatId,
      minTeamSize: eventFormat.minTeamSize ?? null,
      maxTeamSize: eventFormat.maxTeamSize ?? null,
      minTeams: eventFormat.minTeams ?? null,
      maxTeams: eventFormat.maxTeams ?? null,
      expectedMinDuration: eventFormat.expectedMinDuration ?? null,
      expectedDuration: eventFormat.expectedDuration ?? null,
      expectedMaxDuration: eventFormat.expectedMaxDuration ?? null,
    };
    
    await this.saveEventFormat(eventFormatData);
    
    // Convert stage inputs to StageWithDetails and upsert recursively
    const stageDetails = stages.map(stageInput =>
      this.convertStageInputToStageWithDetails(
        stageInput,
        eventFormatId,
        eventFormat.scoreFormatId!,
        null // root level stages have no parent
      )
    );

    await upsertStagesWithDetails(this.db, stageDetails, null);
    
    const result = await this.getEventFormatWithStages(eventFormatId);
    if (!result) {
      throw new Error('Failed to create event format with stages');
    }
    
    return result;
  }

  /**
   * Create a new event format (without stages)
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
      lat: eventFormat.lat ?? null,
      lng: eventFormat.lng ?? null,
      metadata: eventFormat.metadata || null,
      sportId: eventFormat.sportId,
      scoreFormatId: eventFormat.scoreFormatId,
    };
    
    await this.saveEventFormat(eventFormatData);
    
    const saved = await this.getEventFormat(eventFormatData.id!);
    if (!saved) {
      throw new Error('Failed to create event format');
    }
    
    return saved;
  }

  /**
   * Update an event format with stages
   */
  async updateEventFormatWithStages(
    eventFormatId: string,
    updates: Partial<EventFormat>,
    stages?: StageInput[]
  ): Promise<EventFormatWithDetails> {
    const existing = await this.getEventFormat(eventFormatId);
    if (!existing) {
      throw new Error(`Event format not found: ${eventFormatId}`);
    }
    
    const updated = { ...existing, ...updates };
    await this.saveEventFormat(updated);
    
    // Update stages if provided
    if (stages !== undefined) {
      const scoreFormatId = updated.scoreFormatId || existing.scoreFormatId;
      if (!scoreFormatId) {
        throw new Error('scoreFormatId is required to update stages');
      }

      // Convert stage inputs to StageWithDetails and upsert recursively
      const stageDetails = stages.map(stageInput =>
        this.convertStageInputToStageWithDetails(
          stageInput,
          eventFormatId,
          scoreFormatId,
          null // root level stages have no parent
        )
      );

      await upsertStagesWithDetails(this.db, stageDetails, null);
    }
    
    const saved = await this.getEventFormatWithStages(eventFormatId);
    if (!saved) {
      throw new Error('Failed to update event format with stages');
    }
    
    return saved;
  }

  /**
   * Update an event format (without stages)
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

