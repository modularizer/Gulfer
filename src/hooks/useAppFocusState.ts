/**
 * Hook to track when the app was opened or returned to foreground
 * Returns whether the app was focused within the last N milliseconds
 * 
 * Uses a module-level variable to track app focus time, so it persists
 * across component mounts and only updates when the app state actually changes.
 */

import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

// Module-level variable to track when app became active
// This persists across component mounts/unmounts
let lastAppActiveTime: number | null = null;
let isInitialized = false;

/**
 * Hook to check if app was focused within the last N milliseconds
 * @param maxAgeMs Maximum age in milliseconds (default: 5000 = 5 seconds)
 * @returns true if app was focused within the last maxAgeMs, false otherwise
 */
export function useAppFocusState(maxAgeMs: number = 5000): boolean {
  const [isRecentlyFocused, setIsRecentlyFocused] = useState(() => {
    // Initial state: check if we have a recent focus time
    if (lastAppActiveTime !== null) {
      const age = Date.now() - lastAppActiveTime;
      return age < maxAgeMs;
    }
    return false;
  });

  useEffect(() => {
    // Initialize the listener only once (module-level)
    if (!isInitialized) {
      isInitialized = true;
      
      // On first initialization, if app is already active and we haven't recorded a time yet,
      // record it (this handles the case where the app was just launched)
      if (AppState.currentState === 'active' && lastAppActiveTime === null) {
        lastAppActiveTime = Date.now();
      }
      
      // Set up listener for app state changes
      // Only record when app state CHANGES to active, not when it's already active
      AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active') {
          // App came to foreground - record the time
          lastAppActiveTime = Date.now();
        }
      });
    }

    // Check periodically if we're still within the time window
    const interval = setInterval(() => {
      if (lastAppActiveTime !== null) {
        const age = Date.now() - lastAppActiveTime;
        setIsRecentlyFocused(age < maxAgeMs);
      } else {
        setIsRecentlyFocused(false);
      }
    }, 100); // Check every 100ms

    return () => {
      clearInterval(interval);
    };
  }, [maxAgeMs]);

  return isRecentlyFocused;
}

