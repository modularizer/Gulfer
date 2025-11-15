/**
 * Golf Sport Definition
 * 
 * Complete sport definition for Golf, implementing the SportDefinition interface.
 * This includes scoring methods, event formats, metadata schemas, and helper methods.
 */

import { z } from 'zod';
import { Sport, type SportMetadataSchemas } from '../../schema/generic-sports-data/sports';
import {
  sportMetadataSchema,
  baseEventFormatMetadataSchema,
  baseStageMetadataSchema,
  baseVenueMetadataSchema,
  baseEventMetadataSchema,
} from '../../schema/generic-sports-data/sports';
import type { StageInput, EventFormatWithDetails } from '../../schema/generic-sports-data/services';
import type { VenueEventFormatWithDetails } from '../../schema/generic-sports-data/services';
import { golfStrokePlay } from './scoring';

class Golf extends Sport {
  readonly name = 'Golf';
  readonly description = 'Traditional golf with holes and strokes';
  
  metadata = {
    icon: '⛳',
    category: 'precision',
  };

  venueEventFormatNameSuffix = 'Golf Course';

  metadataSchemas: SportMetadataSchemas = {
    sport: sportMetadataSchema, // Use shared sport metadata generic-sports
    eventFormat: baseEventFormatMetadataSchema.extend({
        holes: z.number().int().positive().optional(),
    }),
    stage: baseStageMetadataSchema.extend({
        par: z.number().int().min(3).max(6).optional(),
        yardage: z.number().int().positive().optional(),
        handicap: z.number().int().min(1).max(18).optional(),
        holeType: z.enum(['par-3', 'par-4', 'par-5', 'par-6']).optional(),
    }),
    venue: baseVenueMetadataSchema.extend({
        courseType: z.enum(['public', 'private', 'resort', 'municipal']).optional(),
        totalYardage: z.number().int().positive().optional(),
        courseRating: z.number().optional(),
        slopeRating: z.number().int().min(55).max(155).optional(),
    }),
    event: baseEventMetadataSchema.extend({
        tournamentType: z.enum(['stroke-play', 'match-play', 'scramble', 'best-ball']).optional(),
        weather: z.string().optional(),
        conditions: z.string().optional(),
    }),
  };

  eventFormats = [
    {
      name: '18-Hole Course',
      notes: 'Standard 18-hole golf course',
      scoringMethod: golfStrokePlay,
      stages: Array.from({ length: 18 }, (_, i) => ({
        number: i + 1,
        name: `Hole ${i + 1}`,
      })),
      metadata: { holes: 18 },
    },
    {
      name: '9-Hole Course',
      notes: 'Short 9-hole golf course',
      scoringMethod: golfStrokePlay,
      stages: Array.from({ length: 9 }, (_, i) => ({
        number: i + 1,
        name: `Hole ${i + 1}`,
      })),
      metadata: { holes: 9 },
    },
  ];

  formatScore(value: any, metadata?: Record<string, any>): string {
    if (typeof value !== 'number') return String(value);
    const par = metadata?.par;
    if (par === undefined) return value.toString();
    const diff = value - par;
    if (value === 1) return 'Hole in One';
    if (diff === -2) return 'Double Eagle';
    if (diff === -1) return 'Eagle';
    if (diff === 0) return 'Par';
    if (diff === 1) return 'Bogey';
    if (diff === 2) return 'Double Bogey';
    return `+${diff}`;
  }

  async generateHoleFormat(
    numHoles: number,
    options?: {
      name?: string;
      notes?: string;
      scoringMethod?: typeof golfStrokePlay;
      metadata?: Record<string, any>;
    }
  ): Promise<EventFormatWithDetails> {
    if (numHoles < 1) throw new Error('Number of holes must be at least 1');
    if (!this.eventFormatService || !this.scoreFormatService) {
      throw new Error('Sport has not been initialized with a database. Call registerSport first.');
    }
    const sportId = this.getSportId();

    // Use golf stroke play as default
    const scoringMethod = options?.scoringMethod || golfStrokePlay;
    
    // Ensure scoring method is registered (creates score format in database if needed)
    // This is idempotent - it will only create if it doesn't exist
    await scoringMethod.register(this.db!, sportId, this.scoreFormatService);
    
    // Get the score format (should exist after registration)
    const scoreFormats = await this.scoreFormatService.getScoreFormatsByScoringMethod(scoringMethod.name);
    
    // First try to find one with the exact sportId
    let scoreFormat = scoreFormats.find((sf: { sportId: string | null; }) => sf.sportId === sportId);
    
    // If not found, try to find one with null sportId (generic) and update it
    if (!scoreFormat) {
      const genericScoreFormat = scoreFormats.find((sf: { sportId: string | null; }) => !sf.sportId || sf.sportId === null);
      if (genericScoreFormat) {
        // Update the generic one to be sport-specific
        try {
          await this.scoreFormatService.updateScoreFormat(genericScoreFormat.id, {
            sportId: sportId,
          });
          scoreFormat = await this.scoreFormatService.getScoreFormat(genericScoreFormat.id);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.warn(`Failed to update generic score format to sport-specific: ${errorMessage}`);
        }
      }
    }
    
    // If still not found, try to create it
    if (!scoreFormat) {
      try {
        scoreFormat = await this.scoreFormatService.createScoreFormat({
          name: scoringMethod.name,
          notes: scoringMethod.description,
          sportId: sportId,
          scoringMethodName: scoringMethod.name,
          metadata: null,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Score format for "${scoringMethod.name}" not found for golf and could not be created: ${errorMessage}`);
      }
    }
    
    if (!scoreFormat) {
      // This should not happen, but provide detailed error if it does
      const errorMessage = `Score format for "${scoringMethod.name}" was not found or created. ` +
        `Found ${scoreFormats.length} score format(s) with this scoring method name. ` +
        `Available score formats: ${JSON.stringify(scoreFormats.map(sf => ({ id: sf.id, sportId: sf.sportId, name: sf.name })))}`;
      throw new Error(errorMessage);
    }

    const stages: StageInput[] = Array.from({ length: numHoles }, (_, i) => ({
      number: i + 1,
      name: `Hole ${i + 1}`,
    }));

    const metadata = this.metadataSchemas?.eventFormat
      ? this.metadataSchemas.eventFormat.parse(options?.metadata || { holes: numHoles })
      : (options?.metadata || { holes: numHoles });

    return await this.eventFormatService.createEventFormatWithStages(
      {
        name: options?.name || `${numHoles}-Hole Course`,
        notes: options?.notes || `${numHoles}-hole golf course`,
        sportId,
        scoreFormatId: scoreFormat.id,
        metadata,
      },
      stages
    );
  }

  async addCourse(
    venueName: string,
    numHoles: number,
    options?: {
      venueNotes?: string;
      formatName?: string;
      formatNotes?: string;
      venueEventFormatName?: string;
      venueEventFormatNotes?: string;
    }
  ): Promise<VenueEventFormatWithDetails> {
    if (numHoles < 1) throw new Error('Number of holes must be at least 1');
    if (!this.venueService || !this.eventFormatService || !this.venueEventFormatService) {
      throw new Error('Sport has not been initialized with a database. Call registerSport first.');
    }
    const sportId = this.getSportId();

    // 1. Get or create venue
    let venue = (await this.venueService.getVenuesByName(venueName)).find(
        (v: { venue: { name: string; }; }) => v.venue.name?.toLowerCase() === venueName.toLowerCase()
    );
    if (!venue) {
      venue = await this.venueService.createVenue({
        name: venueName,
        notes: options?.venueNotes || null,
      });
    }

    // 2. Get or create event format
    const formatName = options?.formatName || `${numHoles}-Hole Course`;
    let eventFormat: EventFormatWithDetails;
    const existingFormat = (await this.eventFormatService.getEventFormatsBySport(sportId)).find(
        (ef: { name: string; }) => ef.name?.toLowerCase() === formatName.toLowerCase()
    );
    if (!existingFormat) {
      eventFormat = await this.generateHoleFormat(numHoles, {
        name: formatName,
        notes: options?.formatNotes || `${numHoles}-hole golf course`,
      });
    } else {
      // Get with stages
      const formatWithStages = await this.eventFormatService.getEventFormatWithStages(existingFormat.id);
      if (!formatWithStages) {
        throw new Error(`Failed to get event format with stages: ${existingFormat.id}`);
      }
      eventFormat = formatWithStages;
    }

    // 3. Get or create venue event format
    const venueEventFormats = await this.venueEventFormatService.getVenueEventFormatsByVenue(venue.venue.id);
    let venueEventFormat = venueEventFormats.find(
        (vef: { eventFormatId: string; }) => vef.eventFormatId === eventFormat.id
    );
    
    if (!venueEventFormat) {
      const venueEventFormatName = options?.venueEventFormatName || `${venueName} - ${formatName}`;
      return await this.venueEventFormatService.createVenueEventFormatWithStages(
        {
          venueId: venue.venue.id,
          eventFormatId: eventFormat.id,
          name: venueEventFormatName,
          notes: options?.venueEventFormatNotes || null,
        }
      );
    } else {
      // Get with stages
      const venueEventFormatWithStages = await this.venueEventFormatService.getVenueEventFormatWithStages(venueEventFormat.id);
      if (!venueEventFormatWithStages) {
        throw new Error(`Failed to get venue event format with stages: ${venueEventFormat.id}`);
      }
      return venueEventFormatWithStages;
    }
  }
}


export const golf = new Golf();
