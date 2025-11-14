/**
 * Event Service
 * 
 * Object-oriented service for managing events.
 * Provides high-level methods for event operations.
 */

import { BaseService } from './base';
import type { Database } from '../../../adapters';
import { queryEvents, upsertEventWithDetails, type EventWithDetails } from '../query-builders';
import { eq, and, inArray, gte, lte } from 'drizzle-orm';
import * as schema from '../tables';
import type { Event, Participant, Photo } from '../tables';
import { generateUUID } from '@utils/uuid';

export class EventService extends BaseService {
  /**
   * Get an event by ID with all related storage
   */
  async getEvent(eventId: string): Promise<EventWithDetails | null> {
    const events = await queryEvents(this.db)
      .withVenueAndFormat()
      .withParticipants()
      .withStages()
      .withPhotos()
      .where(eq(schema.events.id, eventId))
      .execute();
    
    return events.length > 0 ? events[0] : null;
  }

  /**
   * Get multiple events by IDs
   */
  async getEvents(eventIds: string[]): Promise<EventWithDetails[]> {
    if (eventIds.length === 0) return [];
    
    return await queryEvents(this.db)
      .withVenueAndFormat()
      .withParticipants()
      .withStages()
      .withPhotos()
      .where(inArray(schema.events.id, eventIds))
      .execute();
  }

  /**
   * Get all events
   */
  async getAllEvents(): Promise<EventWithDetails[]> {
    return await queryEvents(this.db)
      .withVenueAndFormat()
      .withParticipants()
      .withStages()
      .withPhotos()
      .execute();
  }

  /**
   * Get events by venue
   */
  async getEventsByVenue(venueId: string): Promise<EventWithDetails[]> {
    const venueEventFormats = await this.db
      .select()
      .from(schema.venueEventFormats)
      .where(eq(schema.venueEventFormats.venueId, venueId));
    
    const venueEventFormatIds = venueEventFormats.map(vef => vef.id);
    
    if (venueEventFormatIds.length === 0) return [];
    
    return await queryEvents(this.db)
      .withVenueAndFormat()
      .withParticipants()
      .withStages()
      .withPhotos()
      .where(inArray(schema.events.venueEventFormatId, venueEventFormatIds))
      .execute();
  }

  /**
   * Get active events
   */
  async getActiveEvents(): Promise<EventWithDetails[]> {
    return await queryEvents(this.db)
      .withVenueAndFormat()
      .withParticipants()
      .withStages()
      .withPhotos()
      .where(eq(schema.events.active, true))
      .execute();
  }

  /**
   * Get events by date range
   */
  async getEventsByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<EventWithDetails[]> {
    return await queryEvents(this.db)
      .withVenueAndFormat()
      .withParticipants()
      .withStages()
      .withPhotos()
      .where(
        and(
          gte(schema.events.startTime, startDate),
          lte(schema.events.endTime, endDate)
        )
      )
      .execute();
  }

  /**
   * Create or update an event
   */
  async saveEvent(event: EventWithDetails): Promise<void> {
    await upsertEventWithDetails(this.db, event);
  }

  /**
   * Create a new event
   */
  async createEvent(
    event: Partial<Event>,
    options: {
      participants?: Participant[];
      photos?: Photo[];
    } = {}
  ): Promise<EventWithDetails> {
    if (!event.venueEventFormatId) {
      throw new Error('Event must have a venueEventFormatId');
    }
    
    const eventData: EventWithDetails = {
      event: {
        id: event.id || generateUUID(),
        name: event.name || null,
        notes: event.notes || null,
        lat: event.lat ?? 0,
        lng: event.lng ?? 0,
        metadata: event.metadata || null,
        venueEventFormatId: event.venueEventFormatId,
        startTime: event.startTime || null,
        endTime: event.endTime || null,
        active: event.active ?? null,
      } as Event,
      venue: null,
      venueEventFormat: null,
      eventFormat: null,
      sport: null,
      scoreFormat: null,
      participants: options.participants || [],
      stages: [],
      photos: options.photos || [],
    };
    
    await this.saveEvent(eventData);
    
    const saved = await this.getEvent(eventData.event.id);
    if (!saved) {
      throw new Error('Failed to create event');
    }
    
    return saved;
  }

  /**
   * Update an event
   */
  async updateEvent(
    eventId: string,
    updates: Partial<Event>,
    options: {
      participants?: Participant[];
      photos?: Photo[];
    } = {}
  ): Promise<EventWithDetails> {
    const existing = await this.getEvent(eventId);
    if (!existing) {
      throw new Error(`Event not found: ${eventId}`);
    }
    
    const updated: EventWithDetails = {
      ...existing,
      event: {
        ...existing.event,
        ...updates,
      },
      participants: options.participants !== undefined ? options.participants : existing.participants,
      photos: options.photos !== undefined ? options.photos : existing.photos,
    };
    
    await this.saveEvent(updated);
    
    const saved = await this.getEvent(eventId);
    if (!saved) {
      throw new Error('Failed to update event');
    }
    
    return saved;
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId: string): Promise<void> {
    await this.deleteById(schema.events, eventId);
  }

  /**
   * Add a participant to an event
   */
  async addParticipant(eventId: string, participantId: string): Promise<void> {
    const event = await this.getEvent(eventId);
    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }
    
    const participant = await this.db
      .select()
      .from(schema.participants)
      .where(eq(schema.participants.id, participantId))
      .limit(1);
    
    if (participant.length === 0) {
      throw new Error(`Participant not found: ${participantId}`);
    }
    
    const updatedParticipants = [...event.participants, participant[0] as Participant];
    await this.updateEvent(eventId, {}, { participants: updatedParticipants });
  }

  /**
   * Remove a participant from an event
   */
  async removeParticipant(eventId: string, participantId: string): Promise<void> {
    const event = await this.getEvent(eventId);
    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }
    
    const updatedParticipants = event.participants.filter(p => p.id !== participantId);
    await this.updateEvent(eventId, {}, { participants: updatedParticipants });
  }

  /**
   * Set event as active/inactive
   */
  async setActive(eventId: string, active: boolean): Promise<void> {
    await this.updateEvent(eventId, { active });
  }
}

