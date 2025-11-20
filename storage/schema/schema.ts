/**
 * Generic Sports Data Schema
 * 
 * This schema wraps all generic-sports-data tables using xpschema.
 * Use schema.gen() to generate types, create scripts, and migrations.
 */

import { xpschema } from '../../xp-deeby/xp-schema';
import * as tables from './generic-sports-data/tables';

export const schema = xpschema({
    // Sports and formats
    sports: tables.sports,
    scoreFormats: tables.scoreFormats,
    eventFormats: tables.eventFormats,
    eventFormatStages: tables.eventFormatStages,
    // Venues
    venues: tables.venues,
    venueEventFormats: tables.venueEventFormats,
    venueEventFormatStages: tables.venueEventFormatStages,
    // Participants and teams
    participants: tables.participants,
    teamMembers: tables.teamMembers,
    // Events
    events: tables.events,
    eventParticipants: tables.eventParticipants,
    eventStages: tables.eventStages,
    participantEventStageScores: tables.participantEventStageScores,
    namedScores: tables.scores, // named_scores table is exported as 'scores'
    // Other tables
    photos: tables.photos,
    mergeEntries: tables.mergeEntries,
}, __filename);

