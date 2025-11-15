const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Exclude build scripts and ts-morph from bundling
config.resolver.blockList = [
  // Block build/generation scripts
  /storage\/schema\/.*\/generate.*\.ts$/,
  /storage\/schema\/.*\/generate-all.*\.ts$/,
];

// Exclude ts-morph and packages that use import.meta from being resolved
// These packages use import.meta which Metro doesn't support
const defaultResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'ts-morph') {
    return {
      type: 'empty',
    };
  }
  // Exclude @sqlite.org/sqlite-wasm from bundling - it uses import.meta
  if (moduleName === '@sqlite.org/sqlite-wasm' || moduleName.startsWith('@sqlite.org/sqlite-wasm/')) {
    return {
      type: 'empty',
    };
  }
  // Allow @electric-sql/pglite and drizzle-orm/pglite to be bundled
  // We'll transform import.meta using Babel
  // Use default resolution for everything else
  if (defaultResolver) {
    return defaultResolver(context, moduleName, platform);
  }
  // Fallback to default Metro resolver
  return context.resolveRequest(context, moduleName, platform);
};

// DISABLE ALL CACHING IN DEVELOPMENT - Force fresh code on every change
if (process.env.NODE_ENV !== 'production') {
  // Disable file system cache - empty array means no caching
  config.cacheStores = [];
  
  // Disable transformer cache by not caching transform options
  config.transformer = {
    ...config.transformer,
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: true, // Enable ES module support for @sqlite.org/sqlite-wasm
        inlineRequires: true,
      },
    }),
    // Polyfill import.meta for packages that use it (like @sqlite.org/sqlite-wasm)
    unstable_allowRequireContext: true,
  };
  
  // Enable ES module support for packages that use import.meta
  config.resolver.sourceExts = [...(config.resolver.sourceExts || []), 'mjs'];
  
  // Configure Metro to not transform @sqlite.org/sqlite-wasm (it uses import.meta which Metro doesn't support)
  // Instead, we'll load it dynamically at runtime in the browser
  config.resolver.unstable_enablePackageExports = true;
}

// Ensure Fast Refresh works properly
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return middleware;
  },
};

// Watch all directories - be aggressive about file watching
config.watchFolders = [__dirname];

// Increase file watching limits
config.watcher = {
  ...config.watcher,
  healthCheck: {
    enabled: true,
    interval: 30000,
    timeout: 10000,
  },
  watchman: {
    deferStates: ['hg.update'],
  },
};

module.exports = config;

