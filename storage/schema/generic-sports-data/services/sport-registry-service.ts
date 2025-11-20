/**
 * Sport Registry Service
 * 
 * Manages registration of sports with the database.
 * Allows sports to be initialized before the database exists, then registered later.
 * 
 * When a sport is registered, it becomes available as a property on this service.
 * The property name is explicitly provided when registering.
 * 
 * Usage:
 * ```ts
 * import { SportRegistryService } from './sport-registry-service';
 * import { golf } from '@/sports/golf';
 * 
 * const registry = new SportRegistryService(db, services);
 * await registry.register('golf', golf);
 * 
 * // Access sport directly as a property
 * const golfSport = registry.golf; // or registry.getSport('Golf')
 * ```
 */

import type { XPDatabaseConnectionPlus as Database } from '../../../../xp-deeby/xp-schema';
import type { Sport } from '../sports';
import type { SportsDataServices } from './sports-data-services';

export class SportRegistryService {
  private registeredSports: Map<string, Sport> = new Map();

  constructor(
    private db: Database,
    private services: SportsDataServices
  ) {}

  /**
   * Register a sport with the database
   * 
   * @param propertyName - The property name to use for accessing this sport (e.g., 'golf', 'tennis')
   * @param sport - The sport instance to register
   * @returns The registered sport
   */
  async register(propertyName: string, sport: Sport): Promise<Sport> {
    // Register the sport with the database using services
    await sport.register(this.db, {
      sportService: this.services.sportService,
      scoreFormatService: this.services.scoreFormatService,
      eventFormatService: this.services.eventFormatService,
      venueService: this.services.venueService,
      venueEventFormatService: this.services.venueEventFormatService,
      eventService: this.services.eventService,
    });

    // Store in registry (by sport name for getSport lookup)
    this.registeredSports.set(sport.name, sport);

    // Add as a property on this instance for direct access
    // e.g., services.sports.golf, services.sports.tennis
    (this as any)[propertyName] = sport;

    return sport;
  }

  /**
   * Register multiple sports at once
   * 
   * @param sports - Record mapping property names to sport instances
   * @returns Record of registered sports (same keys as input)
   */
  async registerAll(sports: Record<string, Sport>): Promise<Record<string, Sport>> {
    const registered: Record<string, Sport> = {};
    for (const [propertyName, sport] of Object.entries(sports)) {
      registered[propertyName] = await this.register(propertyName, sport);
    }
    return registered;
  }

  /**
   * Get a registered sport by name
   * 
   * @param name - The name of the sport
   * @returns The sport if registered, undefined otherwise
   */
  getSport(name: string): Sport | undefined {
    return this.registeredSports.get(name);
  }

  /**
   * Get all registered sports
   * 
   * @returns Array of all registered sports
   */
  getAllSports(): Sport[] {
    return Array.from(this.registeredSports.values());
  }

  /**
   * Check if a sport is registered
   * 
   * @param name - The name of the sport
   * @returns True if the sport is registered
   */
  isRegistered(name: string): boolean {
    return this.registeredSports.has(name);
  }
}

