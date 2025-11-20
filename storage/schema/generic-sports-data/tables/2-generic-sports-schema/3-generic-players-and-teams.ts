
// ============================================================================
// Participants Table (stores players AND teams)
// ============================================================================
import {baseColumns, latLngIdx} from "../1-base";
import {varchar, integer, table, text, timestamp, unique} from "../../../../../xp-deeby/xp-schema";

export enum Sex {
    MALE = 'MALE',
    FEMALE = 'FEMALE',
    MIXED = 'MIXED',
    UNKNOWN = 'UNKNOWN',
}

export const participantColumns = {
    ...baseColumns,
    sex: varchar("sex", { enum: [Sex.MALE, Sex.FEMALE, Sex.MIXED, Sex.UNKNOWN],}).notNull().default(Sex.UNKNOWN),
    birthday: timestamp("birthday"),
    isTeam: integer('is_team', { mode: 'boolean' }).default(0), // Use 0 instead of false for PostgreSQL compatibility
    createdAt: timestamp("createdAt"),
    deletedAt: timestamp("deletedAt"),
};

export const participants = table('participants', participantColumns,
    (table) => [
        latLngIdx(table),
    ]
);


// ============================================================================
// Team Members Table
// ============================================================================

export const teamMembers = table('team_members', {
    id: text('id').primaryKey().notNull(),
    teamId: text('team_id').notNull().references(() => participants.id, { onDelete: 'cascade' }),
    participantId: text('participant_id').notNull().references(() => participants.id, { onDelete: 'cascade' }),
}, (table) => [
    unique('team_participants').on(table.teamId, table.participantId)
]);


