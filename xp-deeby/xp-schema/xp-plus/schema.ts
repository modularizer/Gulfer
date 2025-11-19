import {Schema} from "../xp-sql/schema";
import {Table} from "drizzle-orm";
import {DbConnectionInfo} from "../xp-sql/drivers/types";
import {connect, XPDatabaseConnectionPlus} from "./database";
import {UTable} from "../xp-sql/dialects";
import {genTypesScript} from "../utils/generate-types";
import {genCreateScript} from '../utils/generate-create-script';

/**
 * XPSchemaPlus with tables exposed as properties
 * This type allows tables to be accessed as properties (e.g., schema.users, schema.posts)
 */
export type XPSchemaPlusWithTables<Tables extends Record<string, Table | UTable<any>>> =
  XPSchemaPlus<Tables> & {
    readonly [K in keyof Tables]: Tables[K];
  };

export class XPSchemaPlus<Tables extends Record<string, Table | UTable<any>> = Record<string, Table | UTable<any>>> extends Schema<Tables> {
    constructor(tables: Tables, public anchor?: string) {
        super(tables);
    }

    async gen({src, dst, types = true, creates = ['pg', 'sqlite']}: {src?: string, dst?: string, types?: boolean, creates?: string[] | boolean | undefined | null} = {}) {
        if (types){
            await this.genTypesScript(src, dst);
        }
        if (creates){
            await this.genCreateScript(src, dst, (creates === true)?undefined:creates);
        }
    }
    async genTypesScript(anchor?: string, dst?: string) {
        const a = anchor ?? this.anchor;
        if (!a){throw new Error('must provide filename')}
        return genTypesScript(a, dst);
    }
    async genCreateScript(anchor?: string, dst?: string, dialects?: string[]){
        const a = anchor ?? this.anchor;
        if (!a){throw new Error('must provide filename')}
        return genCreateScript(a, dst, dialects);
    }

    async connect(connectionInfo: DbConnectionInfo): Promise<XPDatabaseConnectionPlus> {
        const s = await this.bindByDialectName(connectionInfo.dialectName);
        return connect(connectionInfo, s.tables);
    }
}

export function xpschema<Tables extends Record<string, Table | UTable<any>>>(
    tables: Tables,
    anchor?: string
): XPSchemaPlusWithTables<Tables> {
    return new XPSchemaPlus(tables, anchor) as XPSchemaPlusWithTables<Tables>;
}