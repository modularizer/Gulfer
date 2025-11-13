import {
    table, text, integer, real, timestamp, jsonb, unique, index, bool, uuid, uuidPK, uuidDefault
} from '../../adapters';
import {baseColumns, latLngIdx} from '../1-base';
import {eventFormats, eventFormatStages} from "./1-generic-sports-and-formats";


// ============================================================================
// Venues Table (this is the sports complex, course, pool, etc)
// ============================================================================
export const venues = table('venues', {
    ...baseColumns,
}, (table) => [
    latLngIdx(table),
]);


// ============================================================================
// Venue Event Formats Table (replaces Courses, e.g. this could be "a 19-hole disc golf course at Pine Nursery", or a "tennis match at Franklin High School")
// ============================================================================
export const venueEventFormats = table('venue_event_formats', {
    ...baseColumns,
    venueId: text('venue_id').references(() => venues.id, { onDelete: 'cascade' }),
    eventFormatId: text('event_format_id').notNull().references(() => eventFormats.id, { onDelete: 'cascade' }),
}, (table) => [
    latLngIdx(table),
]);


// ============================================================================
// Venue Event Format Stages Table (e.g. "Hole #5 at a 19-hole disc golf course at Pine Nursery", "bottom of the ninth inning at Fenway Park")
// ============================================================================
export const venueEventFormatStages = table('venue_event_format_stages', {
    ...baseColumns,
    venueEventFormatId: text('venue_event_format_id').notNull().references(() => venueEventFormats.id, { onDelete: 'cascade' }),
    eventFormatStageId: text('event_format_stage_id').notNull().references(() => eventFormatStages.id, { onDelete: 'cascade' }),
    parentId: text('venue_event_format_stage_id'), // self-referencing
    number: integer('number').notNull().default(0),
}, (table) => [
    latLngIdx(table),
    unique("event_format_stage_child").on(table.venueEventFormatId, table.parentId, table.number)
]);


