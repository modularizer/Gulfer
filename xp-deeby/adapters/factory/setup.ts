import {initializeStorage} from "../../../xp/kv";
import {detectPlatform, PlatformName} from "../../platform";



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
    const platform = detectPlatform();

    if (platform === PlatformName.WEB) {
        // Web uses PGlite - initialize it
        const { initializePglite } = await import('../implementations/pglite/setup');
        await initializePglite().catch(() => {
            // Will retry on first use
        });
    }
    // Mobile and Node adapters don't need early initialization
}
