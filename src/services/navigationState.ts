/**
 * Navigation state persistence service
 * Uses Drizzle ORM with well-defined schema columns
 */

import { getSettings, updateSettings } from './storage/settingsHelper';

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
  
  await updateSettings({ navigationState: state });
}

/**
 * Get the saved navigation state
 */
export async function getNavigationState(): Promise<NavigationState | null> {
  const settings = await getSettings();
  return settings.navigationState || null;
}

/**
 * Clear the saved navigation state
 */
export async function clearNavigationState(): Promise<void> {
  await updateSettings({ navigationState: null });
}

/**
 * Save modal state for a specific route
 * @param routePath The route pathname (e.g., '/round/123/overview')
 * @param modalState The modal state object
 */
export async function saveModalState(routePath: string, modalState: ModalState): Promise<void> {
  const settings = await getSettings();
  const modalStates = settings.modalStates ? { ...settings.modalStates } : {};
  
  modalStates[routePath] = {
    ...modalState,
    timestamp: Date.now(),
  };
  
  await updateSettings({ modalStates });
}

/**
 * Get saved modal state for a specific route
 * @param routePath The route pathname
 */
export async function getModalState(routePath: string, maxAge?: number): Promise<ModalState | null> {
  const settings = await getSettings();
  
  if (!settings.modalStates) {
    return null;
  }
  
  const stored = settings.modalStates[routePath];
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

/**
 * Clear modal state for a specific route
 * @param routePath The route pathname
 */
export async function clearModalState(routePath: string): Promise<void> {
  const settings = await getSettings();
  
  if (settings.modalStates) {
    const modalStates = { ...settings.modalStates };
    delete modalStates[routePath];
    await updateSettings({ modalStates });
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
