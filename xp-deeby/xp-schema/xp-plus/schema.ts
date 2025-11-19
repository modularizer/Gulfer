import {Schema} from "../xp-sql/schema";
import {Table} from "drizzle-orm";
import {DbConnectionInfo} from "../xp-sql/drivers/types";
import {connect, XPDatabaseConnectionPlus} from "./database";
import {UTable} from "../xp-sql/dialects";

/**
 * XPSchemaPlus with tables exposed as properties
 * This type allows tables to be accessed as properties (e.g., schema.users, schema.posts)
 */
export type XPSchemaPlusWithTables<Tables extends Record<string, Table | UTable<any>>> =
  XPSchemaPlus<Tables> & {
    readonly [K in keyof Tables]: Tables[K];
  };

export class XPSchemaPlus<Tables extends Record<string, Table | UTable<any>> = Record<string, Table | UTable<any>>> extends Schema<Tables> {
    async connect(connectionInfo: DbConnectionInfo): Promise<XPDatabaseConnectionPlus> {
        const s = await this.bindByDialectName(connectionInfo.dialectName);
        return connect(connectionInfo, s.tables);
    }
}

export function xpschema<Tables extends Record<string, Table | UTable<any>>>(
    tables: Tables
): XPSchemaPlusWithTables<Tables> {
    return new XPSchemaPlus(tables) as XPSchemaPlusWithTables<Tables>;
}