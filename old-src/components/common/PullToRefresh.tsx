import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh?: () => Promise<void>;
  enabled?: boolean;
}

/**
 * Pull-to-refresh component for mobile web that performs hard refresh when online
 */
export default function PullToRefresh({ 
  children, 
  onRefresh,
  enabled = true 
}: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const touchStartYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const pullThreshold = 80; // Distance in pixels to trigger refresh
  const maxPullDistance = 120;

  // Only enable on web (mobile browsers)
  const isWeb = Platform.OS === 'web';
  const shouldEnable = enabled && isWeb;
  
  // Debug logging
  useEffect(() => {
    if (shouldEnable && typeof window !== 'undefined') {
      console.log('[PullToRefresh] Enabled on mobile web');
    }
  }, [shouldEnable]);

  const performRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return;

    isRefreshingRef.current = true;
    setIsRefreshing(true);

    try {
      // Check if online
      const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
      
      if (!isOnline) {
        console.log('[PullToRefresh] Offline - skipping hard refresh');
        isRefreshingRef.current = false;
        setIsRefreshing(false);
        return;
      }

      // If custom refresh handler provided, use it
      if (onRefresh) {
        await onRefresh();
      } else {
        // Perform hard refresh (bypass cache)
        if (typeof window !== 'undefined') {
          // Update service worker if available
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            try {
              const registration = await navigator.serviceWorker.getRegistration();
              if (registration) {
                // Force service worker update
                await registration.update();
                
                // Skip waiting if new worker is waiting
                registration.addEventListener('updatefound', () => {
                  const newWorker = registration.installing;
                  if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        newWorker.postMessage({ type: 'SKIP_WAITING' });
                      }
                    });
                  }
                });
              }
            } catch (error) {
              console.error('[PullToRefresh] Error updating service worker:', error);
            }
          }

          // Hard refresh - bypass cache
          // Use location.reload() with cache bypass
          if (window.location) {
            // Force a hard reload by clearing caches and reloading
            if ('serviceWorker' in navigator && 'caches' in window) {
              // Clear all caches and reload
              caches.keys().then((cacheNames) => {
                return Promise.all(
                  cacheNames.map((cacheName) => caches.delete(cacheName))
                );
              }).then(() => {
                // Reload with cache bypass
                window.location.reload();
              }).catch((error) => {
                console.error('[PullToRefresh] Error clearing caches:', error);
                // Fallback to regular reload
                window.location.reload();
              });
            } else {
              // Fallback: use reload with timestamp to bypass cache
              window.location.reload();
            }
          }
        }
      }
    } catch (error) {
      console.error('[PullToRefresh] Error during refresh:', error);
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [onRefresh]);

  useEffect(() => {
    if (!shouldEnable || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger if at the top of the page
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      if (scrollTop <= 5 && e.touches.length > 0) {
        touchStartYRef.current = e.touches[0].clientY;
        isDraggingRef.current = true;
        setIsPulling(true);
        console.log('[PullToRefresh] Touch start at top, scrollY:', scrollTop);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || e.touches.length === 0) return;

      const currentTouchY = e.touches[0].clientY;
      const distance = currentTouchY - touchStartYRef.current;

      // Only allow pulling down (positive distance)
      if (distance > 0) {
        const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
        
        // Prevent default scrolling while pulling if we're at the top
        if (distance > 10 && scrollTop === 0) {
          e.preventDefault();
        }
        
        const clampedDistance = Math.min(distance, maxPullDistance);
        pullDistanceRef.current = clampedDistance;
        setPullDistance(clampedDistance);
      } else {
        // User is scrolling up, cancel pull
        pullDistanceRef.current = 0;
        setPullDistance(0);
        setIsPulling(false);
        isDraggingRef.current = false;
      }
    };

    const handleTouchEnd = async () => {
      if (!isDraggingRef.current) return;

      const finalDistance = pullDistanceRef.current;
      isDraggingRef.current = false;
      setIsPulling(false);

      console.log('[PullToRefresh] Touch end, distance:', finalDistance, 'threshold:', pullThreshold);

      // Check if we've pulled enough to trigger refresh
      if (finalDistance >= pullThreshold) {
        console.log('[PullToRefresh] Triggering refresh');
        await performRefresh();
      }

      // Reset pull distance
      pullDistanceRef.current = 0;
      setPullDistance(0);
    };

    const handleTouchCancel = () => {
      isDraggingRef.current = false;
      setIsPulling(false);
      pullDistanceRef.current = 0;
      setPullDistance(0);
    };

    // Also check scroll position to reset if user scrolls away
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      if (scrollTop > 10) {
        isDraggingRef.current = false;
        setIsPulling(false);
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };

    // Use capture phase and non-passive for touchmove to allow preventDefault
    document.addEventListener('touchstart', handleTouchStart, { passive: true, capture: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false, capture: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true, capture: false });
    document.addEventListener('touchcancel', handleTouchCancel, { passive: true, capture: false });
    window.addEventListener('scroll', handleScroll, { passive: true, capture: false });

    console.log('[PullToRefresh] Event listeners attached');

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchCancel);
      window.removeEventListener('scroll', handleScroll);
      console.log('[PullToRefresh] Event listeners removed');
    };
  }, [shouldEnable, performRefresh]);

  // Calculate opacity and translate for pull indicator
  const pullProgress = Math.min(pullDistance / pullThreshold, 1);
  const indicatorOpacity = pullProgress;
  const indicatorTranslateY = Math.max(0, pullDistance - 20);

  if (!shouldEnable) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      {children}
      
      {/* Pull-to-refresh indicator */}
      {(isPulling || isRefreshing) && (
        <View
          style={[
            styles.indicatorContainer,
            Platform.OS === 'web' && {
              // Web-specific styles
              position: 'fixed' as any,
            },
            {
              opacity: indicatorOpacity,
              transform: [{ translateY: indicatorTranslateY }],
            },
          ]}
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" />
          ) : (
            <View style={styles.pullIndicator}>
              <View style={styles.arrow}>
                ↓
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  indicatorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    pointerEvents: 'none',
    ...(Platform.OS === 'web' && {
      // Ensure it works on web
      position: 'fixed' as any,
    }),
  },
  pullIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    fontSize: 24,
    color: '#666',
  },
});

