import {
    table, text, integer, real, timestamp, jsonb, unique, index, bool, uuid, uuidPK, uuidDefault
} from '../../../../adapters/schema';
import {baseColumns, latLngIdx} from '../1-base';
import {scoreColumns, sports} from "./1-generic-sports-and-formats";
import {venueEventFormats, venueEventFormatStages} from "./2-generic-sport-venues";
import {participants} from "./3-generic-players-and-teams";


// ============================================================================
// Events Table (this is a single event, round, tournament, match, etc)
// ============================================================================

export const events = table('events', {
    ...baseColumns,
    venueEventFormatId: uuid('venue_event_format_id').notNull().references(() => venueEventFormats.id, {onDelete: 'cascade'}),
    startTime: timestamp('start_time'),
    endTime: timestamp('end_time'),
    active: bool('active'),
}, (table) => [
    latLngIdx(table),
]);

// ============================================================================
// Event Participants Table (these are the players of teams participating in the event)
// ============================================================================
export const eventParticipants = table('event_participants', {
    ...baseColumns,
    eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
    participantId: uuid('participant_id').notNull().references(() => participants.id, { onDelete: 'cascade' }),
}, (table) => [
    latLngIdx(table),
]);


// ============================================================================
// Event Stages Table (this is a single stage of an event)
// ============================================================================
export const eventStages = table('event_stages', {
    ...baseColumns,
    eventId: uuid('event_id').notNull().references(() => events.id, {onDelete: 'cascade'}),
    venueEventFormatStageId: uuid('venue_event_format_stage_id').notNull().references(() => venueEventFormatStages.id, {onDelete: 'cascade'}),
    startTime: timestamp('start_time'),
    endTime: timestamp('end_time'),
    active: bool('active'),
}, (table) => [
    latLngIdx(table),
]);


// ============================================================================
// Participant Event Stage Scores Table (this is a participant's scores in one stage of one event
// ============================================================================
export const participantEventStageScores = table('participant_event_stage_scores', {
    ...baseColumns,
    eventStageId: text('event_stage_id').references(() => eventStages.id, { onDelete: 'set null' }),
    participantId: uuid('participant_id').notNull().references(() => participants.id, { onDelete: 'cascade' }),
    ...scoreColumns,
    completedAt: timestamp('completed_at').$defaultFn(() => new Date()), // When this stage was recorded
    complete: integer('complete', { mode: 'boolean' }).default(0).notNull(), // Is this stage complete? Use 0 instead of false for PostgreSQL compatibility
}, (table) => [
    latLngIdx(table),
]);


