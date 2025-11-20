/**
 * Generic Sports Data Schema
 * 
 * This schema wraps all generic-sports-data tables using xpschema.
 * Use schema.gen() to generate types, create scripts, and migrations.
 */

import { xpschema } from '../../../../xp-deeby/xp-schema';
import {photos} from "./3-photos";
import {mergeEntries} from "./6-data-merges";
import {
    eventFormats,
    eventFormatStages,
    eventParticipants,
    eventStages,
    events,
    participantEventStageScores, participants, scoreFormats,
    scores, sports,
    teamMembers, venueEventFormats, venueEventFormatStages, venues
} from "./2-generic-sports-schema";


export const schema = xpschema({
    // Sports and formats
    sports: sports,
    scoreFormats: scoreFormats,
    eventFormats: eventFormats,
    eventFormatStages: eventFormatStages,
    // Venues
    venues: venues,
    venueEventFormats: venueEventFormats,
    venueEventFormatStages: venueEventFormatStages,
    // Participants and teams
    participants: participants,
    teamMembers: teamMembers,
    // Events
    events: events,
    eventParticipants: eventParticipants,
    eventStages: eventStages,
    participantEventStageScores: participantEventStageScores,
    namedScores: scores, // named_scores table is exported as 'scores'
    // Other tables
    photos: photos,
    mergeEntries: mergeEntries,
}, __filename);

const r = schema.photos;