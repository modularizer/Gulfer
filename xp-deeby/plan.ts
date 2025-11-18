import {ColumnBuilder, Dialect} from "drizzle-orm";
import {z} from "zod";
import {DrizzleTable} from "./adapters/abstract/types";


class XPColumn {
    dialect: Dialect | undefined; // dialect of olumn does not need to be defined right away
    name: string | undefined; // name of column does not need to be defined right away
    drizzleTable: DrizzleTable | undefined;
    table: XpTable | undefined; // table the column is in can be defined if you wish;
    schema: z.Schema | undefined; // zod schema, optional
    implementation: SQLImplementation | undefined;
    drizzleDatabaseConnection: DrizzleDatabaseConnection | undefined;
    connection: XpDatabaseConnection | undefined; // can optionally have a connection;
}



// step 1. make custom types and define