/**
 * Adapter Factory
 * 
 * Creates and manages database adapters based on platform or explicit selection.
 * Uses dynamic imports to avoid loading unnecessary adapter dependencies.
 */

import type { Adapter } from './types';

let currentAdapter: Adapter | null = null;
// Cache adapters by type to reuse instances (and their connection caches)
const adapterCache = new Map<AdapterType, Adapter>();

/**
 * Detect the current platform
 */
export async function detectPlatform(): Promise<PlatformName> {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
    return PlatformName.WEB;
  }
  
  // Check if we're in React Native
  try {
    const reactNative = await import('react-native');
    const { Platform } = reactNative;
    if (Platform && Platform.OS) {
      return Platform.OS === 'web' ? PlatformName.WEB : PlatformName.MOBILE;
    }
  } catch {
    // react-native not available
  }
  
  // Default to node for server-side
  return PlatformName.NODE;
}

/**
 * Get the current adapter instance
 * Creates one if it doesn't exist based on platform
 */
export async function getAdapter(): Promise<Adapter> {
  if (currentAdapter) {
    return currentAdapter;
  }

  // Auto-select based on platform
  const platform = await detectPlatform();
  if (platform === PlatformName.WEB) {
    // Use PGlite adapter for web (PostgreSQL in WASM, no COOP/COEP headers needed!)
    const { PgliteAdapter } = await import('./drivers/pglite');
    currentAdapter = new PgliteAdapter();
  } else if (platform === PlatformName.MOBILE) {
    const { SqliteMobileAdapter } = await import('./drivers/sqlite-mobile');
    currentAdapter = new SqliteMobileAdapter();
  } else {
    // Node.js - requires explicit adapter selection
    throw new Error('Node.js platform requires explicit adapter selection. Use getAdapterByType() to specify an adapter.');
  }

  return currentAdapter;
}

/**
 * Set a custom adapter
 * Useful for testing or explicit adapter selection
 */
export function setAdapter(adapter: Adapter): void {
  currentAdapter = adapter;
}

/**
 * Create an adapter for a specific platform
 */
export async function createAdapter(platform: PlatformName.WEB | PlatformName.MOBILE): Promise<Adapter> {
  if (platform === PlatformName.WEB) {
    // Use PGlite adapter for web (PostgreSQL in WASM, no headers needed!)
    const { PgliteAdapter } = await import('./drivers/pglite');
    return new PgliteAdapter();
  } else {
    const { SqliteMobileAdapter } = await import('./drivers/sqlite-mobile');
    return new SqliteMobileAdapter();
  }
}

/**
 * Platform identifiers
 */
export enum PlatformName {
  WEB = 'web',
  MOBILE = 'mobile',
  NODE = 'node'
}

/**
 * Adapter type identifiers
 */
export enum AdapterType {
  PGLITE = 'pglite',
  SQLITE_MOBILE = 'sqlite-mobile',
  POSTGRES = 'postgres'
}

/**
 * Create an adapter by type
 * 
 * @param type - The adapter type
 * @returns The adapter instance
 */
export async function createAdapterByType(type: AdapterType): Promise<Adapter> {
  switch (type) {
    case AdapterType.PGLITE: {
      const { PgliteAdapter } = await import('./drivers/pglite');
      return new PgliteAdapter();
    }
    case AdapterType.SQLITE_MOBILE: {
      const { SqliteMobileAdapter } = await import('./drivers/sqlite-mobile');
      return new SqliteMobileAdapter();
    }
    case AdapterType.POSTGRES: {
      throw new Error('PostgresAdapter is not yet implemented. Use PGLITE for web or SQLITE_MOBILE for mobile.');
    }
    default:
      throw new Error(`Unknown adapter type: ${type}`);
  }
}

/**
 * Get or create adapter, optionally by type
 * 
 * @param type - Optional adapter type. If not provided, auto-selects based on platform
 * @returns The adapter instance (cached and reused)
 */
export async function getAdapterByType(type?: AdapterType): Promise<Adapter> {
  if (type) {
    // Reuse cached adapter if available
    if (adapterCache.has(type)) {
      const adapter = adapterCache.get(type)!;
      currentAdapter = adapter;
      return adapter;
    }
    
    // Create and cache adapter by type
    const adapter = await createAdapterByType(type);
    adapterCache.set(type, adapter);
    currentAdapter = adapter;
    return adapter;
  }
  
  // Auto-select based on platform
  return await getAdapter();
}

