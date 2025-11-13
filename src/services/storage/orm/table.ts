import { z } from 'zod';
import {TableConfig, ResolvedTableConfig, ColumnConfig, RecordDump, RecordLoad, RecordCheck, ResolvedColumnConfig, Columns} from "@services/storage/orm/types";
import {ColumnConfigBuilder} from "@services/storage/orm/column";

/**
 * Storage service registry
 * Tracks all storage services to enable cascade deletes and foreign key lookups
 */
export const tableConfigRegistry = new Map<string, TableConfigBuilder>();
export const getFullTableName = (tableName: string, schemaName?: string) => schemaName ? `"${schemaName}"."${tableName}"` : `"${tableName}"`
/**
 * Builder for creating TableConfig
 */
export class TableConfigBuilder<T = Record<string, any>> {
    public config!: ResolvedTableConfig<T>;
    public fullName!: string;
    private _columnNames: Record<keyof T, string> = {};
    private _columnDisplayNames: Record<string, keyof T>= {};

    constructor(
        cfg: TableConfig<T>
    ) {
        this.config = {
            ...cfg,
            columns: Object.fromEntries(Object.values(cfg.columns).map(([k, v]) => [k, v.assignToTable(cfg.tableName)])),
            checks: cfg.checks ?? [],
            dump: cfg.dump ?? ((x) => x),
            load: cfg.load ?? ((x) => x),
            uniqueFieldCombos: cfg.uniqueFieldCombos ?? [],
            foreignKeys: [],
            schema: z.object(Object.fromEntries(Object.values(cfg.columns).map(([k, v]) => [k, v.schema])))
        }
        this.fullName = getFullTableName(cfg.tableName, cfg.schemaName);
        if (tableConfigRegistry[this.fullName]) {
            throw new Error(`Table named ${this.fullName} is already registered`)
        }
        tableConfigRegistry[this.fullName] = this;
        for (let ft of Object.values(tableConfigRegistry)){
            if (ft.foreignKeys.length > 0) {
                ft.foreignKeys.filter((f) => (!f.referencesColumn) && (this.config.tableName === f.referencesTableName) && (this.config.schemaName === f.referencesSchemaName)).map(
                    (fk) => {
                        const col = this.config.columns[fk.referencesColumnName];
                        if (!col){
                            throw new Error(`Column ${fk.referencesColumnName} is referenced by a fk but does not exist`)
                        }
                        fk.referencesColumn = col;
                    }
                );
            }
        }


        this.config.foreignKeys = Object.values(this.columns).filter(c => c.fkConfig).map(c => {
            const fc = c.fkConfig;
            const k = getFullTableName(fc.referencesTableName, fc.referencesSchemaName);
            const foreignTable = tableConfigRegistry[k]
            const referencesColumn = foreignTable? foreignTable.config.columns[c.fkConfig.referencesColumnName]:undefined;
            if (foreignTable && !referencesColumn){
                throw new Error(`Column ${fc.referencesColumnName} is referenced by a fk but does not exist`);
            }
            return {
                ...fc,
                referencesColumn,
                column: c.config
            }
        });

        this._columnNames = Object.fromEntries(Object.entries(this.columns).map(([k, v]) => [k, v.columnName]));
        this._columnDisplayNames = Object.fromEntries(Object.entries(this.columns).map(([k, v]) => [v.columnName, k]));

    }

    // overload 1: builder callback
    unique(builder: (columnNames: Record<keyof T, string>, enforce?: boolean) => (Array<keyof T | string>)): this;

    // overload 2: list of columns
    unique(...columns: Columns): this;

    // overload 3: list of columns
    unique(columns: Columns, enforce?: boolean): this;
    // single implementation
    unique(
        first: any,
        ...rest: any[]
    ): this {
        let columns: Array<keyof T | string> = [];
        let enforce = false;

        // CASE A: builder callback
        if (typeof first === "function") {
            const maybeEnforce = rest[0];
            if (typeof maybeEnforce === "boolean") enforce = maybeEnforce;

            columns = first(this);
        }

        // CASE B: array form
        else if (Array.isArray(first)) {
            const maybeEnforce = rest[0];
            if (typeof maybeEnforce === "boolean") enforce = maybeEnforce;

            columns = first;
        }

        // CASE C: variadic columns
        else {
            // last item may be enforce flag
            const last = rest[rest.length - 1];
            if (typeof last === "boolean") {
                enforce = last;
                rest = rest.slice(0, -1);
            }

            columns = [first, ...rest];
        }

        this.config.uniqueFieldCombos.push({
            columnNames: this.resolveComunNames(columns),
            enforceUnique: enforce
        });

        return this;
    }


    withSerializer(dump: RecordDump<T>): this {
        this.config.dump = dump;
        return this;
    }

    withLoader(load: RecordLoad<T>): this {
        this.config.load = load
        return this;
    }

    check(check: RecordCheck<T>): this {
        this.config.checks.push(check);
        return this;
    }

    get columns(): Record<keyof T, ResolvedColumnConfig> {
        return this.config.columns;
    }

    get columnNames(): Record<keyof T, string> {
        return this._columnNames;
    }

    get columnDisplayNames(): Record<string, keyof T> {
        return this._columnDisplayNames;
    }


    resolveColumnName(column: ColumnConfig | ColumnConfigBuilder | string): string{
        if (typeof column === "string") {
            return this._columnNames[column] ?? column;
        }
        if (column.config){
            column = column.config;
        }
        return column.columnName;
    }

    resolveColumnNames(columns: (ColumnConfig | ColumnConfigBuilder | string)[] | '*'): string{
        if (columns === '*'){
            return Object.values(this._columnNames);
        }
        return columns.map(this.resolveColumnName.bind(this))
    }
}

/**
 * Helper type to infer the table type from column builders
 */
type InferTableType<T extends Record<string, ColumnConfigBuilder<any>>> = {
    [K in keyof T]: T[K] extends ColumnConfigBuilder<infer U> ? U : never;
};

/**
 * Helper function to create a TableConfigBuilder
 * The table type T is inferred from the column builders
 */
export function table(
    tableName: string,
    columns: T,
    cfg: Partial<TableConfig> = {}
): TableConfigBuilder<InferTableType<T>> {
    return new TableConfigBuilder<InferTableType<T>>({...cfg, tableName, columns});
}


