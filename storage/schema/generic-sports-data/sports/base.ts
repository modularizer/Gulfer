/**
 * Sport Interface
 * 
 * Defines the interface that all sports must implement.
 * This ensures consistency across all sport implementations and provides
 * a structured way to register sports with their configurations.
 */

import { z } from 'zod';
import type { Database } from '../../../../xp-deeby/adapters';
import type { Sport as SportRecord, ScoreFormat, EventFormat, Venue, Event, Participant } from '../tables';
import type { ScoringMethod } from '../scoring';
import { SportService, ScoreFormatService, EventFormatService, VenueService, VenueEventFormatService, EventService, VenueEventFormatWithDetails, StageMetadataInput, EventFormatWithDetails, StageInput } from '../services';
import type { VenueWithDetails, EventWithDetails } from '../query-builders';

// Re-export for convenience
export type { ScoringMethod };

// ============================================================================
// Shared Metadata Schemas (Zod)
// ============================================================================

/**
 * Shared generic-sports for sport metadata
 * All sports use this base generic-sports
 */
export const sportMetadataSchema = z.object({
  icon: z.string().optional(),
  category: z.enum(['precision', 'endurance', 'strength', 'team', 'other']).optional(),
});

/**
 * Base generic-sports for event format metadata
 * Sports can extend this with sport-specific fields
 */
export const baseEventFormatMetadataSchema = z.object({});

/**
 * Base generic-sports for stage metadata
 * Sports can extend this with sport-specific fields
 */
export const baseStageMetadataSchema = z.object({});

/**
 * Base generic-sports for venue metadata
 * Sports can extend this with sport-specific fields
 */
export const baseVenueMetadataSchema = z.object({});

/**
 * Base generic-sports for event metadata
 * Sports can extend this with sport-specific fields
 */
export const baseEventMetadataSchema = z.object({});

/**
 * Metadata schemas for validation using Zod
 * Each sport can extend the base schemas with sport-specific fields
 */
export interface SportMetadataSchemas {
  /**
   * Schema for sport metadata (must use or extend sportMetadataSchema)
   */
  sport?: z.ZodTypeAny;

  /**
   * Schema for event format metadata (can extend baseEventFormatMetadataSchema)
   */
  eventFormat?: z.ZodTypeAny;

  /**
   * Schema for stage metadata (can extend baseStageMetadataSchema)
   */
  stage?: z.ZodTypeAny;

  /**
   * Schema for venue metadata (can extend baseVenueMetadataSchema)
   */
  venue?: z.ZodTypeAny;

  /**
   * Schema for event metadata (can extend baseEventMetadataSchema)
   */
  event?: z.ZodTypeAny;
}

// ============================================================================
// Event Format Definitions
// ============================================================================

/**
 * Definition of a scoring method for a sport
 */
export interface SportScoringMethod {
  /**
   * The ScoringMethod implementation
   */
  method: ScoringMethod;

  /**
   * Display name for the score format
   */
  name: string;

  /**
   * Description/notes
   */
  notes?: string;

  /**
   * Metadata for the score format
   */
  metadata?: Record<string, any>;
}

/**
 * Definition of an event format for a sport
 */
export interface SportEventFormat {
  /**
   * Name of the event format
   */
  name: string;

  /**
   * Description/notes
   */
  notes?: string;

  /**
   * Scoring method to use (the actual ScoringMethod instance)
   */
  scoringMethod: ScoringMethod;

  /**
   * Stages definition (recursive)
   */
  stages: StageInput[];

  /**
   * Metadata for this event format
   */
  metadata?: Record<string, any>;

  /**
   * Minimum team size (number of players per team)
   */
  minTeamSize?: number | null;

  /**
   * Maximum team size (number of players per team)
   */
  maxTeamSize?: number | null;

  /**
   * Minimum number of teams required for this event format
   */
  minTeams?: number | null;

  /**
   * Maximum number of teams allowed for this event format
   */
  maxTeams?: number | null;

  /**
   * Expected minimum duration in minutes
   */
  expectedMinDuration?: number | null;

  /**
   * Expected duration in minutes
   */
  expectedDuration?: number | null;

  /**
   * Expected maximum duration in minutes
   */
  expectedMaxDuration?: number | null;
}

// ============================================================================
// Sport Interface
// ============================================================================

/**
 * Abstract base class that all sports must extend
 * This class provides both the sport definition and driver functionality
 */
export abstract class Sport {
  /**
   * Unique name/identifier for the sport (e.g., 'Golf', 'Tennis', 'Basketball')
   * This is used as the unique identifier for registration and lookup
   * This is NOT a database ID - it's a human-readable unique name
   */
  abstract readonly name: string;

  /**
   * Cached database ID (16-character hex) - set after registration
   * This is used for all database queries to avoid name lookups
   */
  _cachedId?: string;

  /**
   * Description of the sport
   */
  abstract readonly description: string;

  /**
   * Database instance - set during registration
   */
  protected db?: Database;

  /**
   * Services - initialized during registration
   */
  protected sportService?: SportService;
  protected scoreFormatService?: ScoreFormatService;
  protected eventFormatService?: EventFormatService;
  protected venueService?: VenueService;
  protected venueEventFormatService?: VenueEventFormatService;
  protected eventService?: EventService;

  /**
   * Initialize the sport with services (no database registration)
   * This can be called before the database exists
   * Call register(db) later to register with the database
   */
  initialize(): void {
    // Services will be initialized when register() is called
    // This method exists for compatibility but doesn't do anything
    // Sports can be instantiated without a database
  }

  /**
   * Register the sport with a database
   * Automatically registers itself in the database (upserts Sport)
   * Also registers all scoring methods from eventFormats and creates event formats
   * 
   * @param db - The database instance to register with
   * @param services - Optional services instance (will create if not provided)
   */
  async register(db: Database, services?: {
    sportService?: SportService;
    scoreFormatService?: ScoreFormatService;
    eventFormatService?: EventFormatService;
    venueService?: VenueService;
    venueEventFormatService?: VenueEventFormatService;
    eventService?: EventService;
  }): Promise<void> {
    this.db = db;
    
    // Use provided services or create new ones
    this.sportService = services?.sportService || new SportService(db);
    this.scoreFormatService = services?.scoreFormatService || new ScoreFormatService(db);
    this.eventFormatService = services?.eventFormatService || new EventFormatService(db);
    this.venueService = services?.venueService || new VenueService(db);
    this.venueEventFormatService = services?.venueEventFormatService || new VenueEventFormatService(db);
    this.eventService = services?.eventService || new EventService(db);
    
    // Auto-register: upsert Sport in database
    await this._selfRegister();
    
    // Auto-register scoring methods from eventFormats
    await this._registerScoringMethods();
    
    // Auto-register event formats
    await this._registerEventFormats();
  }

  /**
   * Internal method to self-register in the database
   */
  private async _selfRegister(): Promise<void> {
    if (!this.sportService) {
      throw new Error('SportService not initialized');
    }

    // Check if sport already exists (exact name match)
    const allSports = await this.sportService.getAllSports();
    const existing = allSports.find(s => s.name?.toLowerCase() === this.name.toLowerCase());
    let sport: SportRecord;
    
    if (existing) {
      // Update existing sport
      sport = existing;
      await this.sportService.updateSport(sport.id, {
        name: this.name,
        notes: this.description,
        metadata: this.metadata || null,
      });
      this._cachedId = sport.id;
    } else {
      // Create new sport
      sport = await this.sportService.createSport({
        name: this.name,
        notes: this.description,
        metadata: this.metadata || null,
      });
      this._cachedId = sport.id;
    }
  }

  /**
   * Internal method to register scoring methods from eventFormats
   * Automatically called when a sport is registered
   */
  private async _registerScoringMethods(): Promise<void> {
    if (!this.eventFormats || this.eventFormats.length === 0) {
      return;
    }

    if (!this.db || !this.scoreFormatService) {
      throw new Error('Database or ScoreFormatService not initialized');
    }

    const sportId = this.getSportId();

    // Collect all unique scoring methods from eventFormats
    const scoringMethodsSet = new Set<ScoringMethod>();
    for (const eventFormat of this.eventFormats) {
      scoringMethodsSet.add(eventFormat.scoringMethod);
    }

    // Register each scoring method with the database
    // Scoring methods can be instantiated before the database exists,
    // but they need to be registered when the sport is registered
    for (const scoringMethod of scoringMethodsSet) {
      // Ensure scoring method is initialized (registers in static registry)
      scoringMethod.initialize();
      // Register with database
      await scoringMethod.register(this.db, sportId, this.scoreFormatService);
    }
  }

  /**
   * Internal method to register event formats
   */
  private async _registerEventFormats(): Promise<void> {
    if (!this.eventFormats || this.eventFormats.length === 0) {
      return;
    }

    if (!this.db || !this.eventFormatService || !this.scoreFormatService) {
      throw new Error('Services not initialized');
    }

    const sportId = this.getSportId();

    // Build score format map
    const scoreFormatMap = new Map<string, ScoreFormat>();
    const scoringMethodsSet = new Set<ScoringMethod>();
    for (const eventFormat of this.eventFormats) {
      scoringMethodsSet.add(eventFormat.scoringMethod);
    }

    for (const scoringMethod of scoringMethodsSet) {
      const scoreFormats = await this.scoreFormatService.getScoreFormatsByScoringMethod(scoringMethod.name);
      const scoreFormat = scoreFormats.find(sf => sf.sportId === sportId);
      if (scoreFormat) {
        scoreFormatMap.set(scoringMethod.name, scoreFormat);
      }
    }

    // Register each event format
    for (const formatDef of this.eventFormats) {
      const scoreFormat = scoreFormatMap.get(formatDef.scoringMethod.name);
      if (!scoreFormat) {
        console.warn(`Score format for "${formatDef.scoringMethod.name}" not found. Skipping event format "${formatDef.name}".`);
        continue;
      }

      // Check if event format already exists
      const existing = await this.eventFormatService.getEventFormatsBySport(sportId);
      const existingFormat = existing.find(ef => ef.name === formatDef.name);
      
      if (existingFormat) {
        // Update existing event format
        await this.eventFormatService.updateEventFormat(existingFormat.id, {
          name: formatDef.name,
          notes: formatDef.notes || null,
          sportId,
          scoreFormatId: scoreFormat.id,
          metadata: formatDef.metadata || null,
          minTeamSize: formatDef.minTeamSize ?? null,
          maxTeamSize: formatDef.maxTeamSize ?? null,
          minTeams: formatDef.minTeams ?? null,
          maxTeams: formatDef.maxTeams ?? null,
          expectedMinDuration: formatDef.expectedMinDuration ?? null,
          expectedDuration: formatDef.expectedDuration ?? null,
          expectedMaxDuration: formatDef.expectedMaxDuration ?? null,
        });
        // Update stages if needed
        if (formatDef.stages.length > 0) {
          await this.eventFormatService.updateEventFormatWithStages(
            existingFormat.id,
            {
              name: formatDef.name,
              notes: formatDef.notes || null,
              metadata: formatDef.metadata || null,
            },
            formatDef.stages
          );
        }
      } else {
        // Create new event format
        // Validate metadata if provided and generic-sports exists
        let validatedMetadata = formatDef.metadata || null;
        if (validatedMetadata && this.metadataSchemas?.eventFormat) {
          try {
            validatedMetadata = this.metadataSchemas.eventFormat.parse(validatedMetadata);
          } catch (error) {
            if (error instanceof z.ZodError) {
              console.error(`Invalid event format metadata for "${formatDef.name}": ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
            } else if (error instanceof Error) {
              console.error(`Invalid event format metadata for "${formatDef.name}": ${error.message}`);
            }
            validatedMetadata = null;
          }
        }

        await this.eventFormatService.createEventFormatWithStages(
          {
            name: formatDef.name,
            notes: formatDef.notes || null,
            sportId,
            scoreFormatId: scoreFormat.id,
            metadata: validatedMetadata,
            minTeamSize: formatDef.minTeamSize ?? null,
            maxTeamSize: formatDef.maxTeamSize ?? null,
            minTeams: formatDef.minTeams ?? null,
            maxTeams: formatDef.maxTeams ?? null,
            expectedMinDuration: formatDef.expectedMinDuration ?? null,
            expectedDuration: formatDef.expectedDuration ?? null,
            expectedMaxDuration: formatDef.expectedMaxDuration ?? null,
          },
          formatDef.stages
        );
      }
    }
  }

  /**
   * Get the cached sport ID (16-character hex)
   */
  getSportId(): string {
    if (!this._cachedId) {
      throw new Error(`Sport "${this.name}" has not been registered in the database yet.`);
    }
    return this._cachedId;
  }

  /**
   * Get the sport from the database
   */
  async getSport(): Promise<SportRecord | null> {
    if (!this.sportService) {
      throw new Error('Sport has not been initialized with a database. Call registerSport first.');
    }
    const sportId = this.getSportId();
    return await this.sportService.getSport(sportId);
  }

  // ============================================================================
  // Score Formats
  // ============================================================================

  /**
   * Get all score formats for this sport
   */
  async getScoreFormats(): Promise<ScoreFormat[]> {
    if (!this.scoreFormatService) {
      throw new Error('Sport has not been initialized with a database. Call registerSport first.');
    }
    return await this.scoreFormatService.getAllScoreFormats();
  }

  /**
   * Get a score format by scoring method name
   */
  async getScoreFormatByMethod(scoringMethodName: string): Promise<ScoreFormat | null> {
    if (!this.scoreFormatService) {
      throw new Error('Sport has not been initialized with a database. Call registerSport first.');
    }
    const formats = await this.scoreFormatService.getScoreFormatsByScoringMethod(scoringMethodName);
    const sportId = this.getSportId();
    return formats.find(sf => sf.sportId === sportId) || null;
  }

  /**
   * Get all score formats for this sport
   */
  async getScoreFormatsForSport(): Promise<ScoreFormat[]> {
    if (!this.scoreFormatService) {
      throw new Error('Sport has not been initialized with a database. Call registerSport first.');
    }
    const allFormats = await this.scoreFormatService.getAllScoreFormats();
    const sportId = this.getSportId();
    return allFormats.filter(sf => sf.sportId === sportId);
  }

  // ============================================================================
  // Event Formats
  // ============================================================================

  /**
   * Get all event formats for this sport
   */
  async getEventFormats(): Promise<EventFormat[]> {
    if (!this.eventFormatService) {
      throw new Error('Sport has not been initialized with a database. Call registerSport first.');
    }
    const sportId = this.getSportId();
    return await this.eventFormatService.getEventFormatsBySport(sportId);
  }

  /**
   * Get an event format by name
   */
  async getEventFormatByName(name: string): Promise<EventFormat | null> {
    const formats = await this.getEventFormats();
    return formats.find(ef => ef.name === name) || null;
  }

  /**
   * Get an event format with its stages
   */
  async getEventFormatWithStages(eventFormatId: string): Promise<EventFormatWithDetails | null> {
    if (!this.eventFormatService) {
      throw new Error('Sport has not been initialized with a database. Call registerSport first.');
    }
    return await this.eventFormatService.getEventFormatWithStages(eventFormatId);
  }

  /**
   * Get all event formats with their stages
   */
  async getEventFormatsWithStages(): Promise<EventFormatWithDetails[]> {
    const formats = await this.getEventFormats();
    const results: EventFormatWithDetails[] = [];
    for (const format of formats) {
      const withStages = await this.getEventFormatWithStages(format.id);
      if (withStages) {
        results.push(withStages);
      }
    }
    return results;
  }

  // ============================================================================
  // Venues
  // ============================================================================

  /**
   * Create a venue for this sport
   * Handles generic-sports venue creation with metadata validation
   * Sports can override this method for custom behavior
   */
  async createVenue(
    venue: Partial<Venue>,
    eventFormatId: string,
    stageMetadata?: StageMetadataInput
  ): Promise<VenueEventFormatWithDetails> {
    if (!this.db || !this.venueService || !this.venueEventFormatService || !this.eventFormatService) {
      throw new Error('Sport has not been initialized with a database. Call registerSport first.');
    }

    // Default generic-sports implementation
    // Validate venue metadata if provided
    let validatedVenueMetadata = venue.metadata || null;
    if (validatedVenueMetadata && this.metadataSchemas?.venue) {
      try {
        validatedVenueMetadata = this.metadataSchemas.venue.parse(validatedVenueMetadata);
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new Error(
            `Invalid venue metadata: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
          );
        }
        throw error;
      }
    }

    // Create or get the venue
    const venueWithDetails = await this.venueService.createVenue({
      ...venue,
      metadata: validatedVenueMetadata,
    });

    // Get the event format with its stages
    const eventFormat = await this.eventFormatService.getEventFormatWithStages(eventFormatId);
    if (!eventFormat) {
      throw new Error(`Event format not found: ${eventFormatId}`);
    }

    // Validate stage metadata if provided
    let validatedStageMetadata: StageMetadataInput | undefined;
    if (stageMetadata && this.metadataSchemas?.stage) {
      validatedStageMetadata = {};
      for (const [stageId, metadata] of Object.entries(stageMetadata)) {
        if (metadata) {
          try {
            validatedStageMetadata[stageId] = this.metadataSchemas.stage!.parse(metadata);
          } catch (error) {
            if (error instanceof z.ZodError) {
              throw new Error(
                `Invalid stage metadata for stage ${stageId}: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
              );
            }
            throw error;
          }
        }
      }
    } else {
      validatedStageMetadata = stageMetadata;
    }

    // Create venue event format with stages
    const nameSuffix = this.venueEventFormatNameSuffix || this.name;
    return await this.venueEventFormatService.createVenueEventFormatWithStages(
      {
        venueId: venueWithDetails.venue.id,
        eventFormatId,
        name: `${venue.name} - ${nameSuffix}`,
      },
      validatedStageMetadata
    );
  }

  /**
   * Get all venues for this sport
   * (venues that have venue event formats using this sport's event formats)
   */
  async getVenues(): Promise<VenueWithDetails[]> {
    if (!this.venueService) {
      throw new Error('Sport has not been initialized with a database. Call registerSport first.');
    }
    // Get all venues - filtering by sport would require joining with venueEventFormats
    // For now, return all venues. Can be enhanced later with proper joins.
    return await this.venueService.getAllVenues();
  }

  // ============================================================================
  // Events
  // ============================================================================

  /**
   * Create an event for this sport
   * Handles generic-sports event creation with metadata validation
   * Sports can override this method for custom behavior
   */
  async createEvent(
    event: Partial<Event>,
    venueEventFormatId: string,
    participants?: Participant[]
  ): Promise<EventWithDetails> {
    if (!this.db || !this.eventService) {
      throw new Error('Sport has not been initialized with a database. Call registerSport first.');
    }

    // Default generic-sports implementation with metadata validation
    let validatedEventMetadata = event.metadata || null;
    if (validatedEventMetadata && this.metadataSchemas?.event) {
      try {
        validatedEventMetadata = this.metadataSchemas.event.parse(validatedEventMetadata);
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new Error(
            `Invalid event metadata: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
          );
        }
        throw error;
      }
    }

    return await this.eventService.createEvent(
      { ...event, metadata: validatedEventMetadata, venueEventFormatId },
      { participants }
    );
  }

  /**
   * Get all events for this sport
   */
  async getEvents(): Promise<EventWithDetails[]> {
    if (!this.eventService) {
      throw new Error('Sport has not been initialized with a database. Call registerSport first.');
    }
    // Get all events - filtering by sport would require joining with venueEventFormats
    // For now, return all events. Can be enhanced later with proper joins.
    return await this.eventService.getAllEvents();
  }

  // ============================================================================
  // Metadata Validation
  // ============================================================================

  /**
   * Validate metadata for a sport entity
   * Sports can override this method for custom validation
   */
  validateMetadata(
    type: 'sport' | 'eventFormat' | 'stage' | 'venue' | 'event',
    metadata: Record<string, any>
  ): Record<string, any> {
    // Default implementation - sports can override
    return metadata;
  }

  /**
   * Format a score value for display
   * Sports can override this method for custom formatting
   */
  formatScore(value: any, metadata?: Record<string, any>): string {
    // Default implementation - sports can override
    return String(value);
  }

  /**
   * Metadata about the sport (icon, category, etc.)
   */
  metadata?: Record<string, any>;

  /**
   * Optional suffix for venue event format names
   * Defaults to the sport name (e.g., "Golf", "Tennis")
   * Can be customized (e.g., "Golf Course" for golf)
   */
  venueEventFormatNameSuffix?: string;

  /**
   * Zod schemas for metadata validation
   */
  metadataSchemas?: SportMetadataSchemas;

  /**
   * Default event formats for this sport
   * These will be automatically created when the sport is registered
   * If you need custom registration logic, implement registerEventFormats
   * Scoring methods are automatically registered from the eventFormats
   */
  eventFormats?: SportEventFormat[];

  /**
   * Optional: Custom registration logic for event formats
   * If not provided, event formats from eventFormats array will be registered automatically
   */
  registerEventFormats?(
    db: Database,
    sportId: string,
    scoreFormats: Map<string, ScoreFormat>
  ): Promise<EventFormat[]>;
}

