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

    // For JavaScript files, fix string literals containing /_expo/
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
  console.log('Converting absolute paths to relative paths...');
  walkDir(distDir);
  console.log('Path fixing complete!');
} else {
  console.error(`Dist directory not found: ${distDir}`);
  process.exit(1);
}

