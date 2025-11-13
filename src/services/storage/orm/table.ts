import {TableConfig, ResolvedTableConfig} from "@services/storage/orm/types";

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
            foreignKeys: []
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


    }

    // overload 1: builder callback
    unique(builder: (table: TableConfigBuilder<T>, enforce?: boolean) => (Array<keyof T | string>)): this;

    // overload 2: list of fields
    unique(...fields: (keyof T | string)[]): this;

    // overload 3: list of fields
    unique(fields: (keyof T | string)[], enforce?: boolean): this;
    // single implementation
    unique(
        first: any,
        ...rest: any[]
    ): this {
        let fields: Array<keyof T | string> = [];
        let enforce = false;

        // CASE A: builder callback
        if (typeof first === "function") {
            const maybeEnforce = rest[0];
            if (typeof maybeEnforce === "boolean") enforce = maybeEnforce;

            fields = first(this);
        }

        // CASE B: array form
        else if (Array.isArray(first)) {
            const maybeEnforce = rest[0];
            if (typeof maybeEnforce === "boolean") enforce = maybeEnforce;

            fields = first;
        }

        // CASE C: variadic fields
        else {
            // last item may be enforce flag
            const last = rest[rest.length - 1];
            if (typeof last === "boolean") {
                enforce = last;
                rest = rest.slice(0, -1);
            }

            fields = [first, ...rest];
        }

        this.config.uniqueFieldCombos.push({
            columnNames: fields.map(c => typeof c === "string" ? c : c.columnName),
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
        return Object.fromEntries(Object.entries(this.columns).map(([k, v]) => [k, v.columnName]));
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
    cfg: Partial<TableConfig>
): TableConfigBuilder<InferTableType<T>> {
    return new TableConfigBuilder<InferTableType<T>>({...cfg, tableName, columns});
}


