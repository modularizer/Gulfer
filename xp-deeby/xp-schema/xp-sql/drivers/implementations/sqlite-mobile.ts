// sqlite-mobile.ts
import * as SQLite from "expo-sqlite";
import * as FileSystem from "expo-file-system";
import { drizzle } from "drizzle-orm/expo-sqlite";
import {
    DrizzleDatabaseConnectionDriver,
    connectFn,
    DbConnectionInfo, XPDriverImpl,
} from "../types";
import {SQL} from "drizzle-orm";
import {PlatformName} from "../../../platform";



export type SqliteMobileConnectionInfo = DbConnectionInfo & {
    name: string;
    enableForeignKeys?: boolean;
};


function getExpoDb(info: SqliteMobileConnectionInfo): SQLite.SQLiteDatabase {

    // name-branch
    return SQLite.openDatabaseSync(info.name);
}

const driverDetails = {
    dialectName: 'sqlite',
    driverName: 'sqlite-mobile',
    clientPlatforms: {
        [PlatformName.WEB]: false,
        [PlatformName.MOBILE]: true,
        [PlatformName.NODE]: false,
    },
    hostPlatforms: {
        [PlatformName.WEB]: false,
        [PlatformName.MOBILE]: true,
        [PlatformName.NODE]: false,
    },
}

const connectToSqliteMobile: connectFn<SqliteMobileConnectionInfo> = async (
    info: SqliteMobileConnectionInfo
) => {
    const expoDb = getExpoDb(info);
    const db = drizzle(expoDb) as any; // ExpoSQLiteDatabase

    db.raw = expoDb;
    // Polyfill `.execute` using `.run`
    db.execute ??= (query: SQL) => db.run(query);
    db.connInfo = { ...info, dialectName: 'sqlite', driverName: 'sqlite-mobile' };
    Object.assign(db, driverDetails);

    if (info.enableForeignKeys) {
        await db.execute(`PRAGMA foreign_keys = ON` as unknown as SQL);
    }
    db.deleteDatabase = async (conn: SqliteMobileConnectionInfo) => {
        // Works only when DB was opened by name
        if (!("name" in conn)) {
            throw new Error("deleteDatabase can only be used when opening by name");
        }

        const fileName = conn.name.endsWith(".db")
            ? info.name
            : `${info.name}.db`;

        const dbPath = `${FileSystem.documentDirectory}SQLite/${fileName}`;

        // 1. Close SQLite connection
        // @ts-ignore
        if (this.connInfo.name === conn.name){
            // @ts-ignore
            this.close();
        }

        // 2. Delete the file
        const fileInfo = await FileSystem.getInfoAsync(dbPath);
        if (fileInfo.exists) {
            await FileSystem.deleteAsync(dbPath, { idempotent: true });
        }
    };

    return db as DrizzleDatabaseConnectionDriver<SqliteMobileConnectionInfo>;
};

export const sqliteDriver: XPDriverImpl = {
    ...driverDetails,
    // @ts-ignore
    connect: connectToSqliteMobile,
}

export default connectToSqliteMobile;