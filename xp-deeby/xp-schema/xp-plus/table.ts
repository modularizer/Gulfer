import {Condition, ResolvedCondition, UnresolvedCondition, XPDatabaseConnectionPlus} from "./database";
import {SQL, type Table} from "drizzle-orm";
import {QueryResult, SelectQueryBuilder} from "../xp-sql/drivers/types";
import {UpsertResult} from "../../utils";


export class XPDatabaseTablePlus {
    [key: string]: any;
    public tableName: string;

    constructor(private database: XPDatabaseConnectionPlus, private table: Table) {
        this.database = database;
        this.table = table;
        //@ts-ignore
        this.tableName = getTableName(this.table);
        //@ts-ignore
        for (let [k, v] of Object.entries(this.table.columns)) {
            this[k] = v;
        }
    }

    createScript({ifNotExists = true}: {ifNotExists?: boolean} = {}): string {
        //@ts-ignore
        let s = this.table.toSQL().sql;
        if (ifNotExists) {
            s = s.replaceAll("CREATE TABLE", "CREATE TABLE IF NOT EXISTS");
        }
        return s;
    }


    get columns(){
        //@ts-ignore
        return this.table.columns;
    }

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
     * Passthrough DrizzleDatabase methods to this.db
     */
    execute(query: SQL): Promise<QueryResult> {
        return this.database.execute(query);
    }

    select(columns?: Record<string, any> | any[]): SelectQueryBuilder {
        //@ts-ignore
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
     * Get row count for a specific table
     * Concrete implementation that works with any adapter
     * Uses Drizzle's sql template tag for dynamic table names
     */
    async getRowCount(): Promise<number> {
        return this.count();
    }

}