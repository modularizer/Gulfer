/**
 * Schema Type Definitions
 * 
 * Centralized definitions of all inferred types from the generic-sports tables.
 * This reduces repetition and improves type checking performance by defining
 * each $inferSelect and $inferInsert once and reusing the names.
 */

import * as schema from './index';

// ============================================================================
// Sports and Formats
// ============================================================================

export type Sport = typeof schema.sports.$inferSelect;
export type SportInsert = typeof schema.sports.$inferInsert;

export type ScoreFormat = typeof schema.scoreFormats.$inferSelect;
export type ScoreFormatInsert = typeof schema.scoreFormats.$inferInsert;

export type EventFormat = typeof schema.eventFormats.$inferSelect;
export type EventFormatInsert = typeof schema.eventFormats.$inferInsert;

export type EventFormatStage = typeof schema.eventFormatStages.$inferSelect;
export type EventFormatStageInsert = typeof schema.eventFormatStages.$inferInsert;

export type Score = typeof schema.scores.$inferSelect;
export type ScoreInsert = typeof schema.scores.$inferInsert;

// ============================================================================
// Venues
// ============================================================================

export type Venue = typeof schema.venues.$inferSelect;
export type VenueInsert = typeof schema.venues.$inferInsert;

export type VenueEventFormat = typeof schema.venueEventFormats.$inferSelect;
export type VenueEventFormatInsert = typeof schema.venueEventFormats.$inferInsert;

export type VenueEventFormatStage = typeof schema.venueEventFormatStages.$inferSelect;
export type VenueEventFormatStageInsert = typeof schema.venueEventFormatStages.$inferInsert;

// ============================================================================
// Participants and Teams
// ============================================================================

export type Participant = typeof schema.participants.$inferSelect;
export type ParticipantInsert = typeof schema.participants.$inferInsert;

export type TeamMember = typeof schema.teamMembers.$inferSelect;
export type TeamMemberInsert = typeof schema.teamMembers.$inferInsert;

// ============================================================================
// Events
// ============================================================================

export type Event = typeof schema.events.$inferSelect;
export type EventInsert = typeof schema.events.$inferInsert;

export type EventParticipant = typeof schema.eventParticipants.$inferSelect;
export type EventParticipantInsert = typeof schema.eventParticipants.$inferInsert;

export type EventStage = typeof schema.eventStages.$inferSelect;
export type EventStageInsert = typeof schema.eventStages.$inferInsert;

export type ParticipantEventStageScore = typeof schema.participantEventStageScores.$inferSelect;
export type ParticipantEventStageScoreInsert = typeof schema.participantEventStageScores.$inferInsert;

// ============================================================================
// Photos
// ============================================================================

export type Photo = typeof schema.photos.$inferSelect;
export type PhotoInsert = typeof schema.photos.$inferInsert;

// ============================================================================
// Data Merges
// ============================================================================

export type MergeEntry = typeof schema.mergeEntries.$inferSelect;
export type MergeEntryInsert = typeof schema.mergeEntries.$inferInsert;

