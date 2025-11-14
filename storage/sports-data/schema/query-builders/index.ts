/**
 * View-like Query Builders
 * 
 * This module exports composable query builders that abstract away the complexity
 * of the highly normalized schema, providing "view-like" interfaces that collect
 * all related child records into denormalized structures.
 */

// Export schema types (for use in other parts of the codebase)
export type * from '../tables/types';

// Export from numbered files (ordered by dependencies)
// 0-stages: Foundation, handles recursive stage queries with parent-child relationships
export type * from './0-stages';
export { queryStages, upsertStagesWithDetails } from './0-stages';

// 1-events: Depends on stages
export type * from './1-events';
export { queryEvents, upsertEventWithDetails } from './1-events';

// 2-participants: Depends on events
export type * from './2-participants';
export { queryParticipants, upsertParticipantWithDetails } from './2-participants';

// 3-teams: Depends on participants (teams are participants with isTeam: true)
export type * from './3-teams';
export { 
  queryTeams, 
  upsertTeamWithDetails,
  findTeamsForPlayer,
  getTeamIdsForPlayer,
  flattenTeamToPlayers,
  flattenTeamsToPlayers,
  getUniquePlayersFromTeam,
} from './3-teams';

// 4-venues: Depends on events (via venueEventFormats)
export type * from './4-venues';
export { queryVenues, upsertVenueWithDetails } from './4-venues';

// 5-account-settings: Account settings and setting options
// Account settings query builders moved to accounts/ folder

// Export upsert utilities
export { upsertEntity, upsertEntities, deleteMissingChildren } from './upsert';

