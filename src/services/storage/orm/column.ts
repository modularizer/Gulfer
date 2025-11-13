import { z } from 'zod';
import {ColumnConfig, ResolvedColumnConfig, ColumnDump, ColumnLoad, ColumnCheck} from "@services/storage/orm/types";



/**
 * Builder for creating ColumnConfig
 */
export class ColumnConfigBuilder<T = any> {
    public config!: ResolvedColumnConfig<T>;

    constructor(
        cfg: ColumnConfig<T>
    ) {
        this.config = {
            ...cfg,
            unique: cfg.unique ?? false,
            enforceUnique: cfg.enforceUnique ?? true,
            tableName: 'unassigned',
            checks: cfg.checks ?? [],
            dump: cfg.dump ?? ((x: T) => x),
            load: cfg.load ?? ((x: T) => x)
        }
    }

    get assigned(): boolean {
        return this.config.tableName !== 'unassigned';
    }

    assignToTable(tableName: string): this  {
        if (this.assigned){
            throw new Error('Column already assigned');
        }
        this.config.tableName = tableName;
        return this;
    }

    as(columnName: string, tableName: string, cfg?: Partial<ColumnConfig<T>> = {}) {
        return new ColumnConfigBuilder<T>({...this.config, ...cfg, columnName, tableName});
    }

    default(value: T | (() => T)): this {
        //@ts-ignore
        this.config.schema = this.config.schema.default(value);
        return this;
    }

    required(): this {
        //@ts-ignore
        if (this.config.schema.required) { // only optional schemas have the required function
            //@ts-ignore
            this.config.schema = this.config.schema.required();
        }
        return this;
    }
    optional(): this {
        //@ts-ignore
        this.config.schema = this.config.schema.optional();
        return this;
    }

    unique(enforce: boolean = true): this {
        this.config.unique = true;
        this.config.enforceUnique = true;
        return this;
    }

    nullable(): this {
        //@ts-ignore
        this.config.schema = this.config.schema.nullable();
        return this;
    }

    notNull(): this {
        //@ts-ignore
        this.config.schema = this.config.schema.nonnullable?.();
        return this;
    }

    withSerializer(dump: ColumnDump<T>): this {
        this.config.dump = dump;
        return this;
    }

    withLoader(load: ColumnLoad<T>): this {
        this.config.load = load;
        return this;
    }

    check(check: ColumnCheck<T>): this {
        this.config.checks = this.config.checks || []
        this.config.checks.push(check);
        return this;
    }

    references(src: ResolvedColumnConfig | ColumnConfigBuilder<T>, cascadeDelete?: boolean): this;
    references(
        referencesTableName: string,
        referencesColumnName: string,
        cascadeDelete?: boolean
    ): this;
    references(
        arg1: any,
        arg2: any,
        arg3: boolean
    ): this {
        let src: ColumnConfig | undefined = undefined;
        let referencesTableName: string;
        let referencesColumnName: string;
        let defaultCascadeDelete = true;
        let cascadeDelete = defaultCascadeDelete;

        if (typeof arg1 === "object") {
            // handle ColumnConfig version
            src = ((arg1.config ? arg1.config : arg1) as ResolvedColumnConfig);
            if (!src.tableName){
                throw new Error("fk column has no resolved tableName")
            }
            referencesTableName = src.tableName;
            referencesColumnName = src.columnName;
            cascadeDelete = arg2 ?? defaultCascadeDelete;
        }else{
            referencesTableName = arg1;
            referencesColumnName = arg2;
            cascadeDelete = arg3 ?? defaultCascadeDelete;
        }
        // @ts-ignore
        this.config.fkConfig = {referencesTableName, referencesColumnName, cascadeDelete, referencesColumn: src, column: this.config};
        return this;
    }

    defaultNow(): this {
        // @ts-ignore
        return this.default(Date.now)
    }
}

/**
 * Helper function to create a ColumnConfigBuilder
 */
export function column<T = any>(columnName: string, schema: z.ZodSchema<T> | z.ZodNullable<z.ZodType<T, z.ZodTypeDef, T>>, d?: T | (() => T), config: Partial<ColumnConfig> ={}): ColumnConfigBuilder<T> {
    const c = new ColumnConfigBuilder({...config, columnName, schema});
    if(d !== undefined) {
        return c.default(d);
    }
    return c;
}
