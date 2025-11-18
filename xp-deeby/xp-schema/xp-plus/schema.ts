import {Schema} from "../xp-sql/schema";
import {Table} from "drizzle-orm";
import {DbConnectionInfo} from "../xp-sql/drivers/types";
import {connect, XPDatabaseConnectionPlus} from "./database";

export class XPSchemaPlus extends Schema<Record<string, Table>> {
    // @ts-ignore
    connect(connectionInfo: DbConnectionInfo): Promise<XPDatabaseConnectionPlus> {
        return connect(connectionInfo, this.tables);
    }
}

export function schema(
    tables: Record<string, Table>
): XPSchemaPlus{
    return new XPSchemaPlus(tables);
}