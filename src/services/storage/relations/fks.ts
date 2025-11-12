/**
 * Foreign key relationship definition
 */
export interface ForeignKeyRelationship {
    /**
     * Field name in this entity that contains the foreign key
     */
    field: string;

    /**
     * The storage service key for the referenced entity type
     * This should match the tableName of the referenced service
     */
    referencesTableName: string;

    referencesField: string;

    /**
     * Whether to cascade delete (delete child entities when parent is deleted)
     * Defaults to false
     */
    cascadeDelete?: boolean;
}
