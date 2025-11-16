/**
 * Adapter Factory
 * 
 * Creates and manages database adapters based on platform or explicit selection.
 * Uses dynamic imports to avoid loading unnecessary adapter dependencies.
 */

import {defaultAdapterByHostPlatform, AdapterType, PlatformName, adapterCapabilities, type AdapterCapabilities} from "./types";
import {Adapter} from "./adapter";


// Cache adapters by type to reuse instances (and their connection caches)
const adapterCache = new Map<AdapterType, Adapter>();
// Track the current adapter type
let currentAdapterType: AdapterType | null = null;


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
 * Create an adapter by type
 */
async function createAdapterByType(type: AdapterType): Promise<Adapter> {
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
      const { PostgresAdapter } = await import('./drivers/postgres');
      return new PostgresAdapter();
    }
    default:
      throw new Error(`Unknown adapter type: ${type}`);
  }
}

/**
 * Get adapter instance
 *
 * @param type - Optional adapter type. If not provided, auto-selects based on platform
 * @returns The adapter instance (cached and reused)
 */
export async function getAdapter(type?: AdapterType): Promise<Adapter> {
    if (!type){
        type = defaultAdapterByHostPlatform[await detectPlatform()];
    }
    currentAdapterType = type;
    if (adapterCache.has(type)) {
      return adapterCache.get(type)!;
    }
    const adapter = await createAdapterByType(type);
    adapterCache.set(type, adapter);
    return adapter;
}

/**
 * Get the current adapter type
 * @returns The current adapter type, or null if no adapter has been created yet
 */
export function getCurrentAdapterType(): AdapterType | null {
    return currentAdapterType;
}


