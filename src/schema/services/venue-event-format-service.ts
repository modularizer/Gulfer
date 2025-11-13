/**
 * Venue Event Format Service
 * 
 * Object-oriented service for managing venue event formats.
 * Venue event formats link venues to event formats, allowing venues to offer specific formats.
 */

import { BaseService } from './base';
import type { Database } from '@services/storage/db';
import { eq, and } from 'drizzle-orm';
import * as schema from '../tables';
import type { VenueEventFormat, Venue, EventFormat } from '../tables';
import { upsertEntity } from '../query-builders';
import { generateUUID } from '@/utils/uuid';
import { VenueService } from './venue-service';
import { EventFormatService } from './event-format-service';

export class VenueEventFormatService extends BaseService {
  /**
   * Get a venue event format by ID
   */
  async getVenueEventFormat(venueEventFormatId: string): Promise<VenueEventFormat | null> {
    return await this.getById<VenueEventFormat>(schema.venueEventFormats, venueEventFormatId);
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
    await upsertEntity(this.db, schema.venueEventFormats, venueEventFormat);
  }

  /**
   * Create a new venue event format
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
    
    const venueEventFormatData: Partial<VenueEventFormat> = {
      id: venueEventFormat.id || generateUUID(),
      name: venueEventFormat.name || null,
      notes: venueEventFormat.notes || null,
      lat: venueEventFormat.lat ?? 0,
      lng: venueEventFormat.lng ?? 0,
      metadata: venueEventFormat.metadata || null,
      venueId: venueEventFormat.venueId,
      eventFormatId: venueEventFormat.eventFormatId,
    };
    
    await this.saveVenueEventFormat(venueEventFormatData);
    
    const saved = await this.getVenueEventFormat(venueEventFormatData.id!);
    if (!saved) {
      throw new Error('Failed to create venue event format');
    }
    
    return saved;
  }

  /**
   * Update a venue event format
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

