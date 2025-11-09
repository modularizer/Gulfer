/**
 * Storage service for managing users/players locally
 * Uses localforage (IndexedDB on web, native storage on mobile)
 */

import { getItem, setItem } from './storageAdapter';

export interface User {
  id: string;
  name: string;
  username: string; // Unique identifier, defaults to name
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
      // Update username if not set
      if (!existingUser.username) {
        existingUser.username = generateUniqueUsername(name, users.filter(u => u.id !== existingUser.id));
      }
      await setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } else {
      const newUser: User = {
        id: 'current_user',
        name,
        username: generateUniqueUsername(name, users),
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
 * Generate a unique username from a name
 * If the name is already taken, appends a number
 */
function generateUniqueUsername(name: string, existingUsers: User[]): string {
  const baseUsername = name.trim().toLowerCase().replace(/\s+/g, '_');
  let username = baseUsername;
  let counter = 1;
  
  while (existingUsers.some(u => u.username === username)) {
    username = `${baseUsername}_${counter}`;
    counter++;
  }
  
  return username;
}

/**
 * Save a user to local storage
 * Ensures username is unique
 */
export async function saveUser(user: User): Promise<void> {
  try {
    const users = await getAllUsers();
    
    // Ensure username is set (default to name if not provided)
    if (!user.username) {
      user.username = generateUniqueUsername(user.name, users.filter(u => u.id !== user.id));
    }
    
    // Check for username conflicts (excluding current user)
    const conflictingUser = users.find(u => u.id !== user.id && u.username === user.username);
    if (conflictingUser) {
      // Generate a unique username
      user.username = generateUniqueUsername(user.name, users.filter(u => u.id !== user.id));
    }
    
    const existingIndex = users.findIndex((u) => u.id === user.id);
    
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
 * Get a user by username
 */
export async function getUserByUsername(username: string): Promise<User | null> {
  try {
    const users = await getAllUsers();
    return users.find(u => u.username === username) || null;
  } catch (error) {
    console.error('Error loading user by username:', error);
    return null;
  }
}

/**
 * Check if a username is available
 */
export async function isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
  try {
    const users = await getAllUsers();
    return !users.some(u => u.username === username && u.id !== excludeUserId);
  } catch (error) {
    console.error('Error checking username availability:', error);
    return false;
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
 * Generate a new unique user ID
 */
export function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get username for a player name
 * Looks up User by name and returns username, or generates one if not found
 */
export async function getUsernameForPlayerName(playerName: string): Promise<string> {
  try {
    const users = await getAllUsers();
    const user = users.find(u => u.name === playerName);
    if (user && user.username) {
      return user.username;
    }
    // If no user found, generate a unique username based on the name
    return generateUniqueUsername(playerName, users);
  } catch (error) {
    console.error('Error getting username for player name:', error);
    // Fallback: generate username from name
    const users = await getAllUsers();
    return generateUniqueUsername(playerName, users);
  }
}

/**
 * Ensure a player has a username, setting it if missing
 */
export async function ensurePlayerHasUsername(player: { name: string; username?: string }): Promise<{ name: string; username: string }> {
  if (player.username) {
    return { name: player.name, username: player.username };
  }
  
  const username = await getUsernameForPlayerName(player.name);
  return { name: player.name, username };
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

