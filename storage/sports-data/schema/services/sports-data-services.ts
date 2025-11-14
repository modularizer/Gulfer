/**
 * Sports Data Services
 * 
 * A convenience class that instantiates all services and stores them as attributes.
 * 
 * Usage:
 * ```ts
 * import { getDatabase } from '@services/storage/db';
 * import { SportsDataServices } from '@/sports-storage/schema/services';
 * 
 * const db = await getDatabase();
 * const services = new SportsDataServices(db);
 * 
 * // Access any service
 * const player = await services.playerService.getPlayer(playerId);
 * const sport = await services.sportService.getSport(sportId);
 * ```
 */

import type { Database } from '../../../adapters';
import { PlayerService } from './player-service';
import { TeamService } from './team-service';
import { EventService } from './event-service';
import { VenueService } from './venue-service';
import { SportService } from './sport-service';
import { EventFormatService } from './event-format-service';
import { VenueEventFormatService } from './venue-event-format-service';
import { ScoreFormatService } from './score-format-service';
import { ScoringService } from './scoring-service';
import { ImportExportService } from './import-export-service';

export class SportsDataServices {
  public readonly playerService: PlayerService;
  public readonly teamService: TeamService;
  public readonly eventService: EventService;
  public readonly venueService: VenueService;
  public readonly sportService: SportService;
  public readonly eventFormatService: EventFormatService;
  public readonly venueEventFormatService: VenueEventFormatService;
  public readonly scoreFormatService: ScoreFormatService;
  public readonly scoringService: ScoringService;
  public readonly importExportService: ImportExportService;

  constructor(db: Database) {
    this.playerService = new PlayerService(db);
    this.teamService = new TeamService(db);
    this.eventService = new EventService(db);
    this.venueService = new VenueService(db);
    this.sportService = new SportService(db);
    this.eventFormatService = new EventFormatService(db);
    this.venueEventFormatService = new VenueEventFormatService(db);
    this.scoreFormatService = new ScoreFormatService(db);
    this.scoringService = new ScoringService(db);
    this.importExportService = new ImportExportService(db);
  }
}

