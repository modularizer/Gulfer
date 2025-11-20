import {
    table, text, integer, real, jsonb, unique, bool, uuid
} from '../../../../../xp-deeby/xp-schema';
import {baseColumns, latLngIdx} from '../1-base';


// ============================================================================
// Sports Table (e.g. golf, mini-golf, disc-golf, swimming, bowling, etc.
// ============================================================================
export const sports = table('sports', {
    ...baseColumns,
}, (table) => [
    latLngIdx(table),
]);


// ============================================================================
// Score Formats Table ( e.g golf-hole, where you get the number of points as your value, or xc-race, where you get a point for your place, or xc-team race, where you get a point for the 5 lowest scores on the team, or "tennis game" which does weird scoring)
// ============================================================================
export const scoreFormats = table('score_formats', {
    ...baseColumns,
    sportId: uuid('sport_id').references(() => sports.id, { onDelete: 'cascade' }), // can be null
    scoringMethodName: text('scoring_method_name').notNull(),
    // TODO: add everything needed
}, (table) => [
    latLngIdx(table),
]);

// ============================================================================
// Event Formats Table ( e.g 19 hole disc-golf course, 18-hole golf course, 9 hole golf course, standard tennis match)
// ============================================================================
export const eventFormats = table('event_formats', {
    ...baseColumns,
    sportId: uuid('sport_id').notNull().references(() => sports.id, { onDelete: 'cascade' }),
    scoreFormatId: uuid('score_format_id').notNull().references(() => scoreFormats.id),
    minTeamSize: integer('min_team_size'),
    maxTeamSize: integer('max_team_size'),
    minTeams: integer('min_teams'),
    maxTeams: integer('max_teams'),
    expectedMinDuration: integer('expected_min_duration'), // Duration in minutes
    expectedDuration: integer('expected_duration'), // Duration in minutes
    expectedMaxDuration: integer('expected_max_duration'), // Duration in minutes
}, (table) => [
    latLngIdx(table),
]);


// ============================================================================
// Event Format Stages Table (generic-sports concept of each hole, inning, round, etc. in some format, e.g. "Hole #5 of a 18-hole golf course", "first question of round 3 in some trivia format", or "add-in#3 on game three point 4 of a tennis match" or "game three of a tennis match" or "game three point for of a tennis match" )
// ============================================================================
export const eventFormatStages = table('event_format_stages', {
    ...baseColumns,
    eventFormatId: text('event_format_id').notNull().references(() => eventFormats.id, { onDelete: 'cascade' }),
    parentId: text('event_format_stage_id'), // self-referencing
    number: integer('number').notNull().default(0),
    scoreFormatId: uuid('score_format_id').notNull().references(() => scoreFormats.id),
}, (table) => [
    latLngIdx(table),
    unique("event_format_stage_child").on(table.eventFormatId, table.parentId, table.number)
]);



// ============================================================================
// Named Scores Table ( e.g "hole-in-one" for getting a 1 on a golf hole or "love" for having a 0 in tennis game, "stike", "spare", "birdie", "eagle", etc.)
// ============================================================================
export const scoreColumns = {
    scoreFormatId: uuid('score_format_id').notNull().references(() => scoreFormats.id, {onDelete: "cascade"}),
    value: jsonb('value').$type<any>(),
    points: real('points'),
    won: bool('won'),
    lost: bool('lost'),
    tied: bool('tied'),
    winMargin: real('win_margin'),
    lossMargin: real('loss_margin'),
    pointsBehindPrevious: real('points_behind_previous'),
    pointsAheadOfNext: real('points_ahead_of_next'),
}
export const scores = table('named_scores', {
    ...baseColumns,
    ...scoreColumns,
}, (table) => [
    latLngIdx(table),
]);

