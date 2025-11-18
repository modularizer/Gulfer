/**
 * Adapter Factory
 * 
 * Creates and manages database adapters based on platform or explicit selection.
 * Uses dynamic imports to avoid loading unnecessary adapter dependencies.
 */

import {AdapterType, defaultAdapterByHostPlatform,} from "../implementations/types";
import {Database} from "../../../xp/xp-sql-tools/database";
import {bindSchema} from "./builders";
import {detectPlatform} from "../../platform";
import {RegistryEntry} from "../abstract/capabilities";


// Cache adapters by type to reuse instances (and their connection caches)
const adapterCache = new Map<AdapterType, Database>();
// Track the current adapter type
let currentAdapterType: AdapterType | null = null;




/**
 * Create an adapter by type
 */
async function createAdapterByType(type: AdapterType): Promise<Database> {
    if (!type){
        type = defaultAdapterByHostPlatform[detectPlatform()];
    }
  switch (type) {
    case AdapterType.PGLITE: {
      const { PgliteAdapter } = await import('../implementations/pglite/database');
      return new PgliteAdapter();
    }
    case AdapterType.SQLITE_MOBILE: {
      const { SqliteMobileAdapter } = await import('../implementations/sqlite-mobile/database');
      return new SqliteMobileAdapter();
    }
    case AdapterType.POSTGRES: {
      const { PostgresAdapter } = await import('../implementations/postgres/database');
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
export async function getAdapter(type?: AdapterType): Promise<Database> {
    if (!type){
        type = defaultAdapterByHostPlatform[detectPlatform()];
    }
    currentAdapterType = type;
    if (adapterCache.has(type)) {
      return adapterCache.get(type)!;
    }
    const adapter = await createAdapterByType(type);
    adapterCache.set(type, adapter);
    return adapter;
}




export async function makeRegistryEntry(name: string, adapterType?: AdapterType): Promise<RegistryEntry> {
    const adapter = await getAdapter(adapterType); // Auto-selects based on platform
    //@ts-ignore
    const entry = await adapter.makeRegistryEntry(name)!;

    //@ts-ignore
    await registerDatabaseEntry(entry);
    return entry;
}


export async function openFromRegistry(entry: RegistryEntry): Promise<Database> {
    // Get the adapter for the type found in registry
    const adapter = await getAdapter(entry!.adapterType as AdapterType);

    bindSchema(entry!.adapterType as AdapterType);

    // Open database from registry
    await adapter.openFromRegistry(entry!);

    // Return the adapter itself (it implements DrizzleDatabase via passthrough)
    return adapter;
}




/**
 * Get the current adapter type
 * @returns The current adapter type, or null if no adapter has been created yet
 */
export function getCurrentAdapterType(): AdapterType | null {
    return currentAdapterType;
}


export async function getDatabaseByName(name: string, adapterType?: AdapterType): Promise<Database> {
    let entry = await getRegistryEntry(name);

    // If not found, create a new entry using the default adapter for the platform
    if (!entry) {
        //@ts-ignore
        entry = await makeRegistryEntry(name, adapterType);
    }
    return openFromRegistry(entry!);
}


export async function makeDatabaseByName(name: string, adapterType?: AdapterType): Promise<Database> {
    return getDatabaseByName(name, adapterType);
}
