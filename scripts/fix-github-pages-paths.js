#!/usr/bin/env node

/**
 * Post-build script to fix asset paths for GitHub Pages
 * Replaces absolute paths with relative paths
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

function fixPathsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // For HTML files, fix href, src, and manifest attributes
    if (filePath.endsWith('.html')) {
      // Replace absolute paths starting with /_expo/ with relative path
      if (content.includes('/_expo/')) {
        content = content.replace(/\/_expo\//g, './_expo/');
        modified = true;
      }

      // Replace absolute paths for href (but not // for protocols)
      if (content.includes('href="/') && !content.includes('href="//')) {
        content = content.replace(/href="\//g, 'href="./');
        modified = true;
      }

      // Replace absolute paths for src (but not // for protocols)
      if (content.includes('src="/') && !content.includes('src="//')) {
        content = content.replace(/src="\//g, 'src="./');
        modified = true;
      }

      // Fix manifest path
      if (content.includes('manifest="/')) {
        content = content.replace(/manifest="\//g, 'manifest="./');
        modified = true;
      }
    }

    // For JavaScript files, fix string literals containing /_expo/, /favicon, /sw.js
    if (filePath.endsWith('.js')) {
      // Replace /_expo/ in string literals with relative path
      if (content.includes('/_expo/')) {
        // Replace in double-quoted strings: "/_expo/" -> "./_expo/"
        content = content.replace(/"\/_expo\//g, '"./_expo/');
        // Replace in single-quoted strings: '/_expo/' -> './_expo/'
        content = content.replace(/'\/_expo\//g, "'./_expo/");
        // Replace in template literals: `/_expo/` -> `./_expo/`
        content = content.replace(/`\/_expo\//g, '`./_expo/');
        // Also handle cases where it might be concatenated: + "/_expo/" -> + "./_expo/"
        content = content.replace(/\+\s*"\/_expo\//g, '+ "./_expo/');
        content = content.replace(/\+\s*'\/_expo\//g, "+ './_expo/");
        modified = true;
      }
      
      // Replace /favicon.png and /favicon.svg with relative paths
      if (content.includes('/favicon.png') || content.includes('/favicon.svg')) {
        content = content.replace(/"\/favicon\.(png|svg)"/g, '"./favicon.$1"');
        content = content.replace(/'\/favicon\.(png|svg)'/g, "'./favicon.$1'");
        content = content.replace(/`\/favicon\.(png|svg)`/g, '`./favicon.$1`');
        modified = true;
      }
      
      // Replace /sw.js with relative path
      if (content.includes('/sw.js')) {
        content = content.replace(/"\/sw\.js"/g, '"./sw.js"');
        content = content.replace(/'\/sw\.js'/g, "'./sw.js'");
        content = content.replace(/`\/sw\.js`/g, '`./sw.js`');
        modified = true;
      }
      
      // Replace root path '/' in cache.addAll and caches.match (but be careful)
      // Only replace standalone '/' in array literals and match calls
      if (content.includes("cache.addAll([") || content.includes("caches.match('/')")) {
        // Replace '/', in array literals (but not '//' for protocols)
        content = content.replace(/cache\.addAll\(\s*\[\s*'\/'\s*,/g, "cache.addAll(['./',");
        content = content.replace(/cache\.addAll\(\s*\[\s*"\/"\s*,/g, 'cache.addAll(["./",');
        // Replace caches.match('/') with caches.match('./')
        content = content.replace(/caches\.match\(['"]\/['"]\)/g, "caches.match('./')");
        modified = true;
      }
      
      // Fix httpServerLocation paths in asset registrations
      // These are used by Metro bundler for asset resolution
      // Pattern: httpServerLocation:"/assets/..." -> httpServerLocation:"./assets/..."
      if (content.includes('httpServerLocation:"/assets/')) {
        content = content.replace(/httpServerLocation:"\/assets\//g, 'httpServerLocation:"./assets/');
        modified = true;
      }
      // Also handle single quotes
      if (content.includes("httpServerLocation:'/assets/")) {
        content = content.replace(/httpServerLocation:'\/assets\//g, "httpServerLocation:'./assets/");
        modified = true;
      }
      
      // Patch asset URL construction to handle relative paths correctly
      // The asset resolution code uses new URL(path, baseUrl) which doesn't work with relative paths
      // We need to patch the code that constructs URLs from httpServerLocation
      // Look for patterns like: new URL(i(this.asset),this.serverUrl) or similar
      // And patch them to prepend the detected base path
      // This is a more complex fix that patches the runtime asset resolution
      if (content.includes('assetServerURL') || content.includes('httpServerLocation')) {
        // Patch the fromSource method to prepend base path
        // Look for: fromSource(t){return{__packager_asset
        // And inject base path detection
        if (content.includes('fromSource(t){') && !content.includes('window.__GITHUB_PAGES_BASE_PATH__')) {
          // Inject base path detection at the start of the file or in a strategic location
          // We'll patch the URL construction to use relative paths or detect base path
          // This is complex, so we'll use a simpler approach: patch the URL construction
        }
      }
    }
    
    // For JSON files (like manifest.json), fix favicon paths
    if (filePath.endsWith('.json')) {
      // Fix absolute paths starting with /favicon
      if (content.includes('"/favicon')) {
        content = content.replace(/"\/favicon/g, '"./favicon');
        modified = true;
      }
      // Also handle paths that might be in different formats
      if (content.includes('"src": "/favicon')) {
        content = content.replace(/"src": "\/favicon/g, '"src": "./favicon');
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed paths in: ${path.relative(distDir, filePath)}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith('.html') || file.endsWith('.js') || file.endsWith('.json')) {
      fixPathsInFile(filePath);
    }
  }
}

// Copy favicon files to dist root if they don't exist
function copyFavicons() {
  const assetsDir = path.join(__dirname, '..', 'assets');
  const faviconPng = path.join(assetsDir, 'favicon.png');
  const faviconSvg = path.join(assetsDir, 'favicon.svg');
  const distFaviconPng = path.join(distDir, 'favicon.png');
  const distFaviconSvg = path.join(distDir, 'favicon.svg');
  
  try {
    if (fs.existsSync(faviconPng) && !fs.existsSync(distFaviconPng)) {
      fs.copyFileSync(faviconPng, distFaviconPng);
      console.log('Copied favicon.png to dist root');
    }
    if (fs.existsSync(faviconSvg) && !fs.existsSync(distFaviconSvg)) {
      fs.copyFileSync(faviconSvg, distFaviconSvg);
      console.log('Copied favicon.svg to dist root');
    }
  } catch (error) {
    console.error('Error copying favicon files:', error);
  }
}

// Inject asset path patch into HTML files
function injectAssetPatch() {
  const htmlFiles = ['index.html', '404.html'];
  
  const patchScript = `
<script>
(function() {
  'use strict';
  if (typeof window === 'undefined') return;
  
  function getBasePath() {
    if (typeof document !== 'undefined') {
      const scripts = document.querySelectorAll('script[src]');
      for (let i = 0; i < scripts.length; i++) {
        const src = scripts[i].getAttribute('src');
        if (src && src.includes('/_expo/')) {
          const match = src.match(/^(\\/[^\\/]+\\/)/);
          if (match) return match[1];
        }
      }
    }
    if (window.location.pathname !== '/') {
      const segments = window.location.pathname.split('/').filter(Boolean);
      if (segments.length > 0) return '/' + segments[0] + '/';
    }
    return '/';
  }
  
  const basePath = getBasePath();
  if (basePath === '/') return;
  
  // Patch fetch
  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    let urlToFix = null;
    if (typeof input === 'string') {
      if (input.startsWith('/assets/') && !input.startsWith(basePath)) {
        urlToFix = basePath + input.substring(1);
      }
    } else if (input instanceof Request) {
      const url = input.url;
      if (url.startsWith('/assets/') && !url.startsWith(basePath)) {
        urlToFix = basePath + url.substring(1);
        input = new Request(urlToFix, input);
      }
    } else if (input instanceof URL) {
      if (input.pathname.startsWith('/assets/') && !input.pathname.startsWith(basePath)) {
        input.pathname = basePath + input.pathname.substring(1);
      }
    }
    if (urlToFix) {
      return originalFetch.call(this, urlToFix, init);
    }
    return originalFetch.call(this, input, init);
  };
  
  // Patch XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, async, username, password) {
    if (typeof url === 'string' && url.startsWith('/assets/') && !url.startsWith(basePath)) {
      url = basePath + url.substring(1);
    }
    return originalOpen.call(this, method, url, async, username, password);
  };
  
  // Patch document.createElement to intercept link and style tags
  const originalCreateElement = document.createElement;
  document.createElement = function(tagName, options) {
    const element = originalCreateElement.call(this, tagName, options);
    if (tagName === 'link' || tagName === 'style') {
      const originalSetAttribute = element.setAttribute;
      element.setAttribute = function(name, value) {
        if ((name === 'href' || name === 'src') && typeof value === 'string' && 
            value.startsWith('/assets/') && !value.startsWith(basePath)) {
          value = basePath + value.substring(1);
        }
        return originalSetAttribute.call(this, name, value);
      };
    }
    return element;
  };
})();
</script>`;

  htmlFiles.forEach(file => {
    const htmlPath = path.join(distDir, file);
    if (fs.existsSync(htmlPath)) {
      let content = fs.readFileSync(htmlPath, 'utf8');
      // Inject script before closing head tag or before first script tag
      if (!content.includes('getBasePath()')) {
        if (content.includes('</head>')) {
          content = content.replace('</head>', patchScript + '\n</head>');
        } else if (content.includes('<script')) {
          content = content.replace('<script', patchScript + '\n<script');
        } else {
          content = patchScript + '\n' + content;
        }
        fs.writeFileSync(htmlPath, content, 'utf8');
        console.log(`Injected asset path patch into ${file}`);
      }
    }
  });
}

if (fs.existsSync(distDir)) {
  console.log('Converting absolute paths to relative paths...');
  walkDir(distDir);
  console.log('Copying favicon files to dist root...');
  copyFavicons();
  console.log('Injecting asset path patch into HTML...');
  injectAssetPatch();
  console.log('Path fixing complete!');
} else {
  console.error(`Dist directory not found: ${distDir}`);
  process.exit(1);
}

