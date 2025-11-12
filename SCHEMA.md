# Data Schema Documentation

## Overview

The Gulfer app now uses a well-defined schema system with runtime validation. All data types are defined using [Zod](https://zod.dev/), which provides:

- **Runtime validation**: Data is validated when loaded from storage
- **Type safety**: TypeScript types are automatically inferred from schemas
- **Error handling**: Clear error messages when validation fails
- **Data integrity**: Ensures data conforms to expected structure

## Schema Location

All schemas are defined in `src/types/schema.ts` and re-exported from `src/types/index.ts` for backward compatibility.

## Core Entities

### Player
```typescript
{
  id: string;        // 6-character hex UUID (e.g., "a1b2c3")
  name: string;      // 1-200 characters, required
}
```

### Hole
```typescript
{
  number: number;    // Positive integer (hole number)
  par?: number;      // Optional positive integer
  distance?: number; // Optional non-negative number (meters/feet)
}
```

### Score
```typescript
{
  playerId: string;   // 6-character hex UUID (references Player)
  holeNumber: number; // Positive integer
  throws: number;    // Non-negative integer
}
```

### Round
```typescript
{
  id: string;              // 6-character hex UUID
  title: string;           // 1-500 characters
  date: number;            // Unix timestamp (non-negative)
  players: Player[];       // At least 1 player required
  scores: Score[];         // Array of scores
  photos?: string[];       // Optional array of image hashes
  courseName?: string;     // Optional course name (1-200 chars)
  courseId?: string;        // Optional 6-character hex UUID
  notes?: string;          // Optional notes (max 10,000 chars)
}
```

**Validation Rules:**
- All scores must reference valid players (playerId must exist in players array)
- At least one player is required

### Course
```typescript
{
  id: string;          // 6-character hex UUID
  name: string;        // 1-200 characters, required
  holes: Hole[];      // At least 1 hole required
  location?: {         // Optional GPS coordinates
    latitude: number;  // -90 to 90
    longitude: number; // -180 to 180
  };
  notes?: string;      // Optional notes (max 10,000 chars)
}
```

**Validation Rules:**
- Hole numbers must be sequential starting from 1 (1, 2, 3, ...)
- At least one hole is required

### User
```typescript
{
  id: string;           // 6-character hex UUID
  name: string;         // 1-200 characters, required
  isCurrentUser?: boolean; // Optional flag
  notes?: string;       // Optional notes (max 10,000 chars)
}
```

## Storage Keys

### Collections (Arrays)
- `@gulfer_rounds` - Array of Round objects
- `@gulfer_courses` - Array of Course objects
- `@gulfer_users` - Array of User objects

### Individual Items
- `@gulfer_storage_id` - Storage instance UUID (6 hex chars)
- `@gulfer_current_user` - Current user's name (string)
- `@gulfer_profile_image` - Profile image hash (string)
- `@gulfer_uuid_merges` - Merge table (object)
- `@gulfer_card_mode_{page}` - Card mode preference per page
- `@gulfer_column_visibility` - Column visibility config
- `@gulfer_corner_config` - Corner statistics config
- `@gulfer_image_{hash}` - Image data (base64 string on web, file path on mobile)

## Validation Functions

### `validateAndParse<T>(schema, data, context?)`
Safely validates data and returns a result object:
```typescript
const result = validateAndParse(roundSchema, data, 'Round data');
if (result.success) {
  const round: Round = result.data;
} else {
  console.error(result.error);
}
```

### `parseOrThrow<T>(schema, data, context?)`
Validates data and throws an error if invalid:
```typescript
try {
  const round = parseOrThrow(roundSchema, data, 'Round data');
  // round is guaranteed to be valid
} catch (error) {
  // Handle validation error
}
```

### `validateArray<T>(schema, data, context?)`
Validates an array of entities:
```typescript
const result = validateArray(roundSchema, data, 'Rounds');
if (result.success) {
  const rounds: Round[] = result.data;
}
```

## Usage in Storage Services

Storage services now validate data when loading and saving:

```typescript
// Loading with validation
export async function getAllRounds(): Promise<Round[]> {
  const data = await getItem(ROUNDS_STORAGE_KEY);
  if (data) {
    const parsed = JSON.parse(data);
    const result = validateArray(roundSchema, parsed, 'Rounds');
    if (result.success) {
      return result.data;
    } else {
      console.error('Validation error:', result.error);
      return []; // Or implement recovery logic
    }
  }
  return [];
}

// Saving with validation
export async function saveRound(round: Round): Promise<void> {
  const validation = roundSchema.safeParse(round);
  if (!validation.success) {
    throw new Error(`Invalid round: ${validation.error.message}`);
  }
  // Save validated data
}
```

## Migration Strategy

When schema changes are needed:

1. **Increment `SCHEMA_VERSION`** in `schema.ts`
2. **Add migration logic** in storage services
3. **Update schemas** with new fields (mark as optional initially if needed)
4. **Test migration** with existing data

Example migration pattern:
```typescript
const CURRENT_MIGRATION_VERSION = 2;

async function migrateRounds(): Promise<void> {
  const version = await getItem(MIGRATION_VERSION_KEY);
  if (version && parseInt(version) >= CURRENT_MIGRATION_VERSION) {
    return; // Already migrated
  }
  
  const rounds = await getAllRounds();
  // Apply migration logic
  for (const round of rounds) {
    // Transform data
  }
  
  await setItem(MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION.toString());
}
```

## Benefits

1. **Data Integrity**: Invalid data is caught at load/save time
2. **Type Safety**: TypeScript types match runtime validation
3. **Better Errors**: Clear error messages when validation fails
4. **Documentation**: Schema serves as living documentation
5. **Refactoring Safety**: Schema changes are caught at compile time

## Future Enhancements

- [ ] Add schema versioning and migration helpers
- [ ] Add data sanitization/transformation utilities
- [ ] Add schema export for API documentation
- [ ] Add validation for storage keys
- [ ] Add schema-based data generators for testing

