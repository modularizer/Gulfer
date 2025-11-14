# Unified Stages Schema Approach

## Overview

This approach uses a **single `stages` table** to represent all hierarchical scoring structures:
- **Events**: rounds, matches, meets, tournaments
- **Groupings**: rounds within tournaments, games within sets  
- **Segments**: holes, sets, frames, heats, games
- **Scores**: player-specific results

All differentiated by the `type` column and connected via recursive `parent` foreign key.

## Key Design Principles

1. **Single Table**: Everything is a "stage" - events, groupings, segments, and scores
2. **Type Differentiation**: The `type` column uses sport-specific terminology ("round", "hole", "match", "set", "game", etc.)
3. **Recursive Structure**: `parentId` FK to the same table enables unlimited nesting
4. **Player Association**: `playerId` is optional - null for structural stages, set for player-specific scores
5. **Scoring Data**: All scoring fields (value, place, points, won, lost, scoreType, stats) are in the same table

## Schema Structure

```typescript
stages {
  id: string (PK)
  name: string
  notes: string
  lat: real
  lng: real
  
  // Relationships
  venueId: string (FK to venues) - optional
  playerId: string (FK to players) - optional, for player-specific stages
  parentId: string (FK to stages) - RECURSIVE, for hierarchy
  
  // Type and identification
  type: string - REQUIRED - sport-specific: "round", "hole", "match", "set", "game", etc.
  order: integer - for ordering within parent
  number: integer - optional, for numbered stages
  identifier: string - optional, for named stages
  
  // Date/time
  date: integer - for events (milliseconds timestamp)
  
  // Scoring results (computed/stored)
  value: real - primary score value
  place: integer - ranking (1st, 2nd, 3rd, etc.)
  placeFromEnd: integer - reverse ranking
  points: integer - points awarded
  won: boolean - did this win?
  lost: boolean - did this lose?
  scoreType: string - descriptive: "hole-in-one", "eagle", "birdie", "ace", etc.
  stats: JSON - additional statistics
  
  // Metadata
  metadata: JSON - flexible additional data
  
  // Timestamps
  recordedAt: integer - when recorded
  complete: boolean - is this stage complete?
  frozen: boolean - legacy compatibility
}
```

## Usage Examples

### Example 1: Golf Round (Simple, Flat)

```
Venue: "Pebble Beach" (type="venue")

Round (Event):
  Stage {
    id: "round1"
    type: "round"
    parentId: null
    venueId: "pebble-beach"
    playerId: null
    date: 1705276800000
    name: "Morning Round"
  }

Holes (Segments):
  Stage {
    id: "hole1"
    type: "hole"
    parentId: "round1"
    number: 1
    playerId: null
  }
  Stage {
    id: "hole2"
    type: "hole"
    parentId: "round1"
    number: 2
    playerId: null
  }
  ... (18 holes)

Player Scores:
  Stage {
    id: "score1"
    type: "score"
    parentId: "hole1"
    playerId: "player1"
    value: 4
    place: 1
    points: 10
    won: true
    scoreType: "par"
  }
  Stage {
    id: "score2"
    type: "score"
    parentId: "hole1"
    playerId: "player2"
    value: 5
    place: 2
    points: 5
    won: false
    scoreType: "bogey"
  }
```

### Example 2: Tennis Match (2-Level Nesting)

```
Venue: "Wimbledon Centre Court"

Match (Event):
  Stage {
    id: "match1"
    type: "match"
    parentId: null
    venueId: "wimbledon"
    playerId: null
    date: 1705276800000
    name: "Championship Match"
  }

Sets:
  Stage {
    id: "set1"
    type: "set"
    parentId: "match1"
    number: 1
    playerId: null
  }
  Stage {
    id: "set2"
    type: "set"
    parentId: "match1"
    number: 2
    playerId: null
  }

Games (within Set 1):
  Stage {
    id: "game1"
    type: "game"
    parentId: "set1"
    number: 1
    playerId: null
  }
  Stage {
    id: "game2"
    type: "game"
    parentId: "set1"
    number: 2
    playerId: null
  }
  ... (more games)

Player Results (per Set):
  Stage {
    id: "result1"
    type: "result"
    parentId: "set1"
    playerId: "player1"
    value: 6
    won: true
    stats: { gamesWon: 6, gamesLost: 4 }
  }
  Stage {
    id: "result2"
    type: "result"
    parentId: "set1"
    playerId: "player2"
    value: 4
    won: false
    stats: { gamesWon: 4, gamesLost: 6 }
  }
```

### Example 3: Tournament (Multi-Round)

```
Tournament:
  Stage {
    id: "tournament1"
    type: "tournament"
    parentId: null
    venueId: "pebble-beach"
    playerId: null
    date: 1705276800000
    name: "PGA Championship"
  }

Round 1:
  Stage {
    id: "round1"
    type: "round"
    parentId: "tournament1"
    number: 1
    date: 1705276800000
    playerId: null
  }

Round 2:
  Stage {
    id: "round2"
    type: "round"
    parentId: "tournament1"
    number: 2
    date: 1705363200000
    playerId: null
  }

Holes (within Round 1):
  Stage {
    id: "hole1"
    type: "hole"
    parentId: "round1"
    number: 1
    playerId: null
  }
  ... (18 holes per round)
```

### Example 4: Swimming Meet (Named Events)

```
Venue: "Olympic Pool"

Meet (Event):
  Stage {
    id: "meet1"
    type: "meet"
    parentId: null
    venueId: "olympic-pool"
    playerId: null
    date: 1705276800000
    name: "Regional Championships"
  }

Races:
  Stage {
    id: "race1"
    type: "race"
    parentId: "meet1"
    identifier: "Men's 100m Freestyle"
    playerId: null
  }
  Stage {
    id: "race2"
    type: "race"
    parentId: "meet1"
    identifier: "Women's 200m Backstroke"
    playerId: null
  }

Swimmer Results:
  Stage {
    id: "result1"
    type: "result"
    parentId: "race1"
    playerId: "swimmer1"
    value: 45.23
    place: 1
    won: true
    stats: { timeMs: 45230, lane: 3 }
    scoreType: "personal-best"
  }
```

## Query Patterns

### Get all children of a stage
```typescript
const children = await db
  .select()
  .from(stages)
  .where(eq(stages.parentId, parentStageId))
  .orderBy(stages.order, stages.number);
```

### Get all top-level events for a venue
```typescript
const events = await db
  .select()
  .from(stages)
  .where(
    and(
      eq(stages.venueId, venueId),
      isNull(stages.parentId),
      eq(stages.type, 'round') // or 'match', 'meet', etc.
    )
  )
  .orderBy(stages.date);
```

### Get all scores for a player in an event
```typescript
const scores = await db
  .select()
  .from(stages)
  .where(
    and(
      eq(stages.playerId, playerId),
      // Find all stages that are descendants of the event
      // This requires recursive CTE or multiple queries
    )
  );
```

### Get player's total score for an event
```typescript
// Get all score-type stages for this player under this event
const scores = await db
  .select()
  .from(stages)
  .where(
    and(
      eq(stages.playerId, playerId),
      eq(stages.type, 'score'),
      // Need to check if parent chain includes eventId
    )
  );

const total = scores.reduce((sum, s) => sum + (s.value || 0), 0);
```

## Advantages

1. **Simplicity**: One table for everything - easier to understand and maintain
2. **Flexibility**: Handles any sport structure without schema changes
3. **Recursive**: Unlimited nesting depth
4. **Unified Scoring**: All scoring data in one place
5. **Type Safety**: Type column allows sport-specific terminology
6. **FK Integrity**: Parent FK ensures referential integrity

## Considerations

1. **Query Complexity**: Recursive queries may be more complex (can use CTEs)
2. **Uniqueness**: Need application-level logic for context-specific uniqueness
3. **Type Management**: Need to manage valid types per sport
4. **Migration**: Existing data needs careful migration strategy

## Migration from Current Schema

### Current → Unified Stages Mapping

| Current Table | Unified Stages |
|--------------|----------------|
| `rounds` | `stages` with `type="round"`, `parentId=null` |
| `holes` | `stages` with `type="hole"`, `parentId=roundId` |
| `playerRounds` | Not needed - player association via `playerId` in score stages |
| `playerRoundHoleScores` | `stages` with `type="score"`, `parentId=holeId`, `playerId=playerId` |
| `courses` | `venues` (separate table) |

### Migration Steps

1. Create `venues` table from `courses`
2. Create `stages` table
3. Migrate rounds → stages (type="round")
4. Migrate holes → stages (type="hole", parentId=roundId)
5. Migrate scores → stages (type="score", parentId=holeId, playerId=playerId)
6. Update all application code to use new schema
7. Drop old tables

## Type System

The `type` column uses sport-specific terminology. Examples:

- **Golf**: "round", "hole", "score"
- **Tennis**: "match", "set", "game", "result"
- **Swimming**: "meet", "race", "heat", "result"
- **Bowling**: "series", "game", "frame", "score"
- **Volleyball**: "match", "set", "result"
- **Track**: "meet", "event", "heat", "result"

The application should maintain a mapping of valid types per sport for validation.


