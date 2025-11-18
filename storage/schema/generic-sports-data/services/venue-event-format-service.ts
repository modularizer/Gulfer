/**
 * Venue Event Format Service
 * 
 * Object-oriented service for managing venue event formats.
 * Venue event formats link venues to event formats, allowing venues to offer specific formats.
 * 
 * Venue event formats automatically mirror the stage structure of their event format,
 * but allow venue-specific metadata to be added to each stage.
 */

import { BaseService } from './base';
import { eq, and } from 'drizzle-orm';
import * as schema from '../tables';
import type { VenueEventFormat, Venue, EventFormat, VenueEventFormatStage, VenueEventFormatStageInsert } from '../tables';
import { upsertEntity } from '../query-builders';
import { queryStages, type StageWithDetails } from '../query-builders';
import { generateUUID } from '../../../../xp-deeby/xp-schema/xp-sql/utils/uuid';
import { VenueService } from './venue-service';
import { EventFormatService, type EventFormatWithDetails } from './event-format-service';

/**
 * Stage metadata input - allows adding venue-specific metadata to stages
 * Key is the eventFormatStageId, value is the metadata to merge/add
 */
export type StageMetadataInput = Record<string, Record<string, any> | null>;

/**
 * Venue event format with stages (mirrors event format structure)
 */
export type VenueEventFormatWithDetails = VenueEventFormat & {
  venue: Venue;
  eventFormat: EventFormatWithDetails;
  stages: StageWithDetails[];
};

export class VenueEventFormatService extends BaseService {
  /**
   * Get a venue event format by ID (without stages)
   */
  async getVenueEventFormat(venueEventFormatId: string): Promise<VenueEventFormat | null> {
    return await this.getById<VenueEventFormat>(schema.venueEventFormats, venueEventFormatId);
  }

  /**
   * Get a venue event format with all stages (mirrors event format structure)
   */
  async getVenueEventFormatWithStages(venueEventFormatId: string): Promise<VenueEventFormatWithDetails | null> {
    const venueEventFormat = await this.getVenueEventFormat(venueEventFormatId);
    if (!venueEventFormat) {
      return null;
    }

    // Get the venue (required - courses must always have a venue)
    if (!venueEventFormat.venueId) {
      throw new Error(`Venue event format must have a venueId. Data: ${JSON.stringify(venueEventFormat)}`);
    }
    
    if (!venueEventFormat.eventFormatId) {
      throw new Error(`Venue event format must have an eventFormatId. Data: ${JSON.stringify(venueEventFormat)}`);
    }
    
    // Fetch venue directly from database to avoid query builder issues
    const venueResult = await this.db
      .select()
      .from(schema.venues)
      .where(eq(schema.venues.id, venueEventFormat.venueId))
      .limit(1);
    
    if (venueResult.length === 0) {
      throw new Error(`Venue not found: ${venueEventFormat.venueId}`);
    }
    
    const venue = venueResult[0];

    // Get the event format with its stages
    const eventFormatService = new EventFormatService(this.db);
    const eventFormatWithStages = await eventFormatService.getEventFormatWithStages(venueEventFormat.eventFormatId);
    if (!eventFormatWithStages) {
      return null;
    }

    // Get venue-specific stages
    const stages = await queryStages(this.db)
      .forVenueEventFormat(venueEventFormatId)
      .execute();

    // Debug: Log stage counts
    console.log(`[getVenueEventFormatWithStages] Retrieved ${stages.length} root stages for venueEventFormatId: ${venueEventFormatId}`);
    
    // Flatten to count all stages (including nested)
    const flattenForCount = (stages: StageWithDetails[]): number => {
      let count = stages.length;
      for (const stage of stages) {
        if (stage.subStages && stage.subStages.length > 0) {
          count += flattenForCount(stage.subStages);
        }
      }
      return count;
    };
    const totalStageCount = flattenForCount(stages);
    console.log(`[getVenueEventFormatWithStages] Total stages (including nested): ${totalStageCount}`);
    console.log(`[getVenueEventFormatWithStages] Stage numbers:`, stages.map(s => 
      s.venueEventFormatStage?.number ?? s.eventFormatStage?.number ?? '?'
    ).sort((a, b) => (a as number) - (b as number)));

    const result: VenueEventFormatWithDetails = {
      ...venueEventFormat,
      venue,
      eventFormat: eventFormatWithStages,
      stages,
    };
    
    // Ensure venue is set (should never be null/undefined for courses)
    if (!result.venue) {
      throw new Error(`Venue is missing in VenueEventFormatWithDetails for venueEventFormatId: ${venueEventFormatId}`);
    }
    
    return result;
  }

  /**
   * Get multiple venue event formats by IDs
   */
  async getVenueEventFormats(venueEventFormatIds: string[]): Promise<VenueEventFormat[]> {
    return await this.getByIds<VenueEventFormat>(schema.venueEventFormats, venueEventFormatIds);
  }

  /**
   * Get all venue event formats
   */
  async getAllVenueEventFormats(): Promise<VenueEventFormat[]> {
    return await this.getAll<VenueEventFormat>(schema.venueEventFormats);
  }

  /**
   * Get venue event formats by venue
   */
  async getVenueEventFormatsByVenue(venueId: string): Promise<VenueEventFormat[]> {
    return await this.getAll<VenueEventFormat>(
      schema.venueEventFormats,
      eq(schema.venueEventFormats.venueId, venueId)
    );
  }

  /**
   * Get venue event formats by event format
   */
  async getVenueEventFormatsByEventFormat(eventFormatId: string): Promise<VenueEventFormat[]> {
    return await this.getAll<VenueEventFormat>(
      schema.venueEventFormats,
      eq(schema.venueEventFormats.eventFormatId, eventFormatId)
    );
  }

  /**
   * Get venue event format for a specific venue and event format combination
   */
  async getVenueEventFormatByVenueAndFormat(
    venueId: string,
    eventFormatId: string
  ): Promise<VenueEventFormat | null> {
    const results = await this.db
      .select()
      .from(schema.venueEventFormats)
      .where(
        and(
          eq(schema.venueEventFormats.venueId, venueId),
          eq(schema.venueEventFormats.eventFormatId, eventFormatId)
        )
      )
      .limit(1);
    
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Create or update a venue event format
   */
  async saveVenueEventFormat(venueEventFormat: Partial<VenueEventFormat>): Promise<void> {
    await upsertEntity(this.db, schema.venueEventFormats, venueEventFormat, { id: venueEventFormat.id });
  }

  /**
   * Recursively create venueEventFormatStages that mirror eventFormatStages
   */
  private async createVenueStagesFromEventStages(
    venueEventFormatId: string,
    eventFormatStages: StageWithDetails[],
    stageMetadata?: StageMetadataInput,
    parentId: string | null = null
  ): Promise<void> {
    for (const eventStage of eventFormatStages) {
      if (!eventStage.eventFormatStage) {
        continue;
      }

      const eventFormatStageId = eventStage.eventFormatStage.id;
      const metadata = stageMetadata?.[eventFormatStageId] || null;
      
      // Merge metadata: start with eventFormatStage metadata, then overlay venue-specific metadata
      const mergedMetadata = eventStage.eventFormatStage.metadata
        ? { ...eventStage.eventFormatStage.metadata, ...(metadata || {}) }
        : metadata;

      const venueEventFormatStage: Partial<VenueEventFormatStageInsert> = {
        id: generateUUID(),
        name: eventStage.eventFormatStage.name,
        notes: eventStage.eventFormatStage.notes,
        lat: eventStage.eventFormatStage.lat,
        lng: eventStage.eventFormatStage.lng,
        metadata: mergedMetadata,
        venueEventFormatId,
        eventFormatStageId,
        number: eventStage.eventFormatStage.number,
        parentId,
      };

      // Build condition - check by name first, then by composite key
      let condition: Record<string, any> = {};
      if (venueEventFormatStage.name != null && venueEventFormatStage.name !== '') {
        condition = { name: venueEventFormatStage.name };
      } else if (venueEventFormatStage.venueEventFormatId !== undefined && venueEventFormatStage.number !== undefined) {
        condition = {
          venueEventFormatId: venueEventFormatStage.venueEventFormatId,
          parentId: venueEventFormatStage.parentId ?? null,
          number: venueEventFormatStage.number,
        };
      }
      
      await upsertEntity(this.db, schema.venueEventFormatStages, venueEventFormatStage, condition);

      // Recursively create sub-stages
      if (eventStage.subStages.length > 0) {
        await this.createVenueStagesFromEventStages(
          venueEventFormatId,
          eventStage.subStages,
          stageMetadata,
          venueEventFormatStage.id!
        );
      }
    }
  }

  /**
   * Create a new venue event format with stages automatically mirrored from the event format
   * This is the primary method for creating venue event formats
   */
  async createVenueEventFormatWithStages(
    venueEventFormat: Partial<VenueEventFormat>,
    stageMetadata?: StageMetadataInput,
    options: {
      venue?: Partial<Venue>;
      eventFormat?: Partial<EventFormat>;
    } = {}
  ): Promise<VenueEventFormatWithDetails> {
    // Create venue if provided
    if (options.venue) {
      const venueService = new VenueService(this.db);
      const venue = await venueService.createVenue(options.venue);
      venueEventFormat.venueId = venue.venue.id;
    }
    
    // Create event format if provided
    if (options.eventFormat) {
      const eventFormatService = new EventFormatService(this.db);
      const eventFormat = await eventFormatService.createEventFormat(options.eventFormat);
      venueEventFormat.eventFormatId = eventFormat.id;
    }
    
    if (!venueEventFormat.venueId || !venueEventFormat.eventFormatId) {
      throw new Error('Venue event format must have both venueId and eventFormatId');
    }

    // Get the event format with its stages
    const eventFormatService = new EventFormatService(this.db);
    const eventFormatWithStages = await eventFormatService.getEventFormatWithStages(venueEventFormat.eventFormatId);
    if (!eventFormatWithStages) {
      throw new Error(`Event format not found: ${venueEventFormat.eventFormatId}`);
    }
    
    const venueEventFormatId = venueEventFormat.id || generateUUID();
    
    // Use provided values or fall back to eventFormat defaults
    const venueEventFormatData: Partial<VenueEventFormat> = {
      id: venueEventFormatId,
      name: venueEventFormat.name || null,
      notes: venueEventFormat.notes || null,
      lat: venueEventFormat.lat ?? null,
      lng: venueEventFormat.lng ?? null,
      metadata: venueEventFormat.metadata || null,
      venueId: venueEventFormat.venueId,
      eventFormatId: venueEventFormat.eventFormatId,
      // Override fields: use provided value if specified, otherwise use eventFormat default
      minTeamSize: venueEventFormat.minTeamSize ?? eventFormatWithStages.minTeamSize ?? null,
      maxTeamSize: venueEventFormat.maxTeamSize ?? eventFormatWithStages.maxTeamSize ?? null,
      minTeams: venueEventFormat.minTeams ?? eventFormatWithStages.minTeams ?? null,
      maxTeams: venueEventFormat.maxTeams ?? eventFormatWithStages.maxTeams ?? null,
      expectedMinDuration: venueEventFormat.expectedMinDuration ?? eventFormatWithStages.expectedMinDuration ?? null,
      expectedDuration: venueEventFormat.expectedDuration ?? eventFormatWithStages.expectedDuration ?? null,
      expectedMaxDuration: venueEventFormat.expectedMaxDuration ?? eventFormatWithStages.expectedMaxDuration ?? null,
    };
    
    // Verify venueId and eventFormatId are set before saving
    if (!venueEventFormatData.venueId) {
      throw new Error(`Cannot save venue event format: venueId is missing. Data: ${JSON.stringify(venueEventFormatData)}`);
    }
    if (!venueEventFormatData.eventFormatId) {
      throw new Error(`Cannot save venue event format: eventFormatId is missing. Data: ${JSON.stringify(venueEventFormatData)}`);
    }
    
    try {
      await this.saveVenueEventFormat(venueEventFormatData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to save venue event format: ${errorMessage}. Data: ${JSON.stringify(venueEventFormatData)}`);
    }
    
    // Verify it was saved correctly
    const savedCheck = await this.getVenueEventFormat(venueEventFormatId);
    if (!savedCheck) {
      throw new Error(`Venue event format was saved but could not be retrieved. ID: ${venueEventFormatId}`);
    }
    
    if (!savedCheck.venueId) {
      throw new Error(`Venue event format was saved but venueId is missing. Saved data: ${JSON.stringify(savedCheck)}`);
    }
    if (!savedCheck.eventFormatId) {
      throw new Error(`Venue event format was saved but eventFormatId is missing. Saved data: ${JSON.stringify(savedCheck)}`);
    }
    
    // Create venueEventFormatStages that mirror the eventFormatStages structure
    await this.createVenueStagesFromEventStages(
      venueEventFormatId,
      eventFormatWithStages.stages,
      stageMetadata
    );
    
    // Use getVenueEventFormatWithStages to ensure all data is properly loaded
    const result = await this.getVenueEventFormatWithStages(venueEventFormatId);
    if (!result) {
      // Try to get raw data to see what happened
      let rawData: any[] = [];
      try {
        rawData = await this.db
          .select()
          .from(schema.venueEventFormats)
          .where(eq(schema.venueEventFormats.id, venueEventFormatId))
          .limit(1);
      } catch (rawError) {
        // Ignore - we'll just report the main error
      }
      
      const debugInfo = rawData.length > 0 
        ? `Venue event format was saved but could not be retrieved. Raw data: ${JSON.stringify(rawData[0])}`
        : `Venue event format was not saved or could not be retrieved. Check SQL error above.`;
      
      throw new Error(`Failed to create venue event format with stages: ${debugInfo}`);
    }
    
    return result;
  }

  /**
   * Create a new venue event format (without automatically creating stages)
   */
  async createVenueEventFormat(
    venueEventFormat: Partial<VenueEventFormat>,
    options: {
      venue?: Partial<Venue>;
      eventFormat?: Partial<EventFormat>;
    } = {}
  ): Promise<VenueEventFormat> {
    // Create venue if provided
    if (options.venue) {
      const venueService = new VenueService(this.db);
      const venue = await venueService.createVenue(options.venue);
      venueEventFormat.venueId = venue.venue.id;
    }
    
    // Create event format if provided
    if (options.eventFormat) {
      const eventFormatService = new EventFormatService(this.db);
      const eventFormat = await eventFormatService.createEventFormat(options.eventFormat);
      venueEventFormat.eventFormatId = eventFormat.id;
    }
    
    if (!venueEventFormat.venueId || !venueEventFormat.eventFormatId) {
      throw new Error('Venue event format must have both venueId and eventFormatId');
    }
    
    // Get the event format to use as defaults
    const eventFormatService = new EventFormatService(this.db);
    const eventFormat = await eventFormatService.getEventFormat(venueEventFormat.eventFormatId);
    if (!eventFormat) {
      throw new Error(`Event format not found: ${venueEventFormat.eventFormatId}`);
    }
    
    const venueEventFormatData: Partial<VenueEventFormat> = {
      id: venueEventFormat.id || generateUUID(),
      name: venueEventFormat.name || null,
      notes: venueEventFormat.notes || null,
      lat: venueEventFormat.lat ?? null,
      lng: venueEventFormat.lng ?? null,
      metadata: venueEventFormat.metadata || null,
      venueId: venueEventFormat.venueId,
      eventFormatId: venueEventFormat.eventFormatId,
      // Override fields: use provided value if specified, otherwise use eventFormat default
      minTeamSize: venueEventFormat.minTeamSize ?? eventFormat.minTeamSize ?? null,
      maxTeamSize: venueEventFormat.maxTeamSize ?? eventFormat.maxTeamSize ?? null,
      minTeams: venueEventFormat.minTeams ?? eventFormat.minTeams ?? null,
      maxTeams: venueEventFormat.maxTeams ?? eventFormat.maxTeams ?? null,
      expectedMinDuration: venueEventFormat.expectedMinDuration ?? eventFormat.expectedMinDuration ?? null,
      expectedDuration: venueEventFormat.expectedDuration ?? eventFormat.expectedDuration ?? null,
      expectedMaxDuration: venueEventFormat.expectedMaxDuration ?? eventFormat.expectedMaxDuration ?? null,
    };
    
    try {
      await this.saveVenueEventFormat(venueEventFormatData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create venue event format: ${errorMessage}`);
    }
    
    const saved = await this.getVenueEventFormat(venueEventFormatData.id!);
    if (!saved) {
      // Try to get raw data to see what happened
      let rawData: any[] = [];
      try {
        rawData = await this.db
          .select()
          .from(schema.venueEventFormats)
          .where(eq(schema.venueEventFormats.id, venueEventFormatData.id!))
          .limit(1);
      } catch (rawError) {
        // Ignore - we'll just report the main error
      }
      
      const debugInfo = rawData.length > 0 
        ? `Venue event format was saved but could not be retrieved. Raw data: ${JSON.stringify(rawData[0])}`
        : `Venue event format was not saved or could not be retrieved. Check SQL error above.`;
      
      throw new Error(`Failed to create venue event format: ${debugInfo}`);
    }
    
    return saved;
  }

  /**
   * Update stage metadata for a venue event format
   * This will update the metadata for existing stages or create missing stages
   */
  async updateVenueEventFormatStageMetadata(
    venueEventFormatId: string,
    stageMetadata: StageMetadataInput
  ): Promise<VenueEventFormatWithDetails> {
    const venueEventFormat = await this.getVenueEventFormat(venueEventFormatId);
    if (!venueEventFormat) {
      throw new Error(`Venue event format not found: ${venueEventFormatId}`);
    }

    // Get the event format with its stages
    const eventFormatService = new EventFormatService(this.db);
    const eventFormatWithStages = await eventFormatService.getEventFormatWithStages(venueEventFormat.eventFormatId);
    if (!eventFormatWithStages) {
      throw new Error(`Event format not found: ${venueEventFormat.eventFormatId}`);
    }

    // Get existing venue stages
    const existingStages = await queryStages(this.db)
      .forVenueEventFormat(venueEventFormatId)
      .execute();

    // Create a map of existing venue stages by eventFormatStageId
    const existingStageMap = new Map<string, VenueEventFormatStage>();
    const collectStages = (stages: StageWithDetails[]) => {
      for (const stage of stages) {
        if (stage.venueEventFormatStage && stage.eventFormatStage) {
          existingStageMap.set(stage.eventFormatStage.id, stage.venueEventFormatStage);
        }
        if (stage.subStages.length > 0) {
          collectStages(stage.subStages);
        }
      }
    };
    collectStages(existingStages);

    // Update or create stages
    const updateStages = async (eventStages: StageWithDetails[], parentId: string | null = null) => {
      for (const eventStage of eventStages) {
        if (!eventStage.eventFormatStage) {
          continue;
        }

        const eventFormatStageId = eventStage.eventFormatStage.id;
        const metadata = stageMetadata[eventFormatStageId];
        
        if (metadata !== undefined) {
          const existing = existingStageMap.get(eventFormatStageId);
          
          if (existing) {
            // Update existing stage metadata
            const mergedMetadata = existing.metadata
              ? { ...existing.metadata, ...(metadata || {}) }
              : metadata;
            
            const updatedStage = {
              ...existing,
              metadata: mergedMetadata,
            } as Partial<VenueEventFormatStageInsert>;
            // Build condition - check by name first, then by composite key
            let condition: Record<string, any> = {};
            if (updatedStage.name != null && updatedStage.name !== '') {
              condition = { name: updatedStage.name };
            } else if (updatedStage.venueEventFormatId !== undefined && updatedStage.number !== undefined) {
              condition = {
                venueEventFormatId: updatedStage.venueEventFormatId,
                parentId: updatedStage.parentId ?? null,
                number: updatedStage.number,
              };
            }
            await upsertEntity(this.db, schema.venueEventFormatStages, updatedStage, condition);
          } else {
            // Create new stage if it doesn't exist
            const mergedMetadata = eventStage.eventFormatStage.metadata
              ? { ...eventStage.eventFormatStage.metadata, ...(metadata || {}) }
              : metadata;

            const newStage = {
              id: generateUUID(),
              name: eventStage.eventFormatStage.name,
              notes: eventStage.eventFormatStage.notes,
              lat: eventStage.eventFormatStage.lat,
              lng: eventStage.eventFormatStage.lng,
              metadata: mergedMetadata,
              venueEventFormatId,
              eventFormatStageId,
              number: eventStage.eventFormatStage.number,
              parentId,
            } as Partial<VenueEventFormatStageInsert>;
            // Build condition - check by name first, then by composite key
            let condition: Record<string, any> = {};
            if (newStage.name != null && newStage.name !== '') {
              condition = { name: newStage.name };
            } else if (newStage.venueEventFormatId !== undefined && newStage.number !== undefined) {
              condition = {
                venueEventFormatId: newStage.venueEventFormatId,
                parentId: newStage.parentId ?? null,
                number: newStage.number,
              };
            }
            await upsertEntity(this.db, schema.venueEventFormatStages, newStage, condition);
          }
        }

        // Recursively update sub-stages
        if (eventStage.subStages.length > 0) {
          const currentParentId = existingStageMap.get(eventFormatStageId)?.id || null;
          await updateStages(eventStage.subStages, currentParentId);
        }
      }
    };

    await updateStages(eventFormatWithStages.stages);

    const result = await this.getVenueEventFormatWithStages(venueEventFormatId);
    if (!result) {
      throw new Error('Failed to update venue event format stage metadata');
    }

    return result;
  }

  /**
   * Update a venue event format (without stages)
   */
  async updateVenueEventFormat(
    venueEventFormatId: string,
    updates: Partial<VenueEventFormat>
  ): Promise<VenueEventFormat> {
    const existing = await this.getVenueEventFormat(venueEventFormatId);
    if (!existing) {
      throw new Error(`Venue event format not found: ${venueEventFormatId}`);
    }
    
    const updated = { ...existing, ...updates };
    await this.saveVenueEventFormat(updated);
    
    const saved = await this.getVenueEventFormat(venueEventFormatId);
    if (!saved) {
      throw new Error('Failed to update venue event format');
    }
    
    return saved;
  }

  /**
   * Delete a venue event format
   */
  async deleteVenueEventFormat(venueEventFormatId: string): Promise<void> {
    await this.deleteById(schema.venueEventFormats, venueEventFormatId);
  }

  /**
   * Get the venue for a venue event format
   */
  async getVenue(venueEventFormatId: string): Promise<Venue | null> {
    const venueEventFormat = await this.getVenueEventFormat(venueEventFormatId);
    if (!venueEventFormat?.venueId) {
      return null;
    }
    
    const venueService = new VenueService(this.db);
    const venue = await venueService.getVenue(venueEventFormat.venueId);
    return venue?.venue || null;
  }

  /**
   * Get the event format for a venue event format
   */
  async getEventFormat(venueEventFormatId: string): Promise<EventFormat | null> {
    const venueEventFormat = await this.getVenueEventFormat(venueEventFormatId);
    if (!venueEventFormat?.eventFormatId) {
      return null;
    }
    
    const eventFormatService = new EventFormatService(this.db);
    return await eventFormatService.getEventFormat(venueEventFormat.eventFormatId);
  }
}

