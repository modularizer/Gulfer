import {Schema, SchemaWithTables} from "../xp-sql/schema";
import {Table} from "drizzle-orm";
import {DbConnectionInfo} from "../xp-sql/drivers/types";
import {connect, XPDatabaseConnectionPlus} from "./database";
import {UnboundTable} from "../xp-sql/dialects";

/**
 * XPSchemaPlus with tables exposed as properties
 * This type allows tables to be accessed as properties (e.g., schema.users, schema.posts)
 */
export type XPSchemaPlusWithTables<Tables extends Record<string, Table | UnboundTable>> = 
  XPSchemaPlus<Tables> & {
    readonly [K in keyof Tables]: Tables[K];
  };

export class XPSchemaPlus<Tables extends Record<string, Table | UnboundTable> = Record<string, Table | UnboundTable>> extends Schema<Tables> {
    async connect(connectionInfo: DbConnectionInfo): Promise<XPDatabaseConnectionPlus> {
        const s = await this.bindByDialectName(connectionInfo.dialectName);
        return connect(connectionInfo, s.tables);
    }
}

export function xpschema<Tables extends Record<string, Table | UnboundTable>>(
    tables: Tables
): XPSchemaPlusWithTables<Tables> {
    return new XPSchemaPlus(tables) as XPSchemaPlusWithTables<Tables>;
}