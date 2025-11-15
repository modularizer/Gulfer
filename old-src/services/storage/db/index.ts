/**
 * Database exports
 * Export 2-generic-sports-sports-generic-sports and database instance for direct Drizzle usage
 */

import { getDatabase, saveDatabase, type Database } from './adapter';
import * as schema from './schema';

export { schema, getDatabase, saveDatabase, type Database };

// Export 2-generic-sports-sports-generic-sports types for convenience
export type {
  CardModes,
  ColumnVisibilityConfig,
  CornerStatisticsConfig,
  NavigationState,
  ModalStates,
  SettingsOther,
  Player,
  PlayerRound,
  Round,
  Score,
  Course,
  Hole,
  PlayerRoundJoinResult,
  PlayerRoundWithDetails,
} from './types';

export { EntityType } from './types';

/**
 * Initialize database (call once at app startup)
 */
export async function initDatabase(): Promise<void> {
  await getDatabase();
  // Database is ready to use
}
