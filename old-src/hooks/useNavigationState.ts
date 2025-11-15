/**
 * Hook to automatically save and restore navigation state
 * Works on both web and mobile
 */

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useLocalSearchParams } from 'expo-router';
import { saveNavigationState, getNavigationState, buildPathWithParams } from '@/services/navigationState';

let hasRestoredNavigation = false;

/**
 * Hook to automatically save and restore navigation state
 * Call this in the root layout
 */
export function useNavigationState() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const hasRestoredRef = useRef(false);
  const isInitialMountRef = useRef(true);

  // Restore navigation state on app startup
  useEffect(() => {
    // Only restore once per app session
    if (hasRestoredNavigation || hasRestoredRef.current) {
      return;
    }

    const restoreNavigation = async () => {
      try {
        const savedState = await getNavigationState();
        if (!savedState) {
          hasRestoredRef.current = true;
          hasRestoredNavigation = true;
          return;
        }

        // Check if saved state is recent (within last 1 hour)
        const age = Date.now() - savedState.timestamp;
        const maxAge = 60 * 60 * 1000; // 1 hour
        if (age > maxAge) {
          // State is too old, don't restore
          hasRestoredRef.current = true;
          hasRestoredNavigation = true;
          return;
        }

        // Only restore if we're on the root page
        const currentPath = pathname || '/';
        if (currentPath === '/' || currentPath === '/index') {
          const targetPath = buildPathWithParams(savedState.pathname, savedState.searchParams);
          if (targetPath && targetPath !== '/' && targetPath !== currentPath) {
            console.log('[NavigationState] Restoring to:', targetPath);
            router.replace(targetPath as any);
          }
        }

        hasRestoredRef.current = true;
        hasRestoredNavigation = true;
      } catch (error) {
        console.error('Error restoring navigation state:', error);
        hasRestoredRef.current = true;
        hasRestoredNavigation = true;
      }
    };

    restoreNavigation();
  }, []);

  // Save navigation state whenever route changes
  useEffect(() => {
    // Skip saving on initial mount (we just restored)
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    if (!pathname) {
      return;
    }

    // Convert search params to a plain object
    const searchParamsObj: Record<string, string> = {};
    Object.entries(searchParams).forEach(([key, value]) => {
      if (typeof value === 'string') {
        searchParamsObj[key] = value;
      } else if (Array.isArray(value) && value.length > 0) {
        // Expo Router sometimes returns arrays, take first value
        searchParamsObj[key] = String(value[0]);
      }
    });

    saveNavigationState(pathname, Object.keys(searchParamsObj).length > 0 ? searchParamsObj : undefined);
  }, [pathname, searchParams]);
}

/**
 * Reset the restoration flag (useful for testing)
 */
export function resetNavigationRestoration() {
  hasRestoredNavigation = false;
}

