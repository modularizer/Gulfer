/**
 * URL encoding/decoding utilities for names in routes
 */

/**
 * Encode a name for use in URLs
 * Replaces spaces and special characters with URL-safe equivalents
 */
export function encodeNameForUrl(name: string): string {
  return encodeURIComponent(name.trim());
}

/**
 * Decode a name from URL
 */
export function decodeNameFromUrl(encoded: string): string {
  try {
    return decodeURIComponent(encoded);
  } catch (error) {
    console.error('Error decoding name from URL:', error);
    return encoded; // Return as-is if decoding fails
  }
}

