/**
 * Adapter Factory
 * 
 * Creates and manages database adapters based on platform or explicit selection.
 * Uses dynamic imports to avoid loading unnecessary adapter dependencies.
 */

import type { Adapter } from './types';

let currentAdapter: Adapter | null = null;

/**
 * Detect the current platform
 */
function detectPlatform(): 'web' | 'mobile' | 'node' {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
    return 'web';
  }
  
  // Check if we're in React Native
  try {
    const { Platform } = require('react-native');
    if (Platform && Platform.OS) {
      return Platform.OS === 'web' ? 'web' : 'mobile';
    }
  } catch {
    // react-native not available
  }
  
  // Default to node for server-side
  return 'node';
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
  const platform = detectPlatform();
  if (platform === 'web') {
    // Use PGlite adapter for web (PostgreSQL in WASM, no COOP/COEP headers needed!)
    const { SqlitePgliteAdapter } = await import('./sqlite-pglite');
    currentAdapter = new SqlitePgliteAdapter();
  } else if (platform === 'mobile') {
    const { SqliteMobileAdapter } = await import('./sqlite-mobile');
    currentAdapter = new SqliteMobileAdapter();
  } else {
    // Node.js - use OPFS if available, otherwise throw error
    // (OPFS requires browser environment)
    throw new Error('Node.js platform requires explicit adapter selection. OPFS adapter requires browser environment.');
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
export async function createAdapter(platform: 'web' | 'mobile'): Promise<Adapter> {
  if (platform === 'web') {
    // Use PGlite adapter for web (PostgreSQL in WASM, no headers needed!)
    const { SqlitePgliteAdapter } = await import('./sqlite-pglite');
    return new SqlitePgliteAdapter();
  } else {
    const { SqliteMobileAdapter } = await import('./sqlite-mobile');
    return new SqliteMobileAdapter();
  }
}

/**
 * Adapter type identifiers
 */
export type AdapterType = 'sqlite-web' | 'sqlite-opfs' | 'sqlite-pglite' | 'sqlite-mobile' | 'postgres';

/**
 * Create an adapter by type string
 * 
 * @param type - The adapter type ('sqlite-web', 'sqlite-mobile', 'postgres')
 * @returns The adapter instance
 */
export async function createAdapterByType(type: AdapterType): Promise<Adapter> {
  switch (type) {
    case 'sqlite-web': {
      throw new Error('sqlite-web adapter (sql.js) has been removed. Use sqlite-opfs for efficient persistent SQLite in the browser.');
    }
    case 'sqlite-opfs': {
      const { SqliteOpfsAdapter } = await import('./sqlite-opfs');
      return new SqliteOpfsAdapter();
    }
    case 'sqlite-pglite': {
      const { SqlitePgliteAdapter } = await import('./sqlite-pglite');
      return new SqlitePgliteAdapter();
    }
    case 'sqlite-mobile': {
      const { SqliteMobileAdapter } = await import('./sqlite-mobile');
      return new SqliteMobileAdapter();
    }
    case 'postgres': {
      const { PostgresAdapter } = await import('./postgres');
      return new PostgresAdapter();
    }
    default:
      throw new Error(`Unknown adapter type: ${type}`);
  }
}

/**
 * Get or create adapter, optionally by type
 * 
 * @param type - Optional adapter type. If not provided, auto-selects based on platform
 * @returns The adapter instance
 */
export async function getAdapterByType(type?: AdapterType): Promise<Adapter> {
  if (type) {
    // Create and set adapter by type
    const adapter = await createAdapterByType(type);
    currentAdapter = adapter;
    return adapter;
  }
  
  // Auto-select based on platform
  return await getAdapter();
}

