# Storage Driver Architecture

This directory contains the storage driver abstraction layer that separates generic storage logic from implementation-specific details.

## Architecture Overview

The storage system uses an abstract base class pattern:

1. **`StorageDriver`** - Abstract base class that defines:
   - Generic CRUD operations (implemented in base class)
   - Abstract methods that must be implemented by concrete drivers

2. **`LocalStorageDriver`** - Concrete implementation using platform-specific storage (localforage on web, AsyncStorage on React Native)

3. **Future Drivers** - Can be added by extending `StorageDriver` and implementing the abstract methods

## Current Driver

### LocalStorageDriver

Uses platform-specific storage:
- **Web**: localforage (IndexedDB)
- **React Native**: AsyncStorage

The platform detection and initialization is handled directly in `LocalStorageDriver`.

This is the default driver used throughout the application.

## Creating a New Driver

To create a new storage driver (e.g., for SQLite, a REST API, etc.):

1. Create a new file in this directory (e.g., `SQLiteDriver.ts`)

2. Extend the `StorageDriver` class:

```typescript
import { StorageDriver } from './StorageDriver';

export class SQLiteDriver extends StorageDriver {
  // Implement abstract methods
  protected async getRaw(key: string): Promise<string | null> {
    // Your implementation
  }
  
  protected async setRaw(key: string, value: string): Promise<void> {
    // Your implementation
  }
  
  protected async removeRaw(key: string): Promise<void> {
    // Your implementation
  }
  
  protected async getAllKeys(): Promise<string[]> {
    // Your implementation
  }
  
  protected async clearAll(): Promise<void> {
    // Your implementation
  }
  
  // Optionally override generic methods for optimization
  // For example, if your storage supports transactions:
  async saveEntities<T extends BaseEntity>(
    config: EntityStorageConfig<T>,
    entitiesToSave: T[]
  ): Promise<void> {
    // Custom implementation with transaction support
  }
}
```

3. Update `defaultStorageDriver` in `LocalStorageDriver.ts` or create a driver factory to switch between drivers.

## Using Drivers

### Using the Default Driver

The convenience functions in `entityStorage.ts` use the default driver:

```typescript
import { getAllEntities, saveEntity } from '@/services/storage/entityStorage';

const config = {
  storageKey: '@gulfer_courses',
  schema: courseSchema,
  entityName: 'Course',
};

const courses = await getAllEntities(config);
await saveEntity(config, newCourse);
```

### Using a Custom Driver Directly

```typescript
import { SQLiteDriver } from '@/services/storage/drivers/SQLiteDriver';

const customDriver = new SQLiteDriver();
const courses = await customDriver.getAllEntities(config);
```

## Abstract Methods

All drivers must implement these abstract methods:

- `getRaw(key: string): Promise<string | null>` - Get raw string value
- `setRaw(key: string, value: string): Promise<void>` - Set raw string value
- `removeRaw(key: string): Promise<void>` - Remove a key
- `getAllKeys(): Promise<string[]>` - Get all storage keys
- `clearAll(): Promise<void>` - Clear all storage

## Generic Methods (Implemented in Base Class)

These methods are implemented in the base class using the abstract methods above:

- `getAllEntities<T>(config): Promise<T[]>`
- `getEntityById<T>(config, id): Promise<T | null>`
- `saveEntity<T>(config, entity): Promise<void>`
- `saveEntities<T>(config, entities): Promise<void>`
- `deleteEntity<T>(config, id): Promise<void>`
- `deleteEntities<T>(config, ids): Promise<void>`
- `generateEntityId<T>(config): Promise<string>`
- `getEntitiesByName<T>(config, name): Promise<T[]>`
- `getEntityByName<T>(config, name): Promise<T | null>`

Drivers can override these methods for optimization (e.g., using transactions, batch operations, etc.).

## Benefits

1. **Separation of Concerns**: Generic logic is separated from implementation details
2. **Easy Testing**: Can create mock drivers for testing
3. **Flexibility**: Easy to swap storage implementations
4. **Extensibility**: Can add new drivers without changing existing code
5. **Optimization**: Drivers can override methods for storage-specific optimizations

