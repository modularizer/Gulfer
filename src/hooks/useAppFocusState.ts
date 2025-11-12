/**
 * Hook to track when the app was opened or returned to foreground
 * Returns whether the app was focused within the last N milliseconds
 */

import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 * Hook to check if app was focused within the last N milliseconds
 * @param maxAgeMs Maximum age in milliseconds (default: 5000 = 5 seconds)
 * @returns true if app was focused within the last maxAgeMs, false otherwise
 */
export function useAppFocusState(maxAgeMs: number = 5000): boolean {
  const [isRecentlyFocused, setIsRecentlyFocused] = useState(false);
  const lastFocusTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // Record initial focus time
    const now = Date.now();
    lastFocusTimeRef.current = now;
    setIsRecentlyFocused(true);

    // Set up listener for app state changes
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App came to foreground
        const now = Date.now();
        lastFocusTimeRef.current = now;
        setIsRecentlyFocused(true);
      }
    });

    // Check periodically if we're still within the time window
    const interval = setInterval(() => {
      if (lastFocusTimeRef.current !== null) {
        const age = Date.now() - lastFocusTimeRef.current;
        setIsRecentlyFocused(age < maxAgeMs);
      }
    }, 100); // Check every 100ms

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [maxAgeMs]);

  return isRecentlyFocused;
}

