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

/**
 * Normalize text by replacing non-breaking spaces and other problematic characters
 * Replaces non-breaking spaces (U+00A0) with newlines (U+000A) or regular spaces
 * Also normalizes various line break characters to regular newlines
 */
export function normalizeExportText(text: string): string {
  // Replace non-breaking spaces (U+00A0) with regular newlines (U+000A)
  // This handles cases where non-breaking spaces appear where newlines should be
  let normalized = text.replace(/\u00A0/g, '\n');
  
  // Normalize various line break characters to regular newlines (U+000A)
  // Carriage return + Line feed (Windows) -> Line feed
  normalized = normalized.replace(/\r\n/g, '\n');
  // Carriage return only (old Mac) -> Line feed
  normalized = normalized.replace(/\r/g, '\n');
  // Line separator (U+2028) -> Line feed
  normalized = normalized.replace(/\u2028/g, '\n');
  // Paragraph separator (U+2029) -> Line feed
  normalized = normalized.replace(/\u2029/g, '\n');
  
  return normalized;
}

