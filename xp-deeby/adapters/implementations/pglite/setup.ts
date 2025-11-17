// ============================================================================
// Early PGlite Initialization
// ============================================================================
// Pre-load PGlite module, fsBundle, and wasmModule early to avoid delays
// and MIME type issues when opening databases

import {PgDialect} from "drizzle-orm/pg-core/dialect";
import {RegistryEntry} from "./capabilities";
import {CreateDB} from "../../abstract/database";
import {DrizzleDatabase} from "../../abstract/types";
import {PgDatabase, PgPreparedQuery, PgSession} from "drizzle-orm/pg-core";



let pgliteModuleCache: any = null;
let fsBundleCache: Response | null | undefined = undefined;
let wasmModuleCache: WebAssembly.Module | null | undefined = undefined;

let initializationPromise: Promise<CreateDB> | null = null;





/**
 * Initialize PGlite early - loads module, fsBundle, and wasmModule
 * This should be called as early as possible, ideally on module import
 */
export async function initializePglite(): Promise<CreateDB>  {
    if (typeof window === 'undefined') {
        //@ts-ignore
        return (entry: RegistryEntry) => {
            throw new Error('platform not supported');
        }
    }
    // If already initializing or initialized, return the existing promise
    if (initializationPromise) {
        return initializationPromise;
    }

    //@ts-ignore
    initializationPromise = (async () => {
        try {
            // 1. Import PGlite module
            if (!pgliteModuleCache) {
                console.log('[pglite] Early initialization: Importing @electric-sql/pglite...');
                pgliteModuleCache = await import('@electric-sql/pglite');
                console.log('[pglite] PGlite module imported, keys:', Object.keys(pgliteModuleCache || {}));
            }

            // 2. Pre-load fsBundle as Response object
            if (fsBundleCache === undefined) {
                try {
                    const response = await fetch('/pglite/pglite.data');
                    if (response.ok) {
                        fsBundleCache = response;
                        console.log('[pglite] Early initialization: fsBundle loaded');
                    } else {
                        fsBundleCache = null; // Mark as attempted but failed
                        console.warn('[pglite] Early initialization: Could not load fsBundle (status:', response.status, ')');
                    }
                } catch (error) {
                    fsBundleCache = null; // Mark as attempted but failed
                    console.warn('[pglite] Early initialization: Error loading fsBundle:', error);
                }
            }

            // 3. Pre-load and compile WASM module
            if (wasmModuleCache === undefined) {
                try {
                    const wasmResponse = await fetch('/pglite/pglite.wasm');
                    if (wasmResponse.ok) {
                        const wasmArrayBuffer = await wasmResponse.arrayBuffer();
                        wasmModuleCache = await WebAssembly.compile(wasmArrayBuffer);
                        console.log('[pglite] Early initialization: WASM module compiled');
                    } else {
                        wasmModuleCache = null; // Mark as attempted but failed
                        console.warn('[pglite] Early initialization: Could not load WASM (status:', wasmResponse.status, ')');
                    }
                } catch (error) {
                    wasmModuleCache = null; // Mark as attempted but failed
                    console.warn('[pglite] Early initialization: Error loading WASM:', error);
                }
            }

            if (!pgliteModuleCache) {
                throw new Error('Failed to import @electric-sql/pglite: module is undefined');
            }

            // Extract PGlite class from module
            let PGlite: any = pgliteModuleCache.PGlite;

            if (!PGlite && 'PGlite' in pgliteModuleCache) {
                console.warn('[pglite] PGlite key exists but value is undefined/null');
                try {
                    PGlite = pgliteModuleCache['PGlite'];
                } catch (e) {
                    console.error('[pglite] Error accessing PGlite:', e);
                }
            }

            if (!PGlite && pgliteModuleCache.default) {
                if (typeof pgliteModuleCache.default === 'object') {
                    PGlite = pgliteModuleCache.default.PGlite;
                } else if (typeof pgliteModuleCache.default === 'function') {
                    PGlite = pgliteModuleCache.default;
                }
            }

            if (!PGlite) {
                console.error('[pglite] PGlite module contents:', Object.keys(pgliteModuleCache));
                throw new Error(`Failed to find PGlite in @electric-sql/pglite module. Available exports: ${Object.keys(pgliteModuleCache).join(', ')}`);
            }


            // Create a minimal prepared query wrapper that uses PGlite's query method
            class PglitePreparedQuery extends PgPreparedQuery {
                private client: any;
                private dialect: any;
                private fields: any;
                private customResultMapper: any;
                constructor(client: any, dialect: any, query: any, fields: any, name: any, isResponseInArrayMode: any, customResultMapper: any, queryMetadata: any, cacheConfig: any) {
                    super(query, undefined, queryMetadata, cacheConfig);
                    this.client = client;
                    this.dialect = dialect;
                    this.fields = fields;
                    this.customResultMapper = customResultMapper;
                }

                async execute(): Promise<any> {
                    const queryObj = this.getQuery();
                    if (!queryObj || typeof queryObj !== 'object' || !('sql' in queryObj)) {
                        throw new Error('Invalid query object from getQuery()');
                    }

                    const sql = queryObj.sql;
                    const params = queryObj.params || [];

                    // Use PGlite's query method directly
                    const result = await this.client.query(sql, params);

                    // Map result to Drizzle format
                    if (this.fields && this.fields.length > 0) {
                        const mapped = result.rows.map((row: any) => {
                            const mappedRow: any = {};
                            for (const field of this.fields) {
                                const fieldName = field.name;
                                if (fieldName in row) {
                                    mappedRow[fieldName] = row[fieldName];
                                }
                            }
                            return mappedRow;
                        });

                        if (this.customResultMapper) {
                            return this.customResultMapper(mapped);
                        }
                        return mapped;
                    }

                    return result.rows;
                }
            }

            class PgliteSession extends PgSession {
                private client: any;
                private dialect: any;

                constructor(client: any, dialect: any) {
                    super(dialect, undefined, undefined);
                    this.client = client;
                    this.dialect = dialect;
                }

                prepareQuery(query: any, fields: any, name: any, isResponseInArrayMode: any, customResultMapper: any, queryMetadata: any, cacheConfig: any): PglitePreparedQuery {
                    return new PglitePreparedQuery(this.client, this.dialect, query, fields, name, isResponseInArrayMode, customResultMapper, queryMetadata, cacheConfig);
                }

                async transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
                    // PGlite doesn't support transactions in the same way, so just execute the function
                    return await callback(this);
                }
            }

            return async ({name}: RegistryEntry) =>{
                // Use cached fsBundle and wasmModule (loaded during early initialization)
                const pglite = new PGlite(`idb://${name}`, {
                    ...(fsBundleCache ? { fsBundle: fsBundleCache } : {}),
                    ...(wasmModuleCache ? { wasmModule: wasmModuleCache } : {}),
                });

                await pglite.waitReady;

                const dialect = new PgDialect({ casing: 'snake_case' });

                const session = new PgliteSession(pglite, dialect);
                const db = new PgDatabase(dialect, session, undefined) as any;
                (db as any)._pglite = pglite;
                return {db: db as DrizzleDatabase, client: session};
            }
        } catch (error) {
            console.error('[pglite] Early initialization failed:', error);
            throw error;
        }
    })();

    return initializationPromise;
}




// Only initialize in browser environment
initializePglite().catch((error) => {
    console.warn('[pglite] Auto-initialization failed (will retry on first use):', error);
});


