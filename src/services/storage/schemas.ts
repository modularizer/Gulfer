/**
 * Schema definitions using the builder pattern
 * This file defines all table schemas using the builders
 */

import { z } from 'zod';
import {
    requiredUniqueName,
    uuidPK,
    bool,
    num,
    timestamp,
    nonnegint, hex16, foreignKey, str
} from "@services/storage/orm/commonColumns";
import {column} from "@services/storage/orm/column";
import {table} from "@services/storage/orm/table";



const baseColumns = {
    id: uuidPK(),
    name: requiredUniqueName(),
    notes: str('notes', {maxLength: 200}),
    location: column('location', z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
    })),
}


export const playersTable = table('players', {
    ...baseColumns,
    isTeam: bool('is_team', false),
});

export const teamMembersTable = table('team_members', {
    teamId: foreignKey('team_id', playersTable),
    playerId: foreignKey('player_id', playersTable),
});

export const coursesTable = table('courses', baseColumns);

export const holesTable = table('holes', {
    ...baseColumns,
    courseId: foreignKey('course_id', coursesTable),
    number: nonnegint('number'),
    par: nonnegint('par').nullable(),
    distance: nonnegint('distance').nullable(),
}).unique((cols) => [cols.courseId, cols.number]);

export const roundsTable = table('rounds', {
    ...baseColumns,
    courseId: foreignKey('course_id', coursesTable),
    startedAt: timestamp('started_at').defaultNow(),
}).unique((cols) => [cols.courseId, cols.startedAt]);


export const playerRoundsTable= table('player_rounds', {
    ...baseColumns,
    playerId: foreignKey('player_id', playersTable),
    roundId: foreignKey('round_id', roundsTable),
    frozen: bool('frozen', false),
}).unique((cols) => [cols.roundId, cols.playerId]);


export const playerRoundHoleScoresTable = table('player_round_hole_scores', {
    id: uuidPK(),
    score: num('score'),
    recordedAt: timestamp('recorded_at').defaultNow(),
    complete: bool('complete', false),
    playerId: foreignKey('player_id', playersTable),
    roundId: foreignKey('round_id', roundsTable),
    holeId: foreignKey('hole_id', holesTable),
    holeNumber: nonnegint('hole_number'),
})
    .unique((cols) => [cols.roundId, cols.playerId, cols.holeId])
    .unique((cols) => [cols.roundId, cols.playerId, cols.holeNumber]);


/**
 * Current Player Table Config
 * Stores the current player ID in a separate table
 */
export const currentPlayerTable= table('current_player', {
    id: uuidPK(),
    playerId: foreignKey('player_id', playersTable),
});

/**
 * Photo Table Config
 * Photos are stored in their own table and can reference any entity via refId
 */
export const photosTable = table('photos', {
    id: uuidPK(),
    refId: hex16('ref_id'),
    refTable: str('ref_table').nullable(),
    refSchema: str('ref_schema').nullable(),
    hash: hex16('hash').unique(),
});

/**
 * Merge Entry Table Config
 * Supports all entity types that can be merged between storage instances
 */
export const mergeEntriesTable = table('merge_entries', {
    id: uuidPK(),
    foreignStorageId: hex16('foreign_storage_id'),
    foreignId: hex16('foreign_id'),
    refTable: str('ref_table'),
    refSchema: str('ref_schema').nullable(),
    localId: hex16('local_id').unique(),
    mergedAt: column('mergedAt', z.number().nonnegative())
        .required()
        .notNull(),
})
    .unique((cols) => [cols.foreignStorageId, cols.foreignId]);

