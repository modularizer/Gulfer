export interface GeneratedFieldContext<T> {
    entity: Partial<T>;
    existingEntities: T[];
    generateId: () => Promise<string>;
}

export type GeneratedFieldGenerator<T> = (
    context: GeneratedFieldContext<T>
) => any | Promise<any>;

export interface GeneratedFieldDefinition<T> {
    field: string;
    generator?: GeneratedFieldGenerator<T>;
}
