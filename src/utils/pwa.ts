import { Platform } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

/**
 * PWA utilities for service worker registration and route caching
 */

// Get base path for GitHub Pages compatibility
function getBasePath(): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return '';
  }
  
  // Try to detect base path from script tags
  const scripts = document.querySelectorAll('script[src]');
  for (const script of Array.from(scripts)) {
    const src = script.getAttribute('src');
    if (src && src.includes('/_expo/')) {
      // Extract base path from script src (e.g., "/Gulfer/_expo/..." -> "/Gulfer/")
      const match = src.match(/^(\/[^\/]+\/)/);
      if (match) {
        return match[1];
      }
    }
  }
  
  // Fallback: calculate from pathname
  // If pathname is "/" or starts with "/_expo/", we're at root
  // Otherwise, extract first segment as base path
  const pathname = window.location.pathname;
  if (pathname === '/' || pathname.startsWith('/_expo/')) {
    return '/';
  }
  
  const pathSegments = pathname.split('/').filter(Boolean);
  if (pathSegments.length > 0) {
    return `/${pathSegments[0]}/`;
  }
  
  return '/';
}

// Register service worker on web platform
export function registerServiceWorker() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Get base path and construct service worker path
      const basePath = getBasePath();
      const swPath = `${basePath}sw.js`;
      
      navigator.serviceWorker
        .register(swPath, { updateViaCache: 'none' })
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
    const lastPage = localStorage.getItem('gulfer-last-page');
    if (!lastPage) return null;
    
    // Get base path to check if cached path already has it
    const basePath = getBasePath();
    
    // If cached path has base path, remove it to avoid double-prefixing
    if (basePath !== '/' && lastPage.startsWith(basePath)) {
      // Remove base path and update cache
      let cleanPath = lastPage.substring(basePath.length - 1);
      if (!cleanPath.startsWith('/')) {
        cleanPath = '/' + cleanPath;
      }
      localStorage.setItem('gulfer-last-page', cleanPath);
      return cleanPath;
    }
    
    return lastPage;
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
    let pathname = urlObj.pathname + urlObj.search;
    
    // Remove base path from stored path to avoid double-prefixing on restore
    const basePath = getBasePath();
    if (basePath !== '/' && pathname.startsWith(basePath)) {
      pathname = pathname.substring(basePath.length - 1); // Keep leading /
      if (!pathname.startsWith('/')) {
        pathname = '/' + pathname;
      }
    }
    
    localStorage.setItem('gulfer-last-page', pathname);
    
    // Also notify service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.active?.postMessage({
          type: 'CACHE_CURRENT_PAGE',
          url: pathname,
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
      const currentPath = window.location.pathname;
      // Get base path to check if we're at root
      const basePath = getBasePath();
      const rootPath = basePath === '/' ? '/' : basePath;
      
      // Don't restore if lastPage is just root or empty
      if (lastPage && lastPage !== '/' && lastPage !== rootPath && lastPage.trim() !== '') {
        // Only navigate if we're on the root page and have a cached page
        // lastPage is stored without base path, so we need to add it
        if (currentPath === '/' || currentPath === rootPath || currentPath === rootPath + 'index.html') {
          // Construct target path: add base path if needed
          let targetPath = lastPage;
          
          // Remove any existing base path (in case of old cached data)
          if (basePath !== '/' && targetPath.startsWith(basePath)) {
            targetPath = targetPath.substring(basePath.length - 1);
            if (!targetPath.startsWith('/')) targetPath = '/' + targetPath;
          }
          
          // Don't navigate if target is just root
          if (targetPath === '/' || targetPath === rootPath) {
            return;
          }
          
          // Add base path if we're not at root
          if (basePath !== '/' && !targetPath.startsWith(basePath)) {
            targetPath = basePath + targetPath.replace(/^\//, '');
          }
          
          // Only navigate if target is different from current and not root
          if (targetPath !== currentPath && 
              targetPath !== currentPath.replace(/\/$/, '') && 
              targetPath !== currentPath + '/' &&
              targetPath !== rootPath &&
              targetPath !== rootPath + '/') {
            router.replace(targetPath as any);
          }
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

