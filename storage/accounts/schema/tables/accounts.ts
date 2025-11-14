import {
    table, text, integer, real, timestamp, jsonb, unique, index, bool, uuid, uuidPK, uuidDefault
} from '../../../adapters';
import {participants} from "../../../sports-data/schema/tables/2-generic-sports-schema/3-generic-players-and-teams";


// ============================================================================
// Accounts Table
// ============================================================================

export const accounts = table('accounts', {
    id: uuidPK('id'),
    participantId: uuid('participant_id').references(() => participants.id, { onDelete: 'cascade' }),
    deletedAt: timestamp('deleted_at'),
});

