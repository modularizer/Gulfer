import {
    table, text, integer, real, timestamp, jsonb, unique, index, bool, uuid, uuidPK, uuidDefault
} from '../../../adapters';

// ============================================================================
// Merge Entries Table (unchanged)
// ============================================================================

export const mergeEntries = table('merge_entries', {
    id: uuidPK('id'),
    foreignStorageId: text('foreign_storage_id').notNull(), // 16 hex characters
    foreignId: text('foreign_id').notNull(), // 16 hex characters
    refTable: text('ref_table').notNull(),
    localId: text('local_id').notNull(), // 16 hex characters
    mergedAt: integer('merged_at').notNull(), // Stored as milliseconds
}, (table) => ({
    foreignStorageIdForeignIdUnique: unique().on(table.foreignStorageId, table.foreignId),
}));