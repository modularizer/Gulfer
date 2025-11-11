// Service Worker for Gulfer PWA
// Offline Strategy:
// - Navigation (HTML): Network-first, fallback to cache, then index.html
// - JavaScript bundles: Cache-first with background update (100% offline, fresh when online)
// - Other assets: Cache-first (fast), fallback to network, then graceful error
// All successful responses are cached for offline use
const CACHE_NAME = 'gulfer-v4';
const RUNTIME_CACHE = 'gulfer-runtime-v4';
const CURRENT_PAGE_KEY = 'gulfer-current-page';
const SCOPE_URL = new URL(self.registration?.scope ?? self.location.href);

const resolveWithScope = (path) => {
  try {
    return new URL(path, SCOPE_URL).toString();
  } catch (error) {
    console.warn('Service worker failed to resolve scoped path', path, error);
    return path;
  }
};

const OFFLINE_URL = resolveWithScope('./');
const PRECACHE_URLS = [
  OFFLINE_URL,
  resolveWithScope('favicon.png'),
  resolveWithScope('favicon.svg'),
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache will be populated as pages are visited
      return cache.addAll(PRECACHE_URLS).catch((err) => {
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
  if (url.origin !== SCOPE_URL.origin) {
    return;
  }

  // Skip Metro bundler internal requests in development
  // These should go directly to the dev server without service worker interception
  const isDev = url.searchParams.has('dev') && url.searchParams.get('dev') === 'true';
  const isMetroInternal = url.pathname === '/symbolicate' || 
                          url.pathname.includes('/hot') ||
                          url.pathname.includes('/message');
  const isAssetRequest = url.searchParams.has('unstable_path');
  
  // In development mode, don't intercept Metro's internal communication
  // But DO intercept and cache bundle requests (they need to work offline)
  // Skip only: symbolicate, hot reload, message socket, and asset requests
  if (isDev && (isMetroInternal || isAssetRequest)) {
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
            return caches.match(OFFLINE_URL);
          });
        })
    );
  } else {
    // Skip caching for non-GET requests (POST, PUT, etc.)
    if (request.method !== 'GET') {
      return;
    }

    const isJavaScript = url.pathname.endsWith('.js') || 
                         url.pathname.includes('entry.bundle') ||
                         url.pathname.includes('.bundle');
    
    // For JavaScript bundles: network-first with aggressive caching (100% offline support)
    // Always try network first when online to ensure everything gets cached
    // Fall back to cache when offline or network fails
    if (isJavaScript) {
      event.respondWith(
        // Try network first (ensures all bundles get cached when online)
        fetch(request, { cache: 'no-store' })
          .then((response) => {
            // Cache ALL successful JavaScript responses for offline use
            // Cache using both the full URL and the base path (for query param variations)
            if (response && response.status === 200 && response.type === 'basic') {
              const responseToCache = response.clone();
              const url = new URL(request.url);
              const basePath = url.pathname;
              
              caches.open(RUNTIME_CACHE).then((cache) => {
                // Cache with full URL
                cache.put(request, responseToCache.clone());
                
                // Also cache with base path only (for query param matching)
                // This helps when query params change but the bundle is the same
                if (url.search) {
                  const baseRequest = new Request(basePath, request);
                  cache.put(baseRequest, responseToCache.clone());
                }
              });
            }
            return response;
          })
          .catch(() => {
            // Network failed - try cache (offline mode or network error)
            return caches.match(request).then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              
              // Not in cache - try to find similar bundle by base path
              const url = new URL(request.url);
              const basePath = url.pathname;
              
              // Try matching base path (ignoring query params)
              return caches.open(RUNTIME_CACHE).then((cache) => {
                return cache.match(new Request(basePath)).then((basePathMatch) => {
                  if (basePathMatch) {
                    return basePathMatch;
                  }
                  
                  // Try to find any bundle with the same base path
                  return cache.keys().then((keys) => {
                    const similarKey = keys.find(key => {
                      const keyUrl = new URL(key.url);
                      return keyUrl.pathname === basePath;
                    });
                    
                    if (similarKey) {
                      return cache.match(similarKey);
                    }
                    
                    // If still not found and it's a bundle, try any bundle with similar name
                    if (basePath.includes('.bundle')) {
                      // Extract the module name from the path
                      const moduleName = basePath.split('/').pop()?.split('.')[0];
                      if (moduleName) {
                        const moduleBundleKey = keys.find(key => {
                          const keyUrl = new URL(key.url);
                          return keyUrl.pathname.includes(moduleName) && keyUrl.pathname.includes('.bundle');
                        });
                        if (moduleBundleKey) {
                          return cache.match(moduleBundleKey);
                        }
                      }
                      
                      // Last resort: try any .bundle file
                      const anyBundleKey = keys.find(key => {
                        const keyUrl = new URL(key.url);
                        return keyUrl.pathname.includes('.bundle');
                      });
                      if (anyBundleKey) {
                        return cache.match(anyBundleKey);
                      }
                    }
                    
                    return null;
                  });
                }).then((fallbackResponse) => {
                  if (fallbackResponse) {
                    return fallbackResponse;
                  }
                  // If no cache found and we're offline, the request will fail
                  // This is expected - the bundle wasn't cached because it was never requested while online
                  throw new Error('Bundle not cached - was never loaded while online');
                });
              });
            });
          })
      );
      return;
    }

    // For other requests (assets, images, etc.), use cache-first strategy with network fallback
    const isImage = url.pathname.match(/\.(jpg|jpeg|png|gif|svg|webp|ico)$/i);
    const isFavicon = url.pathname.includes('favicon') || url.pathname.includes('favicon.png') || url.pathname.includes('favicon.svg');
    
    event.respondWith(
      // First check runtime cache
      caches.match(request).then((response) => {
        if (response) {
          return response;
        }
        
        // For images and favicons, also check the install cache
        if (isImage || isFavicon) {
          return caches.open(CACHE_NAME).then((installCache) => {
            return installCache.match(request).then((cachedAsset) => {
              if (cachedAsset) {
                // Also cache in runtime cache for faster access
                const responseToCache = cachedAsset.clone();
                caches.open(RUNTIME_CACHE).then((cache) => {
                  cache.put(request, responseToCache);
                });
                return cachedAsset;
              }
              // For favicons, try alternative paths
              if (isFavicon) {
                const altUrls = ['favicon.png', 'favicon.svg'].map((asset) => new URL(asset, SCOPE_URL));
                return Promise.all(altUrls.map((altUrl) => {
                  if (url.pathname !== altUrl.pathname) {
                    const altRequest = new Request(altUrl.toString());
                    return installCache.match(altRequest);
                  }
                  return Promise.resolve(null);
                })).then((altCachedResults) => {
                  const found = altCachedResults.find(result => result !== null);
                  if (found) {
                    // Cache in runtime cache
                    const responseToCache = found.clone();
                    caches.open(RUNTIME_CACHE).then((cache) => {
                      cache.put(request, responseToCache);
                    });
                    return found;
                  }
                  // Not in install cache, try network
                  return null;
                });
              }
              // Not in install cache, try network
              return null;
            });
          }).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If not in any cache, try network
            return fetch(request).then((response) => {
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              // Cache successful responses for offline use
              const responseToCache = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => {
                cache.put(request, responseToCache);
              });
              return response;
            });
          });
        }
        
        // For non-image requests, try network
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
        });
      }).catch(() => {
          // Network failed and not in cache
          const errorUrl = new URL(request.url);
          const isImage = errorUrl.pathname.match(/\.(jpg|jpeg|png|gif|svg|webp|ico)$/i);
          const isFaviconError = errorUrl.pathname.includes('favicon');
          
          // For favicons, try to find them in the install cache
          if (isFaviconError) {
            return caches.open(CACHE_NAME).then((installCache) => {
              return installCache.match(request).then((cachedFavicon) => {
                if (cachedFavicon) {
                  return cachedFavicon;
                }
                // Try alternative favicon paths
                const altUrls = ['favicon.png', 'favicon.svg'].map((asset) => new URL(asset, SCOPE_URL));
                return Promise.all(altUrls.map((altUrl) => {
                  if (errorUrl.pathname !== altUrl.pathname) {
                    const altRequest = new Request(altUrl.toString());
                    return installCache.match(altRequest);
                  }
                  return Promise.resolve(null);
                })).then((altCachedResults) => {
                  // Find first non-null result
                  const found = altCachedResults.find(result => result !== null);
                  if (found) {
                    return found;
                  }
                  // If still not found, return empty response
                  return new Response('', {
                    status: 200,
                    headers: {
                      'Content-Type': errorUrl.pathname.includes('.svg') ? 'image/svg+xml' : 'image/png'
                    }
                  });
                });
              });
            });
          }
          
          if (isImage) {
            // Return empty image response - browser will handle it gracefully
            return new Response('', {
              status: 200,
              headers: {
                'Content-Type': 'image/png'
              }
            });
          }
          
          // For other assets, return 503 but don't break the app
          return new Response('', { 
            status: 503, 
            statusText: 'Service Unavailable' 
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

