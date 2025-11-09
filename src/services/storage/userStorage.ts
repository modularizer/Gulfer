/**
 * Storage service for managing users/players locally
 * Uses localforage (IndexedDB on web, native storage on mobile)
 */

import { getItem, setItem } from './storageAdapter';

export interface User {
  id: string; // UUID for global uniqueness
  name: string; // Locally unique name
  isCurrentUser?: boolean; // Flag to identify the current user
}

const USERS_STORAGE_KEY = '@gulfer_users';
const CURRENT_USER_KEY = '@gulfer_current_user';
const PROFILE_IMAGE_KEY = '@gulfer_profile_image';

/**
 * Get all saved users
 */
export async function getAllUsers(): Promise<User[]> {
  try {
    const data = await getItem(USERS_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Error loading users:', error);
    return [];
  }
}

/**
 * Get the current user's name
 */
export async function getCurrentUserName(): Promise<string | null> {
  try {
    const name = await getItem(CURRENT_USER_KEY);
    return name;
  } catch (error) {
    console.error('Error loading current user name:', error);
    return null;
  }
}

/**
 * Save the current user's name
 */
export async function saveCurrentUserName(name: string): Promise<void> {
  try {
    await setItem(CURRENT_USER_KEY, name);
    
    // Also save to users list if not already there
    const users = await getAllUsers();
    const existingUser = users.find(u => u.isCurrentUser);
    
    if (existingUser) {
      existingUser.name = name;
      await setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } else {
      const newUserId = await generateUserId();
      const newUser: User = {
        id: newUserId,
        name,
        isCurrentUser: true,
      };
      users.push(newUser);
      await setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    }
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
  try {
    const users = await getAllUsers();
    const existingIndex = users.findIndex((u) => u.id === user.id);
    
    // Check for name uniqueness (case-insensitive, excluding current user)
    const trimmedName = user.name.trim();
    const nameConflict = users.find(u => 
      u.id !== user.id && 
      u.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    
    if (nameConflict) {
      throw new Error(`A user with the name "${trimmedName}" already exists`);
    }
    
    if (existingIndex >= 0) {
      users[existingIndex] = user;
    } else {
      users.push(user);
    }
    
    await setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (error) {
    console.error('Error saving user:', error);
    throw error;
  }
}

/**
 * Get a user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const users = await getAllUsers();
    return users.find((u) => u.id === userId) || null;
  } catch (error) {
    console.error('Error loading user by ID:', error);
    return null;
  }
}

/**
 * Delete a user by ID
 */
export async function deleteUser(userId: string): Promise<void> {
  try {
    const users = await getAllUsers();
    const filtered = users.filter((u) => u.id !== userId);
    await setItem(USERS_STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

/**
 * Generate a new unique user ID (6 hex characters)
 * Ensures local uniqueness by checking existing users
 */
export async function generateUserId(): Promise<string> {
  const { generateUniqueUUID } = await import('../../utils/uuid');
  const users = await getAllUsers();
  const existingIds = new Set(users.map(u => u.id));
  return generateUniqueUUID(existingIds);
}

/**
 * Get a user by name (case-insensitive)
 */
export async function getUserByName(name: string): Promise<User | null> {
  try {
    const users = await getAllUsers();
    const trimmedName = name.trim();
    return users.find((u) => u.name.trim().toLowerCase() === trimmedName.toLowerCase()) || null;
  } catch (error) {
    console.error('Error loading user by name:', error);
    return null;
  }
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
    const hash = await getItem(PROFILE_IMAGE_KEY);
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
    await setItem(PROFILE_IMAGE_KEY, hash);
  } catch (error) {
    console.error('Error saving profile image hash:', error);
    throw error;
  }
}

