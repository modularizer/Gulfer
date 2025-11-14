# Schema Examples: Current vs. Proposed

## Current Schema (Golf-Centric)

```
Sports
  └── Courses
       └── Holes (numbered 1-18)
            └── Rounds
                 └── PlayerRounds
                      └── Scores (one per player-hole)
```

**Example Data:**
- Sport: "Golf"
- Course: "Pebble Beach"
- Holes: 18 holes (Hole 1, Hole 2, ..., Hole 18)
- Round: "Morning Round - 2024-01-15"
- PlayerRound: "John Doe" in "Morning Round"
- Score: John scored 4 on Hole 1

## Proposed Schema (Generic)

### Option A: Recursive Segments (Recommended)

```
Sports
  └── Venues
       ├── Segments (venue-level templates)
       └── Events
            ├── Segments (event-specific)
            │    └── Segments (nested, if needed)
            └── PlayerEvents
                 └── Scores (one per player-segment)
```

**Example 1: Golf (Simple, Flat)**
- Sport: "Golf"
- Venue: "Pebble Beach" (Course)
- Event: "Morning Round - 2024-01-15"
- Segments: 18 segments (Hole 1, Hole 2, ..., Hole 18)
  - All have `parentSegmentId = NULL` (flat structure)
- PlayerEvent: "John Doe" in "Morning Round"
- Score: John scored 4 on Segment (Hole) 1

**Example 2: Tennis (2-Level Nesting)**
- Sport: "Tennis"
- Venue: "Wimbledon Centre Court"
- Event: "Championship Match - 2024-07-10"
- Segments (Sets):
  - Set 1 (`parentSegmentId = NULL`)
    - Game 1 (`parentSegmentId = Set1.id`)
    - Game 2 (`parentSegmentId = Set1.id`)
    - ...
  - Set 2 (`parentSegmentId = NULL`)
    - Game 1 (`parentSegmentId = Set2.id`)
    - ...
- PlayerEvent: "Player A" vs "Player B" (two PlayerEvents)
- Score: Player A won Set 1 with games [6, 4]

**Example 3: Swimming (Flat, Time-Based)**
- Sport: "Swimming"
- Venue: "Olympic Pool"
- Event: "Regional Meet - 2024-06-20"
- Segments: 
  - "Men's 100m Freestyle" (`identifier`, not numbered)
  - "Women's 200m Backstroke" (`identifier`)
  - "Men's 50m Butterfly" (`identifier`)
- PlayerEvent: "Swimmer A" in "Regional Meet"
- Score: Swimmer A's time: 45.23 seconds in "Men's 100m Freestyle"

**Example 4: Bowling (Flat, Simple)**
- Sport: "Bowling"
- Venue: "Lucky Strikes Alley"
- Event: "Friday Night League - 2024-01-19"
- Segments: 10 segments (Frame 1, Frame 2, ..., Frame 10)
- PlayerEvent: "Jane Doe" in "Friday Night League"
- Score: Jane scored 8 pins in Frame 1

## Key Differences

| Aspect | Current | Proposed |
|--------|---------|----------|
| **Top Level** | Course | Venue |
| **Competition** | Round | Event |
| **Scoring Unit** | Hole | Segment |
| **Nesting** | Fixed 3-level | Recursive (unlimited) |
| **Numbering** | Always numbered | Optional (identifier or number) |
| **Scoring Data** | Single integer | Flexible JSON structure |
| **Sport Flexibility** | Golf-specific | Generic, sport-agnostic |

## Database Schema Comparison

### Current: `playerRoundHoleScores`
```sql
CREATE TABLE player_round_hole_scores (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  hole_id TEXT NOT NULL,
  hole_number INTEGER NOT NULL,
  score INTEGER NOT NULL,  -- Single integer
  recorded_at INTEGER NOT NULL,
  complete INTEGER NOT NULL
);
```

### Proposed: `scores`
```sql
CREATE TABLE scores (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  segment_id TEXT NOT NULL,
  value REAL,  -- Primary value (for simple cases)
  scoring_data TEXT,  -- JSON for complex cases
  recorded_at INTEGER NOT NULL,
  complete INTEGER NOT NULL,
  metadata TEXT  -- Additional flexible storage
);
```

**Example Scoring Data:**

Golf (simple):
```json
{
  "type": "simple",
  "value": 4,
  "unit": "strokes"
}
```

Tennis (set-based):
```json
{
  "type": "set-based",
  "setsWon": 2,
  "setsLost": 1,
  "games": [
    { "gamesWon": 6, "gamesLost": 4 },
    { "gamesWon": 4, "gamesLost": 6 },
    { "gamesWon": 6, "gamesLost": 2 }
  ]
}
```

Swimming (time-based):
```json
{
  "type": "time",
  "timeMs": 45230,
  "timeDisplay": "45.23",
  "place": 1,
  "lane": 3
}
```

## Query Examples

### Current: Get all scores for a round
```typescript
const scores = await db
  .select()
  .from(playerRoundHoleScores)
  .where(eq(playerRoundHoleScores.roundId, roundId))
  .orderBy(playerRoundHoleScores.holeNumber);
```

### Proposed: Get all scores for an event
```typescript
const scores = await db
  .select()
  .from(scores)
  .where(eq(scores.eventId, eventId))
  .orderBy(scores.segmentId); // Or join with segments for ordering
```

### Proposed: Get nested segments (Tennis)
```typescript
// Get all sets (top-level segments)
const sets = await db
  .select()
  .from(segments)
  .where(
    and(
      eq(segments.eventId, eventId),
      isNull(segments.parentSegmentId)
    )
  )
  .orderBy(segments.order);

// Get games for a specific set
const games = await db
  .select()
  .from(segments)
  .where(eq(segments.parentSegmentId, setId))
  .orderBy(segments.order);
```

## Migration Path

### Step 1: Add new tables alongside old ones
- Create `venues`, `events`, `segments`, `playerEvents`, `scores` tables
- Keep old tables intact

### Step 2: Dual-write mode
- Write to both old and new tables
- Read from new tables when available, fallback to old

### Step 3: Data migration
- Migrate all existing data
- Verify data integrity

### Step 4: Switch to new tables
- Update all code to use new tables
- Remove old table dependencies

### Step 5: Cleanup
- Drop old tables
- Remove migration code

