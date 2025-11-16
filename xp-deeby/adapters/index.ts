// ============================================================================
// Schema Definitions (Database-agnostic)
// ============================================================================
// These are generic schema functions that must be bound to a driver's schema.
// 
// Usage:
// ```ts
// import { bindSchema } from './adapters';
// import { schema as postgresSchema } from './adapters/drivers/postgres';
// bindSchema(postgresSchema);
// 
// // Now use schema functions
// import { table, text, varchar } from './adapters';
// ```
export {
  table, text, varchar, integer, real, timestamp, jsonb, unique, index, bool, uuid, uuidPK, uuidDefault,
  bindSchema
} from './schema';

// Export schema builders from drivers

export type { SchemaBuilder } from './schema-builder';

export {getAdapter, getCurrentAdapterType, detectPlatform} from './factory'

export { Adapter } from './adapter';
export type { RegistryEntry } from './types';
export { AdapterType, PlatformName, Dialect } from './types';



// ============================================================================
// Adapter Implementations
// ============================================================================
// Note: Adapter classes are NOT exported directly to avoid loading
// unnecessary dependencies. Use the factory function:
// - getAdapter(type?) - auto-selects based on platform, or use specific type
//
// If you need direct access to adapter classes, import them explicitly:
// import { PgliteAdapter } from './drivers/pglite';

// ============================================================================
// Database Registry
// ============================================================================
export { registerDatabaseEntry, getRegistryEntries, saveRegistryEntries } from './registry-storage';

// ============================================================================
// Early Initialization
// ============================================================================
// Export initialization functions for early setup
export { initializePglite } from './drivers/pglite';
export { initializeStorage } from '../kv';

/**
 * Initialize adapters and registry early
 * This sets up the appropriate adapter for the current platform and KV storage (registry)
 * Should be called as early as possible, ideally on app startup
 */
export async function initializeAdapters(): Promise<void> {
  // Initialize storage (registry) - needed for all platforms
  await initializeStorage().catch(() => {
    // Will retry on first use
  });
  
  // Detect platform and initialize only the appropriate adapter
  const platform = await detectPlatform();
  
  if (platform === PlatformName.WEB) {
    // Web uses PGlite - initialize it
    const { initializePglite } = await import('./drivers/pglite');
    await initializePglite().catch(() => {
      // Will retry on first use
    });
  }
  // Mobile and Node adapters don't need early initialization
}

// Auto-initialize on module import (non-blocking)
// This runs immediately when this module is imported
// Only initializes the adapter for the current platform
if (typeof window !== 'undefined') {
  // Detect platform and initialize only the appropriate adapter
  (async () => {
    try {
      const platform = await detectPlatform();
      
      // Initialize storage (registry) - needed for all platforms
      await initializeStorage().catch(() => {
        // Will retry on first use
      });
      
      // Only initialize the adapter for the current platform
      if (platform === PlatformName.WEB) {
        // Web uses PGlite
        const { initializePglite } = await import('./drivers/pglite');
        await initializePglite().catch(() => {
          // Will retry on first use
        });
      } else if (platform === PlatformName.MOBILE) {
        // Mobile uses SQLite Mobile - no early init needed
        // SQLite Mobile doesn't need pre-loading like PGlite
      } else {
        // Node uses Postgres - no early init needed
      }
    } catch (error) {
      console.warn('[adapters] Auto-initialization failed (will retry on first use):', error);
    }
  })();
}



// ============================================================================
// Postgres Connection Types
// ============================================================================
export type { PostgresConnectionConfig } from './drivers/postgres';