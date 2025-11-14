# Scoring System Refactoring Plan

## Overview
This document outlines a plan to refactor the data storage and scoring system to support a wide variety of sports and scoring methods beyond golf.

## ⚠️ UPDATE: Unified Stages Approach

**The recommended approach uses a single `stages` table** instead of separate tables for events, groupings, and segments. See `UNIFIED_STAGES_APPROACH.md` for the complete design.

**Key Design:**
- Single `stages` table with recursive `parentId` FK
- `type` column differentiates: "round", "hole", "match", "set", "game", etc.
- All scoring fields (value, place, points, won, lost, scoreType, stats) in same table
- `playerId` is optional - null for structural stages, set for player scores

This is simpler and more flexible than the multi-table approach described below.

## Current Structure Analysis

### Current Golf-Centric Model
- **Sports** → **Courses** → **Holes** → **Rounds** → **PlayerRounds** → **Scores**
- Terminology is golf-specific: "holes", "rounds"
- Scoring assumes sequential hole-based structure
- Single score value per player-hole combination

### Limitations
1. **Terminology**: "Hole" doesn't apply to tennis, swimming, bowling, etc.
2. **Hierarchy**: Fixed 3-level hierarchy (Course → Hole → Round) doesn't fit all sports
3. **Scoring**: Single integer score doesn't capture complex scoring (sets won, time, multiple metrics)
4. **Structure**: Sequential numbering assumes linear progression

## Proposed Generic Model

### Core Concepts

#### 1. **Event** (replaces "Round")
- A single competition instance
- Examples: Golf round, Tennis match, Swimming meet, Bowling series, Track meet
- Contains: date, location, participants, metadata

#### 2. **Segment** (replaces "Hole")
- A subdivision of an event where scoring occurs
- Examples: Golf hole, Tennis set, Swimming heat, Bowling frame, Track event
- Can be hierarchical (e.g., Tennis: Match → Set → Game)
- Contains: number/identifier, metadata, scoring configuration

#### 3. **Grouping** (new, optional intermediate level)
- Optional intermediate level between Event and Segment
- Examples: Golf round (if multiple rounds per event), Tennis game (within a set), Swimming race (within a meet)
- Allows for recursive/nested structures

#### 4. **Venue** (replaces "Course")
- The location/context where events occur
- Examples: Golf course, Tennis court, Swimming pool, Bowling alley, Track stadium
- Contains: name, location, metadata, segment templates

### Generic Terminology Mapping

| Current Term | Generic Term | Examples |
|-------------|--------------|----------|
| Round | Event | Match, Meet, Series, Tournament |
| Hole | Segment | Hole, Set, Frame, Heat, Game, Race |
| Course | Venue | Course, Court, Pool, Alley, Stadium |
| - | Grouping | Round (multi-round events), Game (within set), Race (within meet) |

## Schema Refactoring

### Option A: Recursive Segment Structure (Recommended)

Allows unlimited nesting depth for complex sports:

```typescript
// Venues (replaces Courses)
export const venues = sqliteTable('venues', {
  ...baseColumns,
  sportId: text('sport_id').notNull().references(() => sports.id),
  venueType: text('venue_type'), // 'course', 'court', 'pool', etc.
  metadata: text('metadata', {mode: 'json'}).$type<VenueMetadata>(),
});

// Events (replaces Rounds)
export const events = sqliteTable('events', {
  ...baseColumns,
  venueId: text('venue_id').references(() => venues.id, { onDelete: 'set null' }),
  sportId: text('sport_id').notNull().references(() => sports.id),
  eventType: text('event_type'), // 'round', 'match', 'meet', 'series', etc.
  date: integer('date').notNull(),
  metadata: text('metadata', {mode: 'json'}).$type<EventMetadata>(),
});

// Segments (replaces Holes) - RECURSIVE
export const segments = sqliteTable('segments', {
  ...baseColumns,
  sportId: text('sport_id').notNull().references(() => sports.id),
  venueId: text('venue_id').references(() => venues.id, { onDelete: 'cascade' }),
  eventId: text('event_id').references(() => events.id, { onDelete: 'cascade' }),
  parentSegmentId: text('parent_segment_id').references(() => segments.id, { onDelete: 'cascade' }), // RECURSIVE
  segmentType: text('segment_type'), // 'hole', 'set', 'frame', 'heat', 'game', etc.
  number: integer('number'), // Optional - not all segments are numbered
  identifier: text('identifier'), // Alternative to number (e.g., "Men's 100m", "Singles")
  order: integer('order').notNull().default(0), // For ordering within parent
  metadata: text('metadata', {mode: 'json'}).$type<SegmentMetadata>(),
}, (table) => ({
  // Unique constraints depend on context
  venueNumberUnique: unique().on(table.venueId, table.number).where(sql`parent_segment_id IS NULL`),
  eventNumberUnique: unique().on(table.eventId, table.number).where(sql`parent_segment_id IS NULL`),
  parentNumberUnique: unique().on(table.parentSegmentId, table.number).where(sql`parent_segment_id IS NOT NULL`),
}));

// Player Events (replaces PlayerRounds)
export const playerEvents = sqliteTable('player_events', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  notes: text('notes', { length: 200 }),
  latitude: integer('latitude'),
  longitude: integer('longitude'),
  playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  frozen: integer('frozen', { mode: 'boolean' }).default(false).notNull(),
  metadata: text('metadata', {mode: 'json'}).$type<PlayerEventMetadata>(),
}, (table) => ({
  eventPlayerUnique: unique().on(table.eventId, table.playerId),
}));

// Scores (replaces PlayerRoundHoleScores) - FLEXIBLE
export const scores = sqliteTable('scores', {
  id: text('id').primaryKey().notNull(),
  playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  segmentId: text('segment_id').notNull().references(() => segments.id, { onDelete: 'cascade' }),
  
  // Primary score value (for backward compatibility and simple cases)
  value: real('value'), // Can be integer or float (for time, etc.)
  
  // Extended scoring (JSON for complex cases)
  // Examples:
  // - Tennis: { setsWon: 2, gamesWon: [6, 4, 6], points: [30, 40] }
  // - Swimming: { time: 45.23, timeMs: 45230, lane: 3, place: 1 }
  // - Bowling: { pins: 8, spare: false, strike: false, frameScore: 8 }
  scoringData: text('scoring_data', {mode: 'json'}).$type<ScoringData>(),
  
  recordedAt: integer('recorded_at').notNull().$defaultFn(() => Date.now()),
  complete: integer('complete', { mode: 'boolean' }).default(true).notNull(),
  metadata: text('metadata', {mode: 'json'}).$type<ScoreMetadata>(),
}, (table) => ({
  eventPlayerSegmentUnique: unique().on(table.eventId, table.playerId, table.segmentId),
}));
```

### Option B: Fixed Multi-Level Structure

Simpler but less flexible - uses explicit grouping level:

```typescript
// Similar to Option A but with explicit grouping table instead of recursive segments
export const groupings = sqliteTable('groupings', {
  ...baseColumns,
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  groupingType: text('grouping_type'), // 'round', 'game', 'race', etc.
  number: integer('number'),
  order: integer('order').notNull(),
  metadata: text('metadata', {mode: 'json'}).$type<GroupingMetadata>(),
});

export const segments = sqliteTable('segments', {
  ...baseColumns,
  groupingId: text('grouping_id').references(() => groupings.id, { onDelete: 'cascade' }),
  // ... rest similar but without parentSegmentId
});
```

**Recommendation: Option A (Recursive)** - More flexible, handles edge cases better, future-proof.

## Scoring System Refactoring

### Enhanced Scoring Types

```typescript
// Generic scoring storage structure
export type ScoringData = 
  | SimpleScoringData      // Single value (golf, bowling pins)
  | TimeScoringData        // Time-based (swimming, track)
  | SetBasedScoringData    // Sets/games (tennis, volleyball)
  | MultiMetricScoringData // Multiple values (basketball: points, rebounds, assists)
  | CustomScoringData;     // Sport-specific

export interface SimpleScoringData {
  type: 'simple';
  value: number;
  unit?: string; // 'strokes', 'pins', 'points', etc.
}

export interface TimeScoringData {
  type: 'time';
  timeMs: number; // Milliseconds for precision
  timeDisplay: string; // "45.23" or "1:23.45"
  place?: number;
  lane?: number;
}

export interface SetBasedScoringData {
  type: 'set-based';
  setsWon: number;
  setsLost: number;
  games?: Array<{ // For tennis
    gamesWon: number;
    gamesLost: number;
    points?: number[];
  }>;
}

export interface MultiMetricScoringData {
  type: 'multi-metric';
  metrics: Record<string, number>; // { points: 25, rebounds: 10, assists: 5 }
  primaryMetric: string; // Which metric to use for ranking
}

export interface CustomScoringData {
  type: 'custom';
  sportType: string;
  data: Record<string, any>;
}
```

### Enhanced Scoring Functions

```typescript
// Generic scoring interface
export interface SegmentScoringInfo {
  playerValues: PlayerValues; // Raw input values
  previousSegmentResults: GroupResult[]; // Results from previous segments
  segmentInfo: SegmentInfo; // Current segment metadata
  eventInfo: EventInfo; // Event-level metadata
}

export interface EventScoringInfo {
  segmentResults: GroupResult[]; // All segment results
  eventInfo: EventInfo;
}

export type ScoreSegment = (info: SegmentScoringInfo) => GroupResult;
export type ScoreEvent = (info: EventScoringInfo) => GroupResult;

// Sport-specific scoring configuration
export interface SportScoringConfig {
  sportId: string;
  valueType: 'lowest-wins' | 'highest-wins' | 'time' | 'sets' | 'custom';
  segmentScorer: ScoreSegment;
  eventScorer: ScoreEvent;
  defaultMetadata: Record<string, any>;
}
```

## Sport-Specific Examples

### Golf (Current)
- **Event**: Round
- **Segment**: Hole
- **Scoring**: Simple integer (strokes), lowest wins
- **Structure**: Flat (no nesting)

### Tennis
- **Event**: Match
- **Segment**: Set (parent) → Game (child segment)
- **Scoring**: Set-based (sets won), with game-level detail
- **Structure**: 2-level nesting

### Swimming
- **Event**: Meet
- **Segment**: Race/Heat
- **Scoring**: Time-based (milliseconds), lowest time wins
- **Structure**: Flat, but may have heats → finals

### Bowling
- **Event**: Series
- **Segment**: Frame
- **Scoring**: Simple integer (pins), highest wins
- **Structure**: Flat

### Volleyball
- **Event**: Match
- **Segment**: Set
- **Scoring**: Set-based (sets won), first to X sets wins
- **Structure**: Flat

### Track & Field
- **Event**: Meet
- **Segment**: Individual event (100m, long jump, etc.)
- **Scoring**: Time or distance, varies by event type
- **Structure**: Flat, multiple event types per meet

## Migration Strategy

### Phase 1: Add Generic Tables (Backward Compatible)
1. Create new generic tables alongside existing ones
2. Add migration scripts to copy data
3. Update code to write to both old and new tables
4. Test thoroughly

### Phase 2: Dual Read Support
1. Update read operations to check both old and new tables
2. Prefer new tables when available
3. Gradually migrate existing data

### Phase 3: Full Migration
1. Remove old table dependencies
2. Drop old tables
3. Update all references

### Migration Script Example

```typescript
// Migrate from old to new 2-generic-sports-sports-generic-sports
async function migrateRoundToEvent(roundId: string) {
  const round = await getRoundById(roundId);
  if (!round) return;
  
  // Create event
  const event: EventInsert = {
    id: round.id,
    name: round.name,
    notes: round.notes,
    lat: round.lat,
    lng: round.lng,
    venueId: round.courseId, // Course becomes Venue
    sportId: await getSportIdForCourse(round.courseId),
    eventType: 'round',
    date: round.date,
    metadata: {},
  };
  
  // Migrate holes to segments
  const holes = await getAllHolesForCourse(round.courseId);
  const segments = holes.map(hole => ({
    id: hole.id,
    name: hole.name,
    notes: hole.notes,
    lat: hole.lat,
    lng: hole.lng,
    sportId: event.sportId,
    venueId: round.courseId,
    eventId: event.id,
    segmentType: 'hole',
    number: hole.number,
    order: hole.number,
    metadata: hole.metadata || {},
  }));
  
  // Migrate scores
  const oldScores = await getAllScoresForRound(roundId);
  const newScores = oldScores.map(score => ({
    id: score.id,
    playerId: score.playerId,
    eventId: event.id,
    segmentId: score.holeId, // holeId becomes segmentId
    value: score.score,
    scoringData: { type: 'simple', value: score.score, unit: 'strokes' },
    recordedAt: score.recordedAt,
    complete: score.complete,
    metadata: {},
  }));
  
  // Save all
  await saveEvent(event);
  await saveSegments(segments);
  await saveScores(newScores);
}
```

## Implementation Recommendations

### 1. Generic Terms in Code
- Use `Event` instead of `Round` in new code
- Use `Segment` instead of `Hole`
- Use `Venue` instead of `Course`
- Create type aliases for backward compatibility during migration

### 2. Sport Configuration
Create a sport configuration system:

```typescript
export const sportConfigs: Record<string, SportConfig> = {
  'golf': {
    name: 'Golf',
    segmentTerm: 'Hole',
    eventTerm: 'Round',
    venueTerm: 'Course',
    scoringType: 'lowest-wins',
    defaultSegmentCount: 18,
    supportsNesting: false,
  },
  'tennis': {
    name: 'Tennis',
    segmentTerm: 'Set',
    eventTerm: 'Match',
    venueTerm: 'Court',
    scoringType: 'sets',
    defaultSegmentCount: 3, // Best of 3
    supportsNesting: true,
    nestedSegmentTerm: 'Game',
  },
  // ... etc
};
```

### 3. UI Adaptability
- Use sport configuration to display correct terminology
- Adapt UI based on sport type (e.g., time input for swimming, set score for tennis)
- Support nested segment display for sports that need it

### 4. Scoring Plugins
Create a plugin system for sport-specific scoring:

```typescript
// scoring/plugins/golf.ts
export const golfScoring: SportScoringPlugin = {
  sportId: 'golf',
  scoreSegment: (info) => {
    // Golf-specific scoring logic
  },
  scoreEvent: (info) => {
    // Sum all segment scores
  },
};

// scoring/plugins/tennis.ts
export const tennisScoring: SportScoringPlugin = {
  sportId: 'tennis',
  scoreSegment: (info) => {
    // Tennis set scoring logic
  },
  scoreEvent: (info) => {
    // Best of X sets logic
  },
};
```

## Benefits of This Approach

1. **Flexibility**: Supports any sport structure
2. **Extensibility**: Easy to add new sports
3. **Backward Compatibility**: Can migrate gradually
4. **Type Safety**: Strong TypeScript support
5. **Performance**: Efficient queries with proper indexing
6. **Future-Proof**: Handles edge cases and complex scenarios

## Next Steps

1. **Review and Refine**: Get feedback on this plan
2. **Prototype**: Build a small prototype for one non-golf sport
3. **Migration Plan**: Create detailed migration scripts
4. **Testing**: Comprehensive test suite for all sport types
5. **Documentation**: Update all documentation with new terminology
6. **UI Updates**: Adapt UI to use generic terms with sport-specific labels

