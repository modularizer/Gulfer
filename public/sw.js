// Service Worker for Gulfer PWA
// Offline Strategy:
// - Navigation (HTML): Network-first, fallback to cache, then index.html
// - JavaScript bundles: Network-first (fresh when online), fallback to cache (offline)
// - Other assets: Cache-first (fast), fallback to network, then graceful error
// All successful responses are cached for offline use
const CACHE_NAME = 'gulfer-v2';
const RUNTIME_CACHE = 'gulfer-runtime-v2';
const CURRENT_PAGE_KEY = 'gulfer-current-page';

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache will be populated as pages are visited
      return cache.addAll([
        '/',
        '/favicon.png'
      ]).catch((err) => {
        console.log('Cache install error:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

// Listen for skip waiting message
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // For navigation requests, use network-first strategy with cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { 
        cache: 'no-store'  // Bypass HTTP cache to get fresh HTML
      })
        .then((response) => {
          // Clone the response
          const responseToCache = response.clone();
          
          // Cache the current page
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });

          // Store current page URL for restoration
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(new Request(CURRENT_PAGE_KEY), new Response(request.url));
          });

          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(request).then((response) => {
            if (response) {
              return response;
            }
            // If not in cache, return index.html for SPA routing
            return caches.match('/');
          });
        })
    );
  } else {
    // Skip caching for non-GET requests (POST, PUT, etc.)
    if (request.method !== 'GET') {
      return;
    }

    const url = new URL(request.url);
    const isJavaScript = url.pathname.endsWith('.js') || 
                         url.pathname.includes('entry.bundle') ||
                         url.pathname.includes('.bundle');
    
    // For JavaScript bundles: network-first strategy (fresh when online, cached for offline)
    if (isJavaScript) {
      event.respondWith(
        fetch(request, { 
          cache: 'no-store',  // Bypass HTTP cache to get fresh code
          headers: {
            'Cache-Control': 'no-cache'
          }
        })
          .then((response) => {
            // Cache successful responses for offline use
            if (response && response.status === 200 && response.type === 'basic') {
              const responseToCache = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return response;
          })
          .catch(() => {
            // If network fails, try cache (offline mode)
            return caches.match(request).then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // If exact match not found, try to find similar bundle in cache
              // This helps with SPA routing where query params might differ
              const url = new URL(request.url);
              const basePath = url.pathname;
              
              return caches.open(RUNTIME_CACHE).then((cache) => {
                return cache.keys().then((keys) => {
                  // Try to find a bundle with the same base path
                  const similarKey = keys.find(key => {
                    const keyUrl = new URL(key.url);
                    return keyUrl.pathname === basePath;
                  });
                  
                  if (similarKey) {
                    return cache.match(similarKey);
                  }
                  
                  // If still not found and it's an entry bundle, try any entry bundle
                  if (basePath.includes('entry.bundle')) {
                    const bundleKey = keys.find(key => {
                      const keyUrl = new URL(key.url);
                      return keyUrl.pathname.includes('entry.bundle');
                    });
                    if (bundleKey) {
                      return cache.match(bundleKey);
                    }
                  }
                  
                  return null;
                });
              }).then((fallbackResponse) => {
                if (fallbackResponse) {
                  return fallbackResponse;
                }
                // If no cache found, the request will fail naturally
                // The app should handle this gracefully
                throw new Error('Resource not cached and offline');
              });
            });
          })
      );
      return;
    }

    // For other requests (assets, images, etc.), use cache-first strategy with network fallback
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          return response;
        }
        // If not in cache, try network
        return fetch(request).then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          // Cache successful responses for offline use
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        }).catch(() => {
          // Network failed and not in cache - try to find a fallback
          // For images, we could return a placeholder, but for now return a basic response
          // The app should handle missing assets gracefully
          return new Response('Offline - resource not available', { 
            status: 503, 
            statusText: 'Service Unavailable' 
          });
        });
      })
    );
  }
});

// Message event - handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'CACHE_CURRENT_PAGE') {
    const url = event.data.url;
    // Store in cache for service worker reference
    caches.open(CACHE_NAME).then((cache) => {
      cache.put(new Request(CURRENT_PAGE_KEY), new Response(url));
    });
  }
});

