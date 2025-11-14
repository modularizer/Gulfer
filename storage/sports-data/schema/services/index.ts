/**
 * Schema Services
 * 
 * Object-oriented services for managing all schema entities.
 * These services provide high-level, type-safe APIs for common operations.
 * 
 * Usage:
 * ```ts
 * import { getDatabase } from '@services/storage/db';
 * import { PlayerService, TeamService, EventService } from '@/sports-storage/schema/services';
 * 
 * const db = await getDatabase();
 * const playerService = new PlayerService(db);
 * const player = await playerService.getPlayer(playerId);
 * ```
 */

// Base services
export { BaseService } from './base';
export { BaseTableService } from './base-table-service';
export type { BaseColumns, BaseColumnsUpdate } from './base-table-service';

// Entity services
export { PlayerService } from './player-service';
export { TeamService } from './team-service';
export { EventService } from './event-service';
export { VenueService } from './venue-service';
export { SportService } from './sport-service';
export { EventFormatService } from './event-format-service';
export { VenueEventFormatService } from './venue-event-format-service';
export { ScoreFormatService } from './score-format-service';
export { ScoringService } from './scoring-service';
export { ImportExportService } from './import-export-service';
// AccountSettingsService moved to accounts/ folder
export type {
  ForeignStorageId,
  ExportOptions,
  ImportOptions,
  MergeResolution,
  ExportData,
} from './import-export-service';

// Re-export types for convenience
export type {
  ParticipantWithDetails,
  TeamWithDetails,
  EventWithDetails,
  VenueWithDetails,
} from '../query-builders';

// Re-export event format types
export type {
  EventFormatWithDetails,
  StageInput,
} from './event-format-service';

// Re-export venue event format types
export type {
  VenueEventFormatWithDetails,
  StageMetadataInput,
} from './venue-event-format-service';

