import {
    table, text, integer, uuid, uuidPK
} from '../../../../xp-deeby/xp-schema';

// ============================================================================
// Photos Table (unchanged)
// ============================================================================

export const photos = table('photos', {
    id: uuidPK('id'),

    // soft reference
    refId: uuid('ref_id'),
    refTable: text('ref_table'),


    hash: text('hash').notNull().unique(), // SHA256 hash of image
    data: text('data'), // Base64 storage (web) or file path (mobile) - optional, can be stored separately
    createdAt: integer('created_at').notNull().default(() => Date.now()),
});
