import {Condition, Database, ResolvedCondition, UnresolvedCondition, UpsertResult} from "./database";
import {Table} from "../../xp-deeby/adapters/abstract/builders";
import {
    DrizzleDatabase,
    QueryResult,
    SelectQueryBuilder,
} from "../../xp-deeby/adapters/abstract/types";
import {SQL, getTableName} from "drizzle-orm";
import {AdapterCapabilities} from "../../xp-deeby/adapters/abstract/capabilities";


export class DatabaseTable {
    [key: string]: any;
    public tableName: string;

    constructor(private database: Database, private table: Table) {
        this.database = database;
        this.table = table;
        //@ts-ignore
        this.tableName = getTableName(this.table);
        for (let [k, v] of Object.entries(this.table.columns)) {
            this[k] = v;
        }
    }

    makeCreateScript({ifNotExists = true}: {ifNotExists?: boolean} = {}): string {
        let s = this.table.toSQL().sql;
        if (ifNotExists) {
            s = s.replaceAll("CREATE TABLE", "CREATE TABLE IF NOT EXISTS");
        }
        return s;
    }

    get createScript() {return this.makeCreateScript()}

    get columns(){return this.table.columns;}

    /**
     * Infer the select type from this table
     * Usage: type User = typeof users.$inferSelect;
     */
    get $inferSelect(){return this.table.$inferSelect}

    /**
     * Infer the insert type from this table
     * Usage: type UserInsert = typeof users.$inferInsert;
     */
    get $inferInsert(){return this.table.$inferInsert}

    /**
     * Get the current database instance
     * Returns the database that was opened via openFromRegistry
     */
    getDatabase(): DrizzleDatabase {
        return this.database.getDatabase();
    }

    /**
     * Passthrough DrizzleDatabase methods to this.db
     */
    execute(query: SQL): Promise<QueryResult> {
        return this.database.execute(query);
    }

    select(columns?: Record<string, any> | any[]): SelectQueryBuilder {
        return this.database.select(columns).from(this.table);
    }

    insert(values: Record<string, any> | Record<string, any>[]) {
        return this.database.insert(this.table).values(values);
    }

    update(condition: ResolvedCondition) {
        return this.database.updateWhere(this.table, condition);
    }

    delete(condition: ResolvedCondition) {
        return this.database.deleteWhere(this.table, condition);
    }
    count(condition?: ResolvedCondition): Promise<number> {
        return this.database.countWhere(this.table, condition);
    }

    selectWhere(condition: ResolvedCondition, columns?: Record<string, any> | any[]): SelectQueryBuilder {
        return this.database.selectWhere(this.table, condition, columns);
    }
    updateWhere(condition: ResolvedCondition) {
        return this.update(condition);
    }

    deleteWhere(condition: ResolvedCondition) {
        return this.delete(condition);
    }
    countWhere(condition?: ResolvedCondition) {
        return this.count(condition);
    }
    upsertWhere(value: Record<string, any>, condition: Condition): Promise<UpsertResult>;
    upsertWhere(value: Record<string, any>[], condition: UnresolvedCondition): Promise<UpsertResult[]>;
    upsertWhere(value: Record<string, any> | Record<string, any>[], condition: Condition): Promise<UpsertResult | UpsertResult[]> {
        return this.database.upsertWhere(this.table, value, condition);
    }

    /**
     * Get adapter capabilities
     * Uses the adapterCapabilities record to look up capabilities by adapter type
     */
    getCapabilities(): AdapterCapabilities {
        return this.database.getCapabilities();
    }

    /**
     * Get row count for a specific table
     * Concrete implementation that works with any adapter
     * Uses Drizzle's sql template tag for dynamic table names
     */
    async getRowCount(): Promise<number> {
        return this.count();
    }

}