# Drizzle ORM Migration Summary

## Overview
The codebase has been migrated from a custom ORM to Drizzle ORM with cross-platform support (web, Android, iOS).

## Completed Tasks

### 1. Dependencies Installed ✅
- `drizzle-orm` - Core ORM library
- `expo-sqlite` - SQLite for React Native
- `sql.js` - WASM SQLite for web
- `@types/sql.js` - TypeScript types

### 2. Database Infrastructure ✅
- **Adapter** (`src/services/storage/db/adapter.ts`): Cross-platform database initialization
  - Web: Uses sql.js with IndexedDB persistence
  - React Native: Uses expo-sqlite
  - Automatic platform detection

- **Schema** (`src/services/storage/db/schema.ts`): All tables defined in Drizzle format
  - `players` - Users and players (shared table)
  - `teamMembers` - Team relationships
  - `courses` - Golf courses
  - `holes` - Course holes
  - `rounds` - Golf rounds
  - `playerRounds` - UserRound entities
  - `playerRoundHoleScores` - Score entities
  - `currentPlayer` - Current user tracking
  - `photos` - Photo references
  - `mergeEntries` - Data merge tracking

- **Helpers** (`src/services/storage/db/helpers.ts`): Common CRUD operations
  - `getAll`, `getById`, `getByName`
  - `getAllWhere`, `getOneWhere`
  - `insert`, `upsert`
  - `deleteById`, `deleteWhere`
  - `existsWhere`, `countAll`, `countWhere`

- **Utils** (`src/services/storage/db/utils.ts`): Data transformation
  - JSON serialization/deserialization for location fields
  - `transformRecord` - Database → Application format
  - `transformForDb` - Application → Database format

### 3. Storage Services Converted ✅
- ✅ `courseStorage.ts` - Course management
- ✅ `holeStorage.ts` - Hole management
- ✅ `roundStorage.ts` - Round management (simplified)
- ✅ `userRoundStorage.ts` - UserRound management
- ✅ `userStorage.ts` - User/Player management
- ✅ `scoreStorage.ts` - Score management

## Remaining Tasks

### 4. Additional Storage Services (Not Yet Converted)
- `photoStorage.ts` - Photo management
- `currentUserStorage.ts` - Current user tracking
- `mergeEntriesStorage.ts` - Merge entry management (if exists)
- `cardModeStorage.ts` - Card mode storage (needs update for new API)

### 5. Data Migration
A migration utility is needed to:
1. Read data from old localStorage/IndexedDB format
2. Transform to new Drizzle schema format
3. Write to new SQLite database
4. Handle schema differences (e.g., location JSON serialization)

### 6. Cleanup
- Remove old ORM files:
  - `src/services/storage/orm/` directory
  - `src/services/storage/schemaBuilder/` directory (if not used)
- Update imports throughout codebase
- Remove unused dependencies

### 7. Testing
- Test on web platform
- Test on Android
- Test on iOS
- Verify data persistence
- Test migrations

## Known Issues

1. **Score Storage**: `holeId` field in `playerRoundHoleScores` needs to be resolved from `holeNumber`. Currently using a placeholder.

2. **Schema Mismatch**: The Score type uses `throws` but the database schema uses `score`. This is handled in the mapping functions.

3. **Old ORM Files**: The old ORM files still exist and have linter errors. They should be removed once migration is complete.

4. **Migration Functions**: The old migration functions in `roundStorage.ts` and `courseStorage.ts` were removed. These need to be reimplemented for the new database format if needed.

## Usage Example

```typescript
import { setupDatabase } from '@services/storage/db';
import { getAllCourses, saveCourse } from '@services/storage/courseStorage';

// Initialize database (call once at app startup)
await setupDatabase();

// Use storage services
const courses = await getAllCourses();
await saveCourse({ id: '...', name: 'My Course', ... });
```

## Next Steps

1. **Complete remaining storage services** (photoStorage, currentUserStorage, etc.)
2. **Create data migration utility** to migrate existing data
3. **Test on all platforms** (web, Android, iOS)
4. **Remove old ORM code** once migration is verified
5. **Update documentation** with new API usage

## Notes

- Foreign key constraints and cascade deletes are handled by SQLite
- Unique constraints are defined in the schema
- Location fields are stored as JSON strings and automatically parsed/stringified
- Timestamps are stored as milliseconds (integers)


