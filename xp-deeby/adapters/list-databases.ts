/**
 * List Available Databases
 *
 * Cross-platform functions to list available databases.
 */
import { getAdapterByType, detectPlatform, PlatformName } from "./factory";
import { getDatabaseRegistryEntries, removeFromRegistry } from "./registry-storage";



/**
 * List all available database names for a specific platform
 * Verifies each database exists using its stored adapter type.
 * 
 * @param platform - Platform to list databases for
 */
export async function listDatabasesWeb(): Promise<string[]> {
  return await listDatabasesForPlatform(PlatformName.WEB);
}

/**
 * List all available database names for mobile platform
 */
export async function listDatabasesMobile(): Promise<string[]> {
  return await listDatabasesForPlatform(PlatformName.MOBILE);
}

/**
 * List all available database names for node platform
 */
export async function listDatabasesNode(): Promise<string[]> {
  return await listDatabasesForPlatform(PlatformName.NODE);
}

/**
 * Internal function to list databases for a specific platform
 */
async function listDatabasesForPlatform(platform: PlatformName): Promise<string[]> {
  // Get registry of known databases with their adapter types
  const knownDatabases = await getDatabaseRegistryEntries();
  
  // Verify each known database exists using its stored adapter type
  const existingDatabases: string[] = [];
  for (const entry of knownDatabases) {
    try {
      // Use the exact adapter type that was used to create the database
      const adapter = await getAdapterByType(entry.adapterType);
      if (!adapter.getDatabaseByName) {
        console.warn(`[listDatabases] Adapter ${entry.adapterType} does not support getDatabaseByName`);
        await removeFromRegistry(entry.name);
        continue;
      }
      const db = await adapter.getDatabaseByName(entry.name);
      if (db) {
        existingDatabases.push(entry.name);
        console.log(`[listDatabases] Found database ${entry.name} using ${entry.adapterType} adapter`);
      } else {
        console.warn(`[listDatabases] Database ${entry.name} returned null from ${entry.adapterType} adapter`);
        await removeFromRegistry(entry.name);
      }
    } catch (error) {
      // Database doesn't exist or can't be opened with its stored adapter type
      console.warn(`[listDatabases] Database ${entry.name} (${entry.adapterType}) no longer exists, removing from registry:`, error);
      await removeFromRegistry(entry.name);
    }
  }

  // Return all existing databases (don't filter empty ones - let user see them)
  return existingDatabases;
}

/**
 * List all available database names
 * Platform-aware wrapper that auto-detects the current platform
 */
export async function listDatabases(platform?: PlatformName): Promise<string[]> {
  // If platform is not specified, auto-detect
  const targetPlatform = platform || await detectPlatform();
  
  if (targetPlatform === PlatformName.WEB) {
    return await listDatabasesWeb();
  } else if (targetPlatform === PlatformName.MOBILE) {
    return await listDatabasesMobile();
  } else {
    return await listDatabasesNode();
  }
}


