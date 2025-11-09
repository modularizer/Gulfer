/**
 * Suppress specific React Native Web deprecation warnings
 * These warnings come from third-party libraries and cannot be fixed
 * without modifying those libraries.
 */

import { LogBox, Platform } from 'react-native';

// Suppress specific warnings from third-party libraries
if (Platform.OS !== 'web') {
  LogBox.ignoreLogs([
    /props\.pointerEvents is deprecated/,
    /shadow.*style props are deprecated/,
    /useNativeDriver/,
    /RCTAnimation/,
  ]);
}

// Suppress in console for all platforms (especially web)
const originalWarn = console.warn;
const originalError = console.error;

const suppressedPatterns = [
  /props\.pointerEvents is deprecated/i,
  /shadow.*style props are deprecated/i,
  /useNativeDriver.*not supported/i,
  /RCTAnimation/i,
];

console.warn = (...args: any[]) => {
  const message = args[0]?.toString() || '';
  if (suppressedPatterns.some((pattern) => pattern.test(message))) {
    return;
  }
  originalWarn.apply(console, args);
};

console.error = (...args: any[]) => {
  const message = args[0]?.toString() || '';
  if (suppressedPatterns.some((pattern) => pattern.test(message))) {
    return;
  }
  originalError.apply(console, args);
};

