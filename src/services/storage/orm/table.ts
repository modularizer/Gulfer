import { z } from 'zod';
import {TableConfig, ResolvedTableConfig, ColumnConfig, RecordDump, RecordLoad, RecordCheck, ResolvedColumnConfig, Columns} from "@services/storage/orm/types";
import {ColumnConfigBuilder} from "@services/storage/orm/column";
import { TableDriver } from './TableDriver';
import { IStorageDriver } from '../drivers/IStorageDriver';
import { defaultStorageDriver } from '../drivers/LocalStorageDriver';

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
        
        // Initialize column name mappings early so they can be used in foreign key resolution
        this._columnNames = Object.fromEntries(Object.entries(this.columns).map(([k, v]) => [k, v.columnName]));
        this._columnDisplayNames = Object.fromEntries(Object.entries(this.columns).map(([k, v]) => [v.columnName, k]));
        
        if (tableConfigRegistry[this.fullName]) {
            throw new Error(`Table named ${this.fullName} is already registered`)
        }
        tableConfigRegistry[this.fullName] = this;
        for (let ft of Object.values(tableConfigRegistry)){
            if (ft.foreignKeys.length > 0) {
                ft.foreignKeys.filter((f) => (!f.referencesColumn) && (this.config.tableName === f.referencesTableName) && (this.config.schemaName === f.referencesSchemaName)).map(
                    (fk) => {
                        // fk.referencesColumnName is a columnName, but this.config.columns is keyed by keyNames
                        // Need to find the keyName that corresponds to this columnName
                        const keyName = this._columnDisplayNames[fk.referencesColumnName];
                        if (!keyName) {
                            throw new Error(`Column ${fk.referencesColumnName} is referenced by a fk but does not exist in table ${this.config.tableName}`)
                        }
                        const col = this.config.columns[keyName];
                        if (!col){
                            throw new Error(`Column ${fk.referencesColumnName} (keyName: ${String(keyName)}) is referenced by a fk but does not exist`)
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
            // fc.referencesColumnName is a columnName, but foreignTable.config.columns is keyed by keyNames
            // Need to find the keyName that corresponds to this columnName
            let referencesColumn: ResolvedColumnConfig | undefined = undefined;
            if (foreignTable) {
                const keyName = foreignTable.columnDisplayNames[fc.referencesColumnName];
                if (keyName) {
                    referencesColumn = foreignTable.config.columns[keyName];
                }
            }
            if (foreignTable && !referencesColumn){
                throw new Error(`Column ${fc.referencesColumnName} is referenced by a fk but does not exist in table ${fc.referencesTableName}`);
            }
            return {
                ...fc,
                referencesColumn,
                column: c.config
            }
        });

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
            columnNames: this.resolveColumnNames(columns),
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

    resolveColumnNames(columns: (ColumnConfig | ColumnConfigBuilder | string)[] | '*'): string[]{
        if (columns === '*'){
            return Object.values(this._columnNames);
        }
        return columns.map(this.resolveColumnName.bind(this))
    }

    /**
     * Alias for resolveColumnNames for consistency with TableDriver usage
     */
    resolveColumns(columns: Columns): string[] {
        return this.resolveColumnNames(columns);
    }

    /**
     * Convert storage column names back to application key names
     * Used when transforming entities from storage format to application format
     */
    resolveKeyNames(columnNames: string[]): Array<keyof T> {
        return columnNames.map(cn => this._columnDisplayNames[cn]).filter((k): k is keyof T => k !== undefined);
    }

    /**
     * Convert application entity with key names to storage format with column names
     * Applies column-level dump functions, then maps keyNames to columnNames, then applies table-level dump
     * Used when preparing entities for storage
     */
    async toStorageFormat(entity: Partial<T>): Promise<Record<string, any>> {
        // Step 1: Apply column-level dump functions (on application values with keyNames)
        const entityWithDumpedColumns: any = { ...entity };
        for (const [keyName, colConfig] of Object.entries(this.config.columns)) {
            if (keyName in entity && colConfig.dump) {
                const value = (entity as any)[keyName];
                if (value !== undefined && value !== null) {
                    try {
                        let dumpedValue: any;
                        if (colConfig.dump.length === 1) {
                            // dump(value) or dump(value) => Promise
                            dumpedValue = (colConfig.dump as any)(value);
                        } else {
                            // dump(value, record) or dump(value, record) => Promise
                            dumpedValue = (colConfig.dump as any)(value, entity);
                        }
                        // Handle both sync and async dumps
                        entityWithDumpedColumns[keyName] = dumpedValue instanceof Promise ? await dumpedValue : dumpedValue;
                    } catch (error) {
                        console.warn(`Error applying dump for column ${keyName}:`, error);
                        entityWithDumpedColumns[keyName] = value;
                    }
                }
            }
        }

        // Step 2: Map keyNames to columnNames
        const storageEntity: Record<string, any> = {};
        for (const [keyName, columnName] of Object.entries(this._columnNames)) {
            if (keyName in entityWithDumpedColumns) {
                storageEntity[columnName] = entityWithDumpedColumns[keyName];
            }
        }

        // Step 3: Apply table-level dump function (on storage format with columnNames)
        if (this.config.dump) {
            try {
                const dumped = this.config.dump(storageEntity);
                return (dumped instanceof Promise ? await dumped : dumped) as Record<string, any>;
            } catch (error) {
                console.warn(`Error applying table-level dump:`, error);
                return storageEntity;
            }
        }

        return storageEntity;
    }

    /**
     * Convert storage entity with column names to application format with key names
     * Applies table-level load function, then column-level load functions, then maps columnNames to keyNames
     * Used when transforming entities from storage format to application format
     */
    async fromStorageFormat(storageEntity: Record<string, any>): Promise<Partial<T>> {
        // Step 1: Apply table-level load function (on storage format with columnNames)
        let entityAfterTableLoad = storageEntity;
        if (this.config.load) {
            try {
                const loaded = this.config.load(storageEntity);
                entityAfterTableLoad = (loaded instanceof Promise ? await loaded : loaded) as Record<string, any>;
            } catch (error) {
                console.warn(`Error applying table-level load:`, error);
                entityAfterTableLoad = storageEntity;
            }
        }

        // Step 2: Apply column-level load functions (on storage values with columnNames)
        const entityWithLoadedColumns: Record<string, any> = { ...entityAfterTableLoad };
        for (const [columnName, keyName] of Object.entries(this._columnDisplayNames)) {
            if (columnName in entityAfterTableLoad) {
                const colConfig = this.config.columns[keyName];
                if (colConfig && colConfig.load) {
                    const value = entityAfterTableLoad[columnName];
                    if (value !== undefined && value !== null) {
                        try {
                            let loadedValue: any;
                            if (colConfig.load.length === 1) {
                                // load(value) or load(value) => Promise
                                loadedValue = (colConfig.load as any)(value);
                            } else {
                                // load(value, record) or load(value, record) => Promise
                                loadedValue = (colConfig.load as any)(value, entityAfterTableLoad);
                            }
                            // Handle both sync and async loads
                            entityWithLoadedColumns[columnName] = loadedValue instanceof Promise ? await loadedValue : loadedValue;
                        } catch (error) {
                            console.warn(`Error applying load for column ${columnName}:`, error);
                            entityWithLoadedColumns[columnName] = value;
                        }
                    }
                }
            }
        }

        // Step 3: Map columnNames to keyNames
        const entity: any = {};
        for (const [columnName, keyName] of Object.entries(this._columnDisplayNames)) {
            if (columnName in entityWithLoadedColumns) {
                entity[keyName] = entityWithLoadedColumns[columnName];
            }
        }
        return entity as Partial<T>;
    }
}

/**
 * Helper type to infer the table type from column builders
 */
type InferTableType<T extends Record<string, ColumnConfigBuilder<any>>> = {
    [K in keyof T]: T[K] extends ColumnConfigBuilder<infer U> ? U : never;
};

/**
 * Helper function to create a TableDriver directly
 * The table type T is inferred from the column builders
 * Returns a ready-to-use TableDriver instance
 */
export function table<T extends Record<string, ColumnConfigBuilder<any>>>(
    tableName: string,
    columns: T,
    cfg?: Partial<Omit<TableConfig<InferTableType<T>>, 'tableName' | 'columns'>>,
    driver?: IStorageDriver
): TableDriver<InferTableType<T>> {
    // Create the TableConfigBuilder first
    const builder = new TableConfigBuilder<InferTableType<T>>({
        ...(cfg || {}),
        tableName,
        columns: columns as any, // columns will be converted in the constructor
    } as TableConfig<InferTableType<T>>);
    
    // Create and return the TableDriver
    return new TableDriver<InferTableType<T>>(builder, driver || defaultStorageDriver);
}


