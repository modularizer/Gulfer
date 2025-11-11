#!/usr/bin/env node

/**
 * Script to create app-icon.png with padding from favicon.png
 * This prevents the icon from being trimmed on Android/iOS home screens
 * 
 * Usage: node scripts/create-app-icon.js
 * 
 * Requires: sharp (npm install sharp --save-dev)
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('Error: sharp package is required. Install it with:');
  console.error('  npm install sharp --save-dev');
  process.exit(1);
}

const assetsDir = path.join(__dirname, '..', 'assets');
const faviconPath = path.join(assetsDir, 'favicon.png');
const appIconPath = path.join(assetsDir, 'app-icon.png');

// Check if favicon exists
if (!fs.existsSync(faviconPath)) {
  console.error(`Error: ${faviconPath} not found`);
  process.exit(1);
}

async function createAppIcon() {
  try {
    console.log('Reading favicon.png...');
    const favicon = sharp(faviconPath);
    const metadata = await favicon.metadata();
    
    const originalWidth = metadata.width;
    const originalHeight = metadata.height;
    
    // Calculate new dimensions with 20% padding (10% on each side)
    // This keeps the icon content in the center 80% of the image
    const paddingPercent = 0.4; // 20% total padding
    const contentScale = 1 - paddingPercent; // 80% for content
    
    // For adaptive icons, we want a square output
    // Use the larger dimension as the base
    const baseSize = Math.max(originalWidth, originalHeight);
    const outputSize = baseSize; // Keep same size, but add padding
    const contentSize = Math.floor(baseSize * contentScale);
    
    console.log(`Original size: ${originalWidth}x${originalHeight}`);
    console.log(`Output size: ${outputSize}x${outputSize}`);
    console.log(`Content area: ${contentSize}x${contentSize} (centered)`);
    
    // Resize the favicon to fit in the content area, maintaining aspect ratio
    const resizedFavicon = await favicon
      .resize(contentSize, contentSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
      })
      .toBuffer();
    
    // Create a new image with the output size, transparent background
    // Center the resized favicon in it
    await sharp({
      create: {
        width: outputSize,
        height: outputSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([
        {
          input: resizedFavicon,
          gravity: 'center'
        }
      ])
      .png()
      .toFile(appIconPath);
    
    console.log(`✓ Created ${appIconPath}`);
    console.log('The icon now has 40% padding on all sides to prevent trimming.');
    console.log('Rebuild your app to see the changes.');
    
  } catch (error) {
    console.error('Error creating app icon:', error);
    process.exit(1);
  }
}

createAppIcon();

