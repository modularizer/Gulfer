import { PGlite } from '@electric-sql/pglite';
import {connectFn, DbConnectionInfo, DrizzleDatabaseConnection} from "../types";
import { drizzle } from "drizzle-orm/pglite";


export interface PgliteConnectionInfo extends DbConnectionInfo {
    name: string;
}

const connectToPglite: connectFn<PgliteConnectionInfo> = async ({name}: PgliteConnectionInfo)  => {
    const pgliteDb = await PGlite.create(`idb://pglite/${name}`);
    const db = drizzle(pgliteDb) as any;
    db.raw = pgliteDb;
    db.connInfo = {name, dialectName: 'pg'};
    db.dialectName = 'pg';
    db.close = () => Promise.resolve();
    db.deleteDatabase = async (conn: PgliteConnectionInfo) => {
        // @ts-ignore
        const name = (conn ?? this.connInfo).name;
        const indexedDB = typeof window !== 'undefined' ? window.indexedDB : null;
        if (!indexedDB) {
            throw new Error('IndexedDB is not available');
        }

        // PGlite stores databases as idb://{name}, which creates IndexedDB DBs at /pglite/{name}
        const indexedDbName = `/pglite/${name}`;
        await new Promise<void>((resolve, reject) => {
            const deleteRequest = indexedDB.deleteDatabase(indexedDbName);
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = () => reject(deleteRequest.error);
            deleteRequest.onblocked = () => {
                // Database is blocked, wait a bit and try again
                setTimeout(() => {
                    const retryRequest = indexedDB.deleteDatabase(indexedDbName);
                    retryRequest.onsuccess = () => resolve();
                    retryRequest.onerror = () => reject(retryRequest.error);
                }, 100);
            };
        });
    }
    return db as DrizzleDatabaseConnection<PgliteConnectionInfo>;
}


export default connectToPglite;