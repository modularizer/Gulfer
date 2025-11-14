/**
 * Venue Service
 * 
 * Object-oriented service for managing venues.
 * Provides high-level methods for venue operations.
 */

import { BaseService } from './base';
import { queryVenues, upsertVenueWithDetails, type VenueWithDetails } from '../query-builders';
import { eq, inArray, like } from 'drizzle-orm';
import * as schema from '../tables';
import type { Venue, Event } from '../tables';
import { generateUUID } from '@utils/uuid';

export class VenueService extends BaseService {
  /**
   * Get a venue by ID with all related storage
   */
  async getVenue(venueId: string): Promise<VenueWithDetails | null> {
    const venues = await queryVenues(this.db)
      .withEventFormats()
      .withEvents()
      .where(eq(schema.venues.id, venueId))
      .execute();
    
    return venues.length > 0 ? venues[0] : null;
  }

  /**
   * Get multiple venues by IDs
   */
  async getVenues(venueIds: string[]): Promise<VenueWithDetails[]> {
    if (venueIds.length === 0) return [];
    
    return await queryVenues(this.db)
      .withEventFormats()
      .withEvents()
      .where(inArray(schema.venues.id, venueIds))
      .execute();
  }

  /**
   * Get all venues
   */
  async getAllVenues(): Promise<VenueWithDetails[]> {
    return await queryVenues(this.db)
      .withEventFormats()
      .withEvents()
      .execute();
  }

  /**
   * Get venues by name (case-insensitive search)
   */
  async getVenuesByName(name: string): Promise<VenueWithDetails[]> {
    return await queryVenues(this.db)
      .withEventFormats()
      .withEvents()
      .where(like(schema.venues.name, `%${name}%`))
      .execute();
  }

  /**
   * Get venues near a location (within a radius)
   */
  async getVenuesNearLocation(
    lat: number,
    lng: number,
    radiusKm: number = 10
  ): Promise<VenueWithDetails[]> {
    // Simple distance calculation (Haversine formula approximation)
    // For production, consider using PostGIS or a spatial index
    const allVenues = await this.getAllVenues();
    
    return allVenues.filter(venue => {
      const distance = this.calculateDistance(
        lat,
        lng,
        venue.venue.lat,
        venue.venue.lng
      );
      return distance <= radiusKm;
    });
  }

  /**
   * Calculate distance between two points in kilometers (Haversine formula)
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Create or update a venue
   */
  async saveVenue(venue: VenueWithDetails): Promise<void> {
    await upsertVenueWithDetails(this.db, venue);
  }

  /**
   * Create a new venue
   */
  async createVenue(
    venue: Partial<Venue>,
    options: {
      events?: Event[];
    } = {}
  ): Promise<VenueWithDetails> {
    const venueData: VenueWithDetails = {
      venue: {
        id: venue.id || generateUUID(),
        name: venue.name || null,
        notes: venue.notes || null,
        lat: venue.lat ?? null,
        lng: venue.lng ?? null,
        metadata: venue.metadata || null,
      } as Venue,
      eventFormats: [],
      events: options.events || [],
    };
    
    await this.saveVenue(venueData);
    
    const saved = await this.getVenue(venueData.venue.id);
    if (!saved) {
      throw new Error('Failed to create venue');
    }
    
    return saved;
  }

  /**
   * Update a venue
   */
  async updateVenue(
    venueId: string,
    updates: Partial<Venue>,
    options: {
      events?: Event[];
    } = {}
  ): Promise<VenueWithDetails> {
    const existing = await this.getVenue(venueId);
    if (!existing) {
      throw new Error(`Venue not found: ${venueId}`);
    }
    
    const updated: VenueWithDetails = {
      ...existing,
      venue: {
        ...existing.venue,
        ...updates,
      },
      events: options.events !== undefined ? options.events : existing.events,
    };
    
    await this.saveVenue(updated);
    
    const saved = await this.getVenue(venueId);
    if (!saved) {
      throw new Error('Failed to update venue');
    }
    
    return saved;
  }

  /**
   * Delete a venue
   */
  async deleteVenue(venueId: string): Promise<void> {
    await this.deleteById(schema.venues, venueId);
  }

  /**
   * Get all events at a venue
   */
  async getVenueEvents(venueId: string): Promise<Event[]> {
    const venue = await this.getVenue(venueId);
    return venue?.events || [];
  }
}

