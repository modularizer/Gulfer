#!/usr/bin/env node

/**
 * Script to generate Android app icons from app-icon.png
 * Generates all required mipmap densities for adaptive icons
 * 
 * Usage: node scripts/generate-android-icons.js
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
const appIconPath = path.join(assetsDir, 'app-icon.png');
const androidResDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

// Android mipmap density sizes (in pixels)
// For adaptive icons, the foreground image should be the full icon size
// Android will handle the safe zone clipping
const densities = {
  'mipmap-mdpi': 108,      // 48dp * 1.0 * 2.25 (foreground for adaptive icon)
  'mipmap-hdpi': 162,      // 48dp * 1.5 * 2.25
  'mipmap-xhdpi': 216,     // 48dp * 2.0 * 2.25
  'mipmap-xxhdpi': 324,    // 48dp * 3.0 * 2.25
  'mipmap-xxxhdpi': 432,   // 48dp * 4.0 * 2.25
};

// Legacy icon sizes (full icon, not just foreground)
const legacySizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

// Check if app-icon exists
if (!fs.existsSync(appIconPath)) {
  console.error(`Error: ${appIconPath} not found`);
  console.error('Please run: npm run create-app-icon');
  process.exit(1);
}

async function generateAndroidIcons() {
  try {
    console.log('Reading app-icon.png...');
    const appIcon = sharp(appIconPath);
    const metadata = await appIcon.metadata();
    
    console.log(`Source icon size: ${metadata.width}x${metadata.height}`);
    console.log('\nGenerating Android icon resources...\n');

    // Generate foreground icons for adaptive icons (Android 8.0+)
    for (const [density, size] of Object.entries(densities)) {
      const densityDir = path.join(androidResDir, density);
      
      // Ensure directory exists
      if (!fs.existsSync(densityDir)) {
        fs.mkdirSync(densityDir, { recursive: true });
      }
      
      const foregroundPath = path.join(densityDir, 'ic_launcher_foreground.png');
      
      await appIcon
        .clone()
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(foregroundPath);
      
      console.log(`✓ Generated ${foregroundPath} (${size}x${size})`);
    }

    // Generate legacy icons for older Android versions
    for (const [density, size] of Object.entries(legacySizes)) {
      const densityDir = path.join(androidResDir, density);
      
      // Ensure directory exists
      if (!fs.existsSync(densityDir)) {
        fs.mkdirSync(densityDir, { recursive: true });
      }
      
      const launcherPath = path.join(densityDir, 'ic_launcher.png');
      const launcherRoundPath = path.join(densityDir, 'ic_launcher_round.png');
      
      // Generate square icon
      await appIcon
        .clone()
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 } // White background for legacy icons
        })
        .png()
        .toFile(launcherPath);
      
      // Round icon is the same as square for now (Android will handle rounding)
      await appIcon
        .clone()
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toFile(launcherRoundPath);
      
      console.log(`✓ Generated ${launcherPath} (${size}x${size})`);
      console.log(`✓ Generated ${launcherRoundPath} (${size}x${size})`);
    }

    console.log('\n✓ All Android icon resources generated successfully!');
    console.log('Rebuild your Android app to see the changes.');
    console.log('Run: cd android && ./gradlew clean && ./gradlew assembleRelease');
    
  } catch (error) {
    console.error('Error generating Android icons:', error);
    process.exit(1);
  }
}

generateAndroidIcons();

