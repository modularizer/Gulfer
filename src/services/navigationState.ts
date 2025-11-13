/**
 * Navigation state persistence service
 * Uses Drizzle ORM directly
 */

import { getSettings, updateSettings } from './storage/settingsHelper';

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
  const state: NavigationState = {
    pathname,
    searchParams,
    timestamp: Date.now(),
  };
  
  const settings = await getSettings();
  const other = settings.other ? { ...settings.other } : {};
  other[NAVIGATION_STATE_KEY] = state;
  
  await updateSettings({ other });
}

/**
 * Get the saved navigation state
 */
export async function getNavigationState(): Promise<NavigationState | null> {
  const settings = await getSettings();
  
  if (settings.other) {
    const stored = settings.other[NAVIGATION_STATE_KEY];
    if (stored) {
      return stored as NavigationState;
    }
  }
  return null;
}

/**
 * Clear the saved navigation state
 */
export async function clearNavigationState(): Promise<void> {
  const settings = await getSettings();
  
  if (settings.other) {
    const other = { ...settings.other };
    delete other[NAVIGATION_STATE_KEY];
    await updateSettings({ other });
  }
}

/**
 * Save modal state for a specific route
 * @param routePath The route pathname (e.g., '/round/123/overview')
 * @param modalState The modal state object
 */
export async function saveModalState(routePath: string, modalState: ModalState): Promise<void> {
  const key = `${MODAL_STATE_KEY_PREFIX}${routePath}`;
  const stateWithTimestamp = {
    ...modalState,
    timestamp: Date.now(),
  };
  
  const settings = await getSettings();
  const other = settings.other ? { ...settings.other } : {};
  other[key] = stateWithTimestamp;
  
  await updateSettings({ other });
}

/**
 * Get saved modal state for a specific route
 * @param routePath The route pathname
 */
export async function getModalState(routePath: string, maxAge?: number): Promise<ModalState | null> {
  const key = `${MODAL_STATE_KEY_PREFIX}${routePath}`;
  const settings = await getSettings();
  
  if (settings.other) {
    const stored = settings.other[key];
    if (!stored) {
      return null;
    }
    const state = stored as ModalState;
    
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
  }
  
  return null;
}

/**
 * Clear modal state for a specific route
 * @param routePath The route pathname
 */
export async function clearModalState(routePath: string): Promise<void> {
  const key = `${MODAL_STATE_KEY_PREFIX}${routePath}`;
  const settings = await getSettings();
  
  if (settings.other) {
    const other = { ...settings.other };
    delete other[key];
    await updateSettings({ other });
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
