#!/usr/bin/env node

/**
 * Post-build script to fix asset paths for GitHub Pages
 * Replaces absolute paths with relative paths or base path
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const basePath = process.env.EXPO_PUBLIC_BASE_PATH || '';

function fixPathsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // For HTML files, fix href, src, and manifest attributes
    if (filePath.endsWith('.html')) {
      // Replace absolute paths starting with /_expo/ with base path
      if (content.includes('/_expo/')) {
        content = content.replace(/\/_expo\//g, `${basePath}/_expo/`);
        modified = true;
      }

      // Replace absolute paths for href (but not // for protocols)
      if (content.includes('href="/') && !content.includes('href="//')) {
        content = content.replace(/href="\//g, `href="${basePath}/`);
        modified = true;
      }

      // Replace absolute paths for src (but not // for protocols)
      if (content.includes('src="/') && !content.includes('src="//')) {
        content = content.replace(/src="\//g, `src="${basePath}/`);
        modified = true;
      }

      // Fix manifest path
      if (content.includes('manifest="/')) {
        content = content.replace(/manifest="\//g, `manifest="${basePath}/`);
        modified = true;
      }
    }

    // For JavaScript files, fix string literals containing /_expo/
    if (filePath.endsWith('.js')) {
      // Replace /_expo/ in string literals (both single and double quotes, and template literals)
      // Pattern: quote, slash, _expo, slash
      if (content.includes('/_expo/')) {
        // Replace in double-quoted strings: "/_expo/"
        content = content.replace(/"\/_expo\//g, `"${basePath}/_expo/`);
        // Replace in single-quoted strings: '/_expo/'
        content = content.replace(/'\/_expo\//g, `'${basePath}/_expo/`);
        // Replace in template literals: `/_expo/`
        content = content.replace(/`\/_expo\//g, ``${basePath}/_expo/`);
        // Also handle cases where it might be concatenated: + "/_expo/"
        content = content.replace(/\+\s*"\/_expo\//g, `+ "${basePath}/_expo/`);
        content = content.replace(/\+\s*'\/_expo\//g, `+ '${basePath}/_expo/`);
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

if (fs.existsSync(distDir)) {
  console.log(`Fixing paths with base path: ${basePath || '(root)'}`);
  walkDir(distDir);
  console.log('Path fixing complete!');
} else {
  console.error(`Dist directory not found: ${distDir}`);
  process.exit(1);
}

