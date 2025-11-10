/**
 * Utility functions
 */

import { Platform, ViewStyle } from 'react-native';

export { getAppVersion, getAppVersionSync } from './appVersion';

/**
 * Format a Unix timestamp to a readable date string
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a Unix timestamp to a date-only string
 */
export function formatDateOnly(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get platform-specific shadow styles
 * On web, uses boxShadow; on native, uses shadow props
 */
export function getShadowStyle(elevation: number): ViewStyle {
  if (Platform.OS === 'web') {
    // Convert elevation to boxShadow
    const shadowBlur = elevation * 2;
    const shadowOpacity = elevation === 0 ? 0 : 0.2;
    return {
      boxShadow: `0 ${elevation}px ${shadowBlur}px rgba(0, 0, 0, ${shadowOpacity})`,
    } as any;
  } else {
    return {
      elevation,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: elevation },
      shadowOpacity: 0.2,
      shadowRadius: elevation * 2,
    };
  }
}

