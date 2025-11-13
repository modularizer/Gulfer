/**
 * Schema Services
 * 
 * Object-oriented services for managing all schema entities.
 * These services provide high-level, type-safe APIs for common operations.
 * 
 * Usage:
 * ```ts
 * import { getDatabase } from '@services/storage/db';
 * import { PlayerService, TeamService, EventService } from '@/schema/services';
 * 
 * const db = await getDatabase();
 * const playerService = new PlayerService(db);
 * const player = await playerService.getPlayer(playerId);
 * ```
 */

// Base service
export { BaseService } from './base';

// Entity services
export { PlayerService } from './player-service';
export { TeamService } from './team-service';
export { EventService } from './event-service';
export { VenueService } from './venue-service';
export { SportService } from './sport-service';
export { EventFormatService } from './event-format-service';
export { VenueEventFormatService } from './venue-event-format-service';
export { ScoreFormatService } from './score-format-service';

// Re-export types for convenience
export type {
  ParticipantWithDetails,
  TeamWithDetails,
  EventWithDetails,
  VenueWithDetails,
} from '../query-builders';

