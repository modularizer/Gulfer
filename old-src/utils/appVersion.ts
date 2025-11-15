/**
 * Utility to get the app build version
 * The version is set during the GitHub Actions build process
 */

interface BuildVersion {
  version: string;
}

let cachedVersion: string | null = null;

/**
 * Gets the app build version (build timestamp)
 * Returns a cached value if already fetched, or 'Unknown' if unavailable
 */
export async function getAppVersion(): Promise<string> {
  // Return cached version if available
  if (cachedVersion) {
    return cachedVersion;
  }

  // Try to fetch from build-version.json
  // Try root path first (for GitHub Pages deployment)
  const pathsToTry = ['/build-version.json'];
  
  // If app is served from a subdirectory, also try that path
  if (typeof window !== 'undefined') {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      const basePath = `/${pathParts[0]}/build-version.json`;
      pathsToTry.push(basePath);
    }
  }

  for (const path of pathsToTry) {
    try {
      const response = await fetch(path);
      if (response.ok) {
        const data: BuildVersion = await response.json();
        cachedVersion = data.version;
        return cachedVersion;
      }
    } catch (error) {
      // Continue to next path
      continue;
    }
  }
  
  console.warn('[AppVersion] Could not fetch build version from any path');

  // Fallback to package.json version or unknown
  try {
    // In development, we might not have the build-version.json file
    // Try to get it from package.json or expo constants
    if (typeof window !== 'undefined' && 'process' in window && (window as any).process?.env) {
      const pkgVersion = (window as any).process.env.EXPO_PUBLIC_APP_VERSION;
      if (pkgVersion) {
        return pkgVersion;
      }
    }
  } catch (error) {
    // Ignore errors
  }

  return 'Unknown';
}

/**
 * Gets the app version synchronously (returns cached value or 'Unknown')
 * Use this if you need the version immediately without async
 */
export function getAppVersionSync(): string {
  return cachedVersion || 'Unknown';
}

