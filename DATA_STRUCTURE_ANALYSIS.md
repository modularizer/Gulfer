# Data Structure Analysis

## Current State

### ✅ Good Things
1. **Storage Backend**: Using `localforage` with IndexedDB (good quota, cross-platform)
2. **Error Handling**: Proper try/catch and quota error handling
3. **Separation of Concerns**: Clear storage service modules
4. **Type Definitions**: TypeScript types defined

### ⚠️ Issues Found

#### 1. **Player ID/Name Inconsistency** (CRITICAL)
- **Problem**: Navigation uses player **names** as IDs (`/player/${name}`), but:
  - `User` objects have generated IDs (`user_123...`)
  - `Player` objects in rounds have different IDs (`player_1` or generated)
  - `Score.playerId` references round player IDs, not User IDs
  - Code matches by name as fallback, which is fragile

- **Impact**: 
  - If a user changes their name, old rounds won't match properly
  - Player statistics may be incorrect
  - Data integrity issues

- **Example**: 
  ```typescript
  // User has: { id: 'user_123', name: 'John' }
  // Round has: { players: [{ id: 'player_1', name: 'John' }] }
  // Score has: { playerId: 'player_1', ... }
  // Navigation uses: /player/John
  // Matching requires: round.players.find(p => p.name === user.name)
  ```

#### 2. **Course.holes Type Inconsistency** (MODERATE)
- **Problem**: `Course.holes` can be `Hole[]` OR `number` (backward compatibility)
- **Impact**: 
  - Requires `Array.isArray()` checks everywhere
  - Not type-safe
  - Confusing for developers

- **Current Code**:
  ```typescript
  const holeCount = Array.isArray(course.holes) 
    ? course.holes.length 
    : (course.holes as unknown as number || 0);
  ```

#### 3. **User vs Player Duplication** (MODERATE)
- **Problem**: Two separate concepts:
  - `User` - stored in `userStorage.ts` (global user list)
  - `Player` - embedded in `Round.players[]` (round-specific)
  
- **Impact**:
  - Data duplication
  - No clear relationship
  - Users can exist without being in any rounds
  - Players in rounds can exist without being Users

#### 4. **No Referential Integrity** (MODERATE)
- **Problem**: 
  - If course name changes, rounds still reference old name
  - If player name changes, rounds have old name
  - No validation that referenced entities exist

- **Impact**: 
  - Orphaned data
  - Inconsistent displays
  - Potential data loss

#### 5. **No Data Migration Strategy** (LOW)
- **Problem**: If schema changes, no migration path
- **Impact**: Breaking changes could lose data

#### 6. **Course ID vs Name** (LOW)
- **Problem**: Courses have generated IDs but accessed by name
- **Impact**: If course name changes, references break

## Recommendations

### High Priority

1. **Unify Player Identity**:
   - Use player **names** as the primary identifier everywhere
   - Remove generated IDs for players
   - Store player name in `Score` instead of `playerId`
   - Update `Round.players` to just store names (or minimal Player objects with name as ID)

2. **Fix Course.holes Type**:
   - Migrate all courses to use `Hole[]` format
   - Remove backward compatibility checks
   - Add migration function to convert old format

### Medium Priority

3. **Simplify User/Player Model**:
   - Consider: Do we need separate `User` storage?
   - Or: Make `User` the source of truth, `Player` in rounds just references User
   - Or: Remove `User` storage, derive players from rounds

4. **Add Data Validation**:
   - Validate that course names in rounds exist
   - Validate that player names in rounds are valid
   - Add schema validation on load

### Low Priority

5. **Add Migration System**:
   - Version storage schema
   - Add migration functions for breaking changes

6. **Consider Normalization**:
   - Store courses/courses separately
   - Reference by ID (but use stable IDs, not generated)

## Proposed Data Model

```typescript
// Simplified, unified model
interface Player {
  name: string; // Primary identifier
  // Optional metadata could be stored separately
}

interface Score {
  playerName: string; // Reference by name, not ID
  holeNumber: number;
  throws: number;
}

interface Round {
  id: string;
  date: number;
  players: Player[]; // Just names
  scores: Score[]; // Reference by name
  courseName?: string; // Reference by name
  // ...
}

interface Course {
  id: string; // Keep for internal use
  name: string; // Primary identifier for references
  holes: Hole[]; // Always array, never number
}
```

This would:
- Eliminate ID/name confusion
- Make data more consistent
- Simplify matching logic
- Reduce data duplication

