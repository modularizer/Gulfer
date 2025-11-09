// Service Worker for Gulfer PWA
const CACHE_NAME = 'gulfer-v1';
const RUNTIME_CACHE = 'gulfer-runtime-v1';
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
    })
  );
  self.clients.claim();
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
      fetch(request)
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
    // For other requests (assets, API calls), use cache-first strategy
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          return response;
        }
        return fetch(request).then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        });
      })
    );
  }
});

// Message event - handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_CURRENT_PAGE') {
    const url = event.data.url;
    // Store in cache for service worker reference
    caches.open(CACHE_NAME).then((cache) => {
      cache.put(new Request(CURRENT_PAGE_KEY), new Response(url));
    });
  }
});

