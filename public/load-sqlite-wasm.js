/**
 * Load SQLite WASM from same origin
 * This avoids CORS issues with Workers
 */

(async function() {
  if (typeof window === 'undefined' || globalThis.sqlite3Worker1Promiser) {
    return;
  }

  try {
    // Load the bundler-friendly promiser which handles same-origin workers
    const promiserModule = await import('/sqlite-wasm/jswasm/sqlite3-worker1-promiser-bundler-friendly.mjs');
    
    // The module should set globalThis.sqlite3Worker1Promiser
    if (!globalThis.sqlite3Worker1Promiser) {
      console.error('sqlite3Worker1Promiser not set by module');
    }
  } catch (error) {
    console.error('Failed to load SQLite WASM:', error);
  }
})();

