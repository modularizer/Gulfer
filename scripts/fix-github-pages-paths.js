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
      
      // Fix ALL absolute paths starting with /assets/ to relative paths
      // Keep them as "/assets/" but patch the asset resolution to use current origin
      if (content.includes('/assets/')) {
        // Replace httpServerLocation:"/assets/..." -> httpServerLocation:"./assets/..."
        content = content.replace(/httpServerLocation:"\/assets\//g, 'httpServerLocation:"./assets/');
        content = content.replace(/httpServerLocation:'\/assets\//g, "httpServerLocation:'./assets/");
        
        // Replace any other "/assets/" strings in quotes with "./assets/"
        content = content.replace(/([^"'])"\/assets\//g, '$1"./assets/');
        content = content.replace(/([^"'])'\/assets\//g, "$1'./assets/");
        content = content.replace(/([^`])`\/assets\//g, '$1`./assets/');
        
        modified = true;
      }
      
      // Patch asset resolution code to use window.location.origin instead of hardcoded serverUrl
      // Find: this.serverUrl=t||'https://expo.dev'
      // Replace with code that uses window.location.origin
      if (content.includes("this.serverUrl") && content.includes("'https://expo.dev'")) {
        // Replace the serverUrl assignment to use current origin
        content = content.replace(
          /this\.serverUrl\s*=\s*t\s*\|\|\s*['"]https:\/\/expo\.dev['"]/g,
          "this.serverUrl=t||(typeof window!=='undefined'&&window.location?window.location.origin:'https://expo.dev')"
        );
        modified = true;
      }
      
      // Also patch: new URL(i(this.asset),this.serverUrl)
      // To ensure relative paths work correctly, we need to handle the case where
      // httpServerLocation is relative (starts with ./)
      if (content.includes('new URL(i(this.asset),this.serverUrl)')) {
        // Wrap the URL construction to handle relative paths
        // This is complex, so we'll patch it to use location.origin when path is relative
        content = content.replace(
          /new URL\(i\(this\.asset\),this\.serverUrl\)/g,
          "(function(){const p=i(this.asset);const base=p.startsWith('./')||p.startsWith('../')?(typeof window!=='undefined'&&window.location?window.location.origin:'https://expo.dev'):this.serverUrl;return new URL(p,base);}).call(this)"
        );
        modified = true;
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


if (fs.existsSync(distDir)) {
  console.log('Converting absolute paths to relative paths...');
  walkDir(distDir);
  console.log('Copying favicon files to dist root...');
  copyFavicons();
  console.log('Path fixing complete!');
} else {
  console.error(`Dist directory not found: ${distDir}`);
  process.exit(1);
}

