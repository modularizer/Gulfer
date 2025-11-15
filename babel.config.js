module.exports = function(api) {
  // ALWAYS disable caching in development - force fresh code on every change
  // Only cache in production builds
  const isProduction = process.env.NODE_ENV === 'production';
  api.cache(isProduction);
  
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
          alias: {
            '@': './src',
            '@components': './src/components',
            '@screens': './src/screens',
            '@services': './src/services',
            '@types': './src/types',
            '@utils': './src/utils',
          },
        },
      ],
      // Add support for static class blocks (needed for ts-morph if it gets bundled)
      '@babel/plugin-transform-class-static-block',
      // Transform import.meta to work with Metro bundler
      './babel-plugin-transform-import-meta',
    ],
  };
};

