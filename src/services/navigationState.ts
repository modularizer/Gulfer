/**
 * Navigation state persistence service
 * Works on both web and mobile platforms
 */

import { Platform } from 'react-native';
import { getItem, setItem } from './storage/storageAdapter';

const NAVIGATION_STATE_KEY = 'gulfer-navigation-state';
const MODAL_STATE_KEY_PREFIX = 'gulfer-modal-state-';

export interface NavigationState {
  pathname: string;
  searchParams?: Record<string, string>;
  timestamp: number;
}

export interface ModalState {
  [key: string]: any;
  timestamp?: number;
}

/**
 * Save the current navigation state
 */
export async function saveNavigationState(pathname: string, searchParams?: Record<string, string>): Promise<void> {
  try {
    const state: NavigationState = {
      pathname,
      searchParams,
      timestamp: Date.now(),
    };
    await setItem(NAVIGATION_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Error saving navigation state:', error);
  }
}

/**
 * Get the saved navigation state
 */
export async function getNavigationState(): Promise<NavigationState | null> {
  try {
    const stored = await getItem(NAVIGATION_STATE_KEY);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored) as NavigationState;
  } catch (error) {
    console.error('Error getting navigation state:', error);
    return null;
  }
}

/**
 * Clear the saved navigation state
 */
export async function clearNavigationState(): Promise<void> {
  try {
    await setItem(NAVIGATION_STATE_KEY, '');
  } catch (error) {
    console.error('Error clearing navigation state:', error);
  }
}

/**
 * Save modal state for a specific route
 * @param routePath The route pathname (e.g., '/round/123/overview')
 * @param modalState The modal state object
 */
export async function saveModalState(routePath: string, modalState: ModalState): Promise<void> {
  try {
    const key = `${MODAL_STATE_KEY_PREFIX}${routePath}`;
    const stateWithTimestamp = {
      ...modalState,
      timestamp: Date.now(),
    };
    await setItem(key, JSON.stringify(stateWithTimestamp));
  } catch (error) {
    console.error('Error saving modal state:', error);
  }
}

/**
 * Get saved modal state for a specific route
 * @param routePath The route pathname
 */
export async function getModalState(routePath: string, maxAge?: number): Promise<ModalState | null> {
  try {
    const key = `${MODAL_STATE_KEY_PREFIX}${routePath}`;
    const stored = await getItem(key);
    if (!stored) {
      return null;
    }
    const state = JSON.parse(stored) as ModalState;
    
    // Check expiration if maxAge is provided and state has a timestamp
    if (maxAge !== undefined && state.timestamp) {
      const age = Date.now() - state.timestamp;
      if (age > maxAge) {
        // State is too old, clear it and return null
        await clearModalState(routePath);
        return null;
      }
    }
    
    return state;
  } catch (error) {
    console.error('Error getting modal state:', error);
    return null;
  }
}

/**
 * Clear modal state for a specific route
 * @param routePath The route pathname
 */
export async function clearModalState(routePath: string): Promise<void> {
  try {
    const key = `${MODAL_STATE_KEY_PREFIX}${routePath}`;
    await setItem(key, '');
  } catch (error) {
    console.error('Error clearing modal state:', error);
  }
}

/**
 * Build a pathname with search params for navigation
 */
export function buildPathWithParams(pathname: string, searchParams?: Record<string, string>): string {
  if (!searchParams || Object.keys(searchParams).length === 0) {
    return pathname;
  }
  
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    params.append(key, value);
  });
  
  return `${pathname}?${params.toString()}`;
}

