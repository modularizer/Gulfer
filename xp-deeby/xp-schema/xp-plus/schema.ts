import {Schema} from "../xp-sql/schema";
import {Table} from "drizzle-orm";
import {DbConnectionInfo} from "../xp-sql/drivers/types";
import {connect, XPDatabaseConnectionPlus} from "./database";
import {UnboundTable} from "../xp-sql/dialects";

export class XPSchemaPlus extends Schema<Record<string, Table  | UnboundTable>> {
    // @ts-ignore
    async connect(connectionInfo: DbConnectionInfo): Promise<XPDatabaseConnectionPlus> {
        const s = await this.bindByDialectName(connectionInfo.dialectName);
        return connect(connectionInfo, s.tables);
    }
}

export function xpschema(
    tables: Record<string, Table | UnboundTable>
): XPSchemaPlus{
    return new XPSchemaPlus(tables);
}