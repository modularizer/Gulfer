import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

/**
 * PWA utilities for service worker registration and route caching
 */

const LAST_PAGE_STORAGE_KEY = 'gulfer-last-page';
const LEGACY_CLEANUP_RELOAD_KEY = 'gulfer-sw-legacy-cleanup-reload';

const normalizeBasePath = (basePath?: string | null): string => {
  if (!basePath || basePath === '/') {
    return '';
  }

  const trimmed = basePath.trim();
  if (!trimmed) {
    return '';
  }

  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading.endsWith('/') ? withLeading.slice(0, -1) : withLeading;
};

const getBasePath = (): string => {
  if (Platform.OS !== 'web') {
    return '';
  }

  const configBase = normalizeBasePath(Constants.expoConfig?.experiments?.baseUrl as string | undefined);

  if (configBase) {
    return configBase;
  }

  if (typeof process !== 'undefined' && process.env) {
    const envCandidates = [
      process.env.EXPO_PUBLIC_BASE_PATH,
      process.env.EXPO_PUBLIC_BASE_URL,
      process.env.PUBLIC_URL,
    ];

    for (const candidate of envCandidates) {
      const normalized = normalizeBasePath(candidate);
      if (normalized) {
        return normalized;
      }
    }
  }

  return '';
};

const addBasePath = (relativePath: string, basePath: string): string => {
  if (!relativePath) {
    return basePath ? `${basePath}/` : '/';
  }

  if (!basePath) {
    return relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  }

  const sanitizedRelative = relativePath.startsWith('/')
    ? relativePath
    : `/${relativePath}`;

  return `${basePath}${sanitizedRelative}`;
};

const stripBasePath = (pathname: string, basePath: string): string => {
  if (!pathname) {
    return '/';
  }

  if (!basePath) {
    return pathname;
  }

  if (!pathname.startsWith(basePath)) {
    return pathname;
  }

  const stripped = pathname.slice(basePath.length);
  if (!stripped) {
    return '/';
  }

  return stripped.startsWith('/') ? stripped : `/${stripped}`;
};

const getServiceWorkerScriptUrls = (registration: ServiceWorkerRegistration): string[] => {
  const urls = [
    registration.active?.scriptURL,
    registration.waiting?.scriptURL,
    registration.installing?.scriptURL,
  ];

  return urls.filter((url): url is string => typeof url === 'string');
};

const cleanupLegacyServiceWorkers = async (desiredScope: string, basePath: string, swPath: string): Promise<boolean> => {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.getRegistrations) {
    return false;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (!registrations.length) {
      return false;
    }

    const originScope = new URL('/', window.location.origin).href;
    const desiredScopeUrl = new URL(desiredScope, window.location.origin).href;
    const expectedScriptUrl = new URL(swPath, window.location.origin).href;

    let removedLegacy = false;

    await Promise.all(
      registrations.map(async (registration) => {
        const scriptUrls = getServiceWorkerScriptUrls(registration);
        const targetsGulferWorker = scriptUrls.some((url) => url.includes('/sw.js'));
        if (!targetsGulferWorker) {
          return;
        }

        // Already correct scope and script
        const hasDesiredScope = registration.scope === desiredScopeUrl;
        const hasExpectedScript = scriptUrls.includes(expectedScriptUrl);

        if (hasDesiredScope && hasExpectedScript) {
          return;
        }

        // If we now have a base path, remove the legacy root-scoped worker
        if (basePath && registration.scope === originScope) {
          console.log('Unregistering legacy Gulfer service worker with scope', registration.scope);
          const didUnregister = await registration.unregister();
          if (didUnregister) {
            removedLegacy = true;
          }
        }

        // Remove workers that share the desired scope but are still pointing at the old script path
        if (hasDesiredScope && !hasExpectedScript) {
          console.log('Unregistering legacy Gulfer service worker with outdated script', scriptUrls);
          const didUnregister = await registration.unregister();
          if (didUnregister) {
            removedLegacy = true;
          }
        }
      })
    );

    return removedLegacy;
  } catch (error) {
    console.log('Error cleaning up legacy service workers:', error);
    return false;
  }
};

// Register service worker on web platform
export function registerServiceWorker() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const basePath = getBasePath();
      const scope = basePath ? `${basePath}/` : '/';
      const swPath = `${basePath || ''}/sw.js`;

      cleanupLegacyServiceWorkers(scope, basePath, swPath).then((removedLegacy) => {
        if (removedLegacy) {
          try {
            if (typeof sessionStorage !== 'undefined') {
              const hasReloaded = sessionStorage.getItem(LEGACY_CLEANUP_RELOAD_KEY) === '1';
              if (hasReloaded) {
                sessionStorage.removeItem(LEGACY_CLEANUP_RELOAD_KEY);
              } else {
                sessionStorage.setItem(LEGACY_CLEANUP_RELOAD_KEY, '1');
                window.location.reload();
                return;
              }
            } else {
              window.location.reload();
              return;
            }
          } catch (error) {
            console.log('Error handling legacy service worker reload:', error);
            window.location.reload();
            return;
          }
        } else {
          try {
            if (typeof sessionStorage !== 'undefined') {
              sessionStorage.removeItem(LEGACY_CLEANUP_RELOAD_KEY);
            }
          } catch (error) {
            console.log('Error clearing legacy service worker reload flag:', error);
          }
        }

        navigator.serviceWorker
          .register(swPath, { updateViaCache: 'none', scope })
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
    });
  }
}

// Get the last visited page from localStorage
export function getLastVisitedPage(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem(LAST_PAGE_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const basePath = getBasePath();

    // Backwards compatibility: older versions stored absolute paths
    if (basePath && stored.startsWith(basePath)) {
      return stripBasePath(stored, basePath);
    }

    // Also handle accidental absolute paths without base path
    if (stored.startsWith('http')) {
      try {
        const storedUrl = new URL(stored);
        return stripBasePath(storedUrl.pathname + storedUrl.search, basePath);
      } catch {
        return null;
      }
    }

    if (!stored.startsWith('/')) {
      return `/${stored}`;
    }

    return stored;
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
    const basePath = getBasePath();
    const relativePathname = stripBasePath(urlObj.pathname, basePath);
    const relativePathWithSearch = `${relativePathname}${urlObj.search}`;

    localStorage.setItem(LAST_PAGE_STORAGE_KEY, relativePathWithSearch);
    
    // Also notify service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        const absolutePathForServiceWorker = `${addBasePath(relativePathname, basePath)}${urlObj.search}`;
        registration.active?.postMessage({
          type: 'CACHE_CURRENT_PAGE',
          url: absolutePathForServiceWorker,
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
    // Only run on web platform
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    // Register service worker on mount
    registerServiceWorker();

    // Restore last visited page on first load
    if (!hasRestoredRef.current) {
      hasRestoredRef.current = true;
      const lastPage = getLastVisitedPage();
      const basePath = getBasePath();
      const currentPathname = stripBasePath(window.location.pathname, basePath);
      const currentPathWithSearch = `${currentPathname}${window.location.search}`;

      if (lastPage && lastPage !== currentPathWithSearch && lastPage !== '/') {
        // Only navigate if we're on the root page and have a cached page
        if (currentPathname === '/') {
          router.replace(lastPage as any);
        }
      }
    }
  }, []);

  useEffect(() => {
    // Only run on web platform
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    // Cache current page whenever route changes
    if (pathname) {
      const fullUrl = window.location.href;
      cacheCurrentPage(fullUrl);
    }
  }, [pathname]);
}

