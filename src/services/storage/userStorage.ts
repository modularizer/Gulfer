/**
 * Storage service for managing users/players locally
 * Uses GenericStorageService for common operations
 */

import { defaultStorageDriver } from './drivers';
import { User, userSchema } from '@/types';
import { setCurrentUserId, getCurrentUserId, saveCurrentUserName as saveLegacyCurrentUserName } from './currentUserStorage';
import { TableDriver } from '@services/storage/orm/TableDriver';

// Re-export User type from types
export type { User };

const USERS_STORAGE_KEY = '@gulfer_users';
const PROFILE_IMAGE_KEY = '@gulfer_profile_image';
const USERS_MIGRATION_VERSION_KEY = '@gulfer_users_migration_version';
const CURRENT_USERS_MIGRATION_VERSION = 1; // Increment when adding new migrations

// Create generic storage service instance for users
const userStorage = new TableDriver<User>({
  storageKey: USERS_STORAGE_KEY,
  schema: userSchema,
  entityName: 'User',
  generatedFields: [
    { field: 'id' },
  ],
  uniqueFields: ['id', 'name'],
  cleanupBeforeSave: (user: User) => {
    // Remove legacy isCurrentUser field if present (now stored in separate table)
    const cleaned = { ...user };
    delete (cleaned as any).isCurrentUser;
    return cleaned;
  },
  foreignKeys: [
    {
      field: 'userId',
      referencesStorageKey: '@gulfer_user_rounds',
      cascadeDelete: true, // Delete all UserRounds when user is deleted
    },
    {
      field: 'userId',
      referencesStorageKey: '@gulfer_scores',
      cascadeDelete: true, // Delete all Scores when user is deleted
    },
    {
      field: 'refId',
      referencesStorageKey: '@gulfer_photos',
      cascadeDelete: true, // Delete all Photos when user is deleted (polymorphic)
      findChildren: (userId: string, allPhotos: any[]) => {
        return allPhotos.filter(photo => photo.refId === userId);
      },
    },
  ],
});

/**
 * Get all saved users
 */
export async function getAllUsers(): Promise<User[]> {
  return userStorage.getAll();
}

/**
 * Get the current user's name
 * Looks up the current user ID and returns the user's name
 */
export async function getCurrentUserName(): Promise<string | null> {
  try {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) {
      return null;
    }
    const user = await getUserById(currentUserId);
    return user?.name || null;
  } catch (error) {
    console.error('Error loading current user name:', error);
    return null;
  }
}

/**
 * Save the current user's name
 * Creates or updates a user with the given name and sets it as current user
 */
export async function saveCurrentUserName(name: string): Promise<void> {
  try {
    // Find or create user with this name
    let user = await getUserByName(name);
    
    if (!user) {
      // Create new user
      const newUserId = await generateUserId();
      user = {
        id: newUserId,
        name,
      };
      await saveUser(user);
    } else {
      // Update existing user name if different
      if (user.name !== name) {
        user.name = name;
        await saveUser(user);
      }
    }
    
    // Set as current user
    await setCurrentUserId(user.id);
    
    // Also save to legacy name storage for backward compatibility
    await saveLegacyCurrentUserName(name);
  } catch (error) {
    console.error('Error saving current user name:', error);
    throw error;
  }
}

/**
 * Save a user to local storage
 * Enforces local uniqueness of user names
 */
export async function saveUser(user: User): Promise<void> {
  return userStorage.save(user);
}

/**
 * Get a user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  return userStorage.getById(userId);
}

/**
 * Delete a user by ID
 */
export async function deleteUser(userId: string): Promise<void> {
  return userStorage.delete(userId);
}

/**
 * Generate a new unique user ID (16 hex characters)
 */
export async function generateUserId(): Promise<string> {
  return userStorage.generateId();
}

/**
 * Get a user by name (case-insensitive)
 */
export async function getUserByName(name: string): Promise<User | null> {
  return userStorage.getByName(name);
}

/**
 * Get user ID for a player name
 * Looks up User by name and returns ID, or creates a new user if not found
 */
export async function getUserIdForPlayerName(playerName: string): Promise<string> {
  try {
    const users = await getAllUsers();
    const trimmedName = playerName.trim();
    const user = users.find(u => u.name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (user) {
      return user.id;
    }
    // If no user found, create a new one
    const newUserId = await generateUserId();
    const newUser: User = {
      id: newUserId,
      name: trimmedName,
    };
    await saveUser(newUser);
    return newUserId;
  } catch (error) {
    console.error('Error getting user ID for player name:', error);
    // Fallback: generate new ID
    return await generateUserId();
  }
}

/**
 * Get the current user's profile image hash
 */
export async function getProfileImageHash(): Promise<string | null> {
  try {
    const hash = await defaultStorageDriver.getItem(PROFILE_IMAGE_KEY);
    return hash;
  } catch (error) {
    console.error('Error loading profile image hash:', error);
    return null;
  }
}

/**
 * Save the current user's profile image hash
 */
export async function saveProfileImageHash(hash: string): Promise<void> {
  try {
    await defaultStorageDriver.setItem(PROFILE_IMAGE_KEY, hash);
  } catch (error) {
    console.error('Error saving profile image hash:', error);
    throw error;
  }
}

/**
 * Migration: Move isCurrentUser from users table to current user table
 * This migration:
 * 1. Finds users with isCurrentUser = true
 * 2. Sets them as current user in the current user table
 * 3. Removes isCurrentUser field from users
 */
export async function migrateUsersRemoveIsCurrentUser(): Promise<{ migrated: number; failed: number }> {
  try {
    // Check if migration has already been run
    const migrationVersion = await defaultStorageDriver.getItem(USERS_MIGRATION_VERSION_KEY);
    if (migrationVersion && parseInt(migrationVersion, 10) >= CURRENT_USERS_MIGRATION_VERSION) {
      console.log('[Migration] Users isCurrentUser removal migration already completed');
      return { migrated: 0, failed: 0 };
    }
    
    console.log('[Migration] Starting users isCurrentUser removal migration...');
    const data = await defaultStorageDriver.getItem(USERS_STORAGE_KEY);
    if (!data) {
      await defaultStorageDriver.setItem(USERS_MIGRATION_VERSION_KEY, CURRENT_USERS_MIGRATION_VERSION.toString());
      return { migrated: 0, failed: 0 };
    }
    
    const users = JSON.parse(data);
    let migrated = 0;
    let failed = 0;
    let needsSave = false;
    let currentUserIdToSet: string | null = null;
    
    for (const user of users) {
      // Check if this user has isCurrentUser = true
      if (user.isCurrentUser === true) {
        try {
          // Set as current user in the new table
          if (!currentUserIdToSet) {
            currentUserIdToSet = user.id;
            await setCurrentUserId(user.id);
            migrated++;
          } else {
            // Multiple users with isCurrentUser = true, only keep the first one
            console.warn(`[Migration] Multiple users with isCurrentUser=true, keeping first: ${currentUserIdToSet}, skipping: ${user.id}`);
          }
          
          // Remove isCurrentUser from user
          delete user.isCurrentUser;
          needsSave = true;
        } catch (error) {
          console.error(`[Migration] Error migrating user ${user.id}:`, error);
          failed++;
        }
      } else if (user.isCurrentUser !== undefined) {
        // Remove isCurrentUser field even if it's false
        delete user.isCurrentUser;
        needsSave = true;
      }
    }
    
    // Save all migrated users (with isCurrentUser removed)
    if (needsSave) {
      await defaultStorageDriver.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      console.log(`[Migration] Moved ${migrated} current user(s) to current user table and removed isCurrentUser from users`);
    }
    
    // Mark migration as complete
    await defaultStorageDriver.setItem(USERS_MIGRATION_VERSION_KEY, CURRENT_USERS_MIGRATION_VERSION.toString());
    
    console.log(`[Migration] Users isCurrentUser removal complete: ${migrated} migrated, ${failed} failed`);
    return { migrated, failed };
  } catch (error) {
    console.error('[Migration] Error migrating users isCurrentUser:', error);
    throw error;
  }
}

