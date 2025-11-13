/**
 * Database exports
 * Export schema and database instance for direct Drizzle usage
 */

import { getDatabase, type Database } from './adapter';
import * as schema from './schema';

export { schema, getDatabase, type Database };

/**
 * Initialize database (call once at app startup)
 */
export async function initDatabase(): Promise<void> {
  await getDatabase();
  // Database is ready to use
}
