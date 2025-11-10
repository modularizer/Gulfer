import { Platform } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

/**
 * PWA utilities for service worker registration and route caching
 */

// Register service worker on web platform
export function registerServiceWorker() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Use relative path for GitHub Pages compatibility
      navigator.serviceWorker
        .register('./sw.js', { updateViaCache: 'none' })
        .then((registration) => {
          console.log('Service Worker registered:', registration.scope);
          
          // Check for updates immediately and force activation
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New service worker available, force activation
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  // Reload to use new service worker
                  window.location.reload();
                }
              });
            }
          });
          
          // Check for updates on every page load
          registration.update();
        })
        .catch((error) => {
          console.log('Service Worker registration failed:', error);
        });
    });
  }
}

// Get the last visited page from localStorage
export function getLastVisitedPage(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }

  try {
    return localStorage.getItem('gulfer-last-page');
  } catch (error) {
    console.log('Error getting last visited page:', error);
    return null;
  }
}

// Cache the current page URL
export function cacheCurrentPage(url: string) {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  try {
    // Store just the pathname for routing
    const urlObj = new URL(url);
    localStorage.setItem('gulfer-last-page', urlObj.pathname + urlObj.search);
    
    // Also notify service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.active?.postMessage({
          type: 'CACHE_CURRENT_PAGE',
          url: urlObj.pathname + urlObj.search,
        });
      });
    }
  } catch (error) {
    console.log('Error caching current page:', error);
  }
}

// Hook to automatically cache and restore routes
export function usePWARouteCache() {
  const pathname = usePathname();
  const router = useRouter();
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    // Register service worker on mount
    registerServiceWorker();

    // Restore last visited page on first load
    if (!hasRestoredRef.current) {
      hasRestoredRef.current = true;
      const lastPage = getLastVisitedPage();
      if (lastPage && lastPage !== window.location.pathname && lastPage !== '/') {
        // Only navigate if we're on the root page and have a cached page
        if (window.location.pathname === '/') {
          router.replace(lastPage as any);
        }
      }
    }
  }, []);

  useEffect(() => {
    // Cache current page whenever route changes
    if (pathname) {
      const fullUrl = window.location.href;
      cacheCurrentPage(fullUrl);
    }
  }, [pathname]);
}

