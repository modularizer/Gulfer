import {
    table, text, integer, real, timestamp, jsonb, unique, index, bool, uuid, uuidPK, uuidDefault
} from '../../../../xp-deeby/xp-schema';
import {participants} from "../../generic-sports-data/tables/2-generic-sports-schema/3-generic-players-and-teams";


// ============================================================================
// Accounts Table
// ============================================================================

export const accounts = table('accounts', {
    id: uuidPK('id'),
    participantId: uuid('participant_id').references(() => participants.id, { onDelete: 'cascade' }),
    deletedAt: timestamp('deleted_at'),
});

