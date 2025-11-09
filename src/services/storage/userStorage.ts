/**
 * Storage service for managing users/players locally
 * Uses localforage (IndexedDB on web, native storage on mobile)
 */

import { getItem, setItem } from './storageAdapter';

export interface User {
  id: string;
  name: string;
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
      const newUser: User = {
        id: 'current_user',
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
 */
export async function saveUser(user: User): Promise<void> {
  try {
    const users = await getAllUsers();
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

