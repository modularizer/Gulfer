/**
 * Storage Setup
 * 
 * Parent setup function that handles full database initialization including:
 * 1. Database schema setup (migrations)
 * 2. Services initialization
 * 3. Sports registration
 * 
 * Usage:
 * ```ts
 * import { setupStorage } from '@/storage/setup';
 * import { golf } from '@/sports/golf';
 * 
 * // Auto-select adapter based on platform
 * const storage = await setupStorage('my-database', { sports: { golf } });
 * 
 * // Explicitly specify adapter
 * const storage = await setupStorage('my-database', { 
 *   adapterType: 'pglite',
 *   sports: { golf } 
 * });
 * 
 * // Use services
 * const players = await storage.playerService.getAllPlayers();
 * 
 * // Access registered sports (as properties)
 * const golfSport = storage.sports.golf; // Direct property access
 * ```
 */

import { setupSchemaByName } from './schema';
import { SportsDataServices } from './schema/generic-sports-data';
import type { Sport } from './schema/generic-sports-data/sports';
import type { AdapterType } from '../xp-deeby/adapters';
import { golf } from './sports';

/**
 * Set up storage with database and services
 * 
 * This function:
 * 1. Sets up the database schema (runs migrations)
 * 2. Initializes all services
 * 3. Registers the provided sports
 * 
 * @param name - The name of the database (without .db extension)
 * @param options - Optional configuration object
 * @param options.sports - Record mapping property names to sport instances
 * @param options.adapterType - Optional adapter type. If not provided, auto-selects based on platform
 * @returns Sports data services
 * 
 * @example
 * ```ts
 * import { setupStorage } from '@/storage/setup';
 * import { golf } from '@/sports/golf';
 * 
 * // Auto-select adapter based on platform
 * const storage = await setupStorage('my-app', { sports: { golf } });
 * 
 * // Explicitly specify adapter
 * const storage = await setupStorage('my-app', { 
 *   adapterType: 'pglite',
 *   sports: { golf } 
 * });
 * ```
 */
export async function setupStorage(
  name: string,
  options?: {
    sports?: Record<string, Sport>;
    adapterType?: AdapterType;
  }
): Promise<SportsDataServices> {
  const { sports, adapterType } = options || {};
  
  // Step 1: Set up database schema (CREATE scripts + migrations)
  // This will:
  // - Run CREATE IF NOT EXISTS scripts for both generic-sports-data and accounts
  // - Run any pending migrations for both modules
  const db = await setupSchemaByName(name, adapterType);
  
  // Step 2: Initialize services
  const services = new SportsDataServices(db);

  // Step 3: Register sports (default to golf if none provided)
  const sportsToRegister = sports ?? { golf };
  if (Object.keys(sportsToRegister).length > 0) {
    await services.sports.registerAll(sportsToRegister);
  }
  
  return services;
}


