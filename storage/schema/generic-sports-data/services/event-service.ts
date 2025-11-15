/**
 * Event Service
 *
 * Object-oriented service for managing events.
 * Provides high-level methods for event operations.
 */

import { BaseService } from './base';
import { queryEvents, upsertEventWithDetails, type EventWithDetails } from '../query-builders';
import { eq, and, inArray, gte, lte, type SQL } from 'drizzle-orm';
import * as schema from '../tables';
import type { Event, Participant, Photo, EventStage } from '../tables';
import { generateUUID } from '@utils/uuid';
import { VenueEventFormatService } from './venue-event-format-service';

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
     * @param startDate - Optional start date (inclusive). If not provided, no lower bound.
     * @param endDate - Optional end date (inclusive). If not provided, no upper bound.
     */
    async getEventsByDateRange(
        startDate?: Date | null,
        endDate?: Date | null
    ): Promise<EventWithDetails[]> {
        // Build conditions array, only adding valid SQL conditions
        const conditions: SQL[] = [];

        // Add start date condition if provided
        if (startDate != null) {
            const startCondition = gte(schema.events.startTime, startDate) as SQL;
            conditions.push(startCondition);
        }

        // Add end date condition if provided
        if (endDate != null) {
            const endCondition = lte(schema.events.endTime, endDate) as SQL;
            conditions.push(endCondition);
        }

        // Build query with conditional where clause
        const query = queryEvents(this.db)
            .withVenueAndFormat()
            .withParticipants()
            .withStages()
            .withPhotos();

        // Only add where clause if we have conditions
        if (conditions.length > 0) {
            //@ts-ignore
            return await query.where(and(...conditions)).execute();
        }

        return await query.execute();
    }

    /**
     * Create or update an event
     */
    async saveEvent(event: EventWithDetails): Promise<void> {
        try {
            await upsertEventWithDetails(this.db, event);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to save event: ${errorMessage}. Event ID: ${event.event.id}`);
        }
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

        // Get the venue event format with its stages to create event stages
        const venueEventFormatService = new VenueEventFormatService(this.db);
        const venueEventFormatWithStages = await venueEventFormatService.getVenueEventFormatWithStages(event.venueEventFormatId);
        if (!venueEventFormatWithStages) {
            throw new Error(`Venue event format not found: ${event.venueEventFormatId}`);
        }

        // Flatten all stages from the recursive structure to get all stages (including nested ones)
        const flattenStages = (stages: typeof venueEventFormatWithStages.stages): typeof venueEventFormatWithStages.stages => {
            const flattened: typeof venueEventFormatWithStages.stages = [];
            for (const stage of stages) {
                flattened.push(stage);
                if (stage.subStages && stage.subStages.length > 0) {
                    flattened.push(...flattenStages(stage.subStages));
                }
            }
            return flattened;
        };

        // Create event stages from venue event format stages
        // Note: venueEventFormatWithStages.stages is already a tree structure from queryStages
        // We need to flatten it to get all stages (not just root ones)
        const allVenueStages = flattenStages(venueEventFormatWithStages.stages);
        const eventStages: EventWithDetails['stages'] = [];
        
        console.log(`[createEvent] Venue event format has ${venueEventFormatWithStages.stages.length} root stages`);
        console.log(`[createEvent] After flattening: ${allVenueStages.length} total stages`);
        console.log(`[createEvent] Venue stages breakdown:`, allVenueStages.map(s => ({
          id: s.venueEventFormatStage?.id,
          name: s.venueEventFormatStage?.name,
          number: s.venueEventFormatStage?.number,
          parentId: s.venueEventFormatStage?.parentId,
          hasVenueEventFormatStage: !!s.venueEventFormatStage
        })));
        
        let skippedCount = 0;
        for (const venueStage of allVenueStages) {
            if (!venueStage.venueEventFormatStage) {
                skippedCount++;
                continue;
            }

            const eventStage: EventStage = {
                id: generateUUID(),
                name: venueStage.venueEventFormatStage.name,
                notes: venueStage.venueEventFormatStage.notes,
                lat: venueStage.venueEventFormatStage.lat,
                lng: venueStage.venueEventFormatStage.lng,
                metadata: venueStage.venueEventFormatStage.metadata,
                eventId: '', // Will be set below
                venueEventFormatStageId: venueStage.venueEventFormatStage.id,
                eventFormatStageId: venueStage.eventFormatStage?.id || null,
                parentId: venueStage.venueEventFormatStage.parentId,
            } as EventStage;

            eventStages.push({
                stage: eventStage,
                venueEventFormatStage: venueStage.venueEventFormatStage,
                eventFormatStage: venueStage.eventFormatStage || null,
                scores: [],
            });
        }
        
        console.log(`[createEvent] Created ${eventStages.length} event stages (skipped ${skippedCount} without venueEventFormatStage)`);
        
        // Log stage numbers for debugging
        const stageNumbers = eventStages.map(s => 
            s.venueEventFormatStage?.number ?? s.eventFormatStage?.number ?? '?'
        ).sort((a, b) => (a as number) - (b as number));
        console.log(`[createEvent] Stage numbers: ${stageNumbers.join(', ')}`);

        const eventId = event.id || generateUUID();
        
        // Set the eventId on all stages
        for (const stageData of eventStages) {
            stageData.stage.eventId = eventId;
        }

        const eventData: EventWithDetails = {
            event: {
                id: eventId,
                name: event.name || null,
                notes: event.notes || null,
                lat: event.lat ?? null,
                lng: event.lng ?? null,
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
            stages: eventStages,
            photos: options.photos || [],
        };

        try {
            await this.saveEvent(eventData);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to create event: ${errorMessage}. Event data: ${JSON.stringify({
                id: eventData.event.id,
                name: eventData.event.name,
                venueEventFormatId: eventData.event.venueEventFormatId,
                stagesCount: eventData.stages.length
            })}`);
        }

        const saved = await this.getEvent(eventData.event.id);
        if (!saved) {
            // Try to get raw data to see what happened
            let rawData: any[] = [];
            try {
                rawData = await this.db
                    .select()
                    .from(schema.events)
                    .where(eq(schema.events.id, eventData.event.id))
                    .limit(1);
            } catch (queryError) {
                // Ignore query errors
            }
            
            throw new Error(`Failed to create event: Event was saved but could not be retrieved. Event ID: ${eventData.event.id}. Raw data: ${JSON.stringify(rawData)}`);
        }
        
        console.log(`[createEvent] Retrieved event has ${saved.stages.length} stages`);

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

