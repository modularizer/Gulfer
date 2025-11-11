import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';
import AppLayout from '@/components/common/AppLayout';
import { usePWARouteCache } from '@/utils/pwa';
import '@/utils/suppressWarnings';
import { migrateRoundsCourseId } from '@/services/storage/roundStorage';

function RootLayoutNav() {
  const { theme, isDark } = useTheme();
  usePWARouteCache(); // Handle PWA route caching

  return (
    <PaperProvider theme={theme}>
      <AppLayout>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
          }}
          />
      </AppLayout>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </PaperProvider>
  );
}

export default function RootLayout() {
  // Run migrations on app startup
  useEffect(() => {
    const runMigrations = async () => {
      try {
        await migrateRoundsCourseId();
      } catch (error) {
        console.error('Error running migrations:', error);
      }
    };
    runMigrations();
  }, []);

  // Inject PWA manifest and favicon links on web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      // Prevent scrolling beyond viewport by constraining html and body
      const html = document.documentElement;
      const body = document.body;
      const root = document.getElementById('root');
      
      // Set styles to prevent overflow
      html.style.height = '100%';
      html.style.overflow = 'hidden';
      body.style.height = '100%';
      body.style.overflow = 'hidden';
      body.style.margin = '0';
      body.style.padding = '0';
      
      // Ensure root container is also constrained (but allow children to scroll)
      if (root) {
        root.style.height = '100%';
        root.style.position = 'relative';
      }
      
      // Get base path from Expo config
      const basePath = Constants.expoConfig?.experiments?.baseUrl || '';
      const normalizedBase = basePath && basePath !== '/' 
        ? (basePath.startsWith('/') ? basePath : `/${basePath}`).replace(/\/$/, '')
        : '';
      
      // Add manifest link (required for PWA installation)
      const existingManifest = document.querySelector('link[rel="manifest"]');
      if (!existingManifest) {
        const manifestLink = document.createElement('link');
        manifestLink.rel = 'manifest';
        manifestLink.href = `${normalizedBase}/manifest.json`;
        document.head.appendChild(manifestLink);
      }
      
      // Add theme-color meta tag (if not already present)
      const existingThemeColor = document.querySelector('meta[name="theme-color"]');
      if (!existingThemeColor) {
        const themeColor = document.createElement('meta');
        themeColor.name = 'theme-color';
        themeColor.content = '#ffffff';
        document.head.appendChild(themeColor);
      }
      
      // Check if preload links already exist
      const existingPng = document.querySelector('link[rel="preload"][href="/favicon.png"]');
      const existingSvg = document.querySelector('link[rel="preload"][href="/favicon.svg"]');
      
      if (!existingPng) {
        const linkPng = document.createElement('link');
        linkPng.rel = 'preload';
        linkPng.as = 'image';
        linkPng.href = `${normalizedBase}/favicon.png`;
        linkPng.type = 'image/png';
        document.head.appendChild(linkPng);
      }
      
      if (!existingSvg) {
        const linkSvg = document.createElement('link');
        linkSvg.rel = 'preload';
        linkSvg.as = 'image';
        linkSvg.href = `${normalizedBase}/favicon.svg`;
        linkSvg.type = 'image/svg+xml';
        document.head.appendChild(linkSvg);
      }
      
      // Also add as icon links for browser compatibility
      const existingIconPng = document.querySelector('link[rel="icon"][href="/favicon.png"]');
      const existingIconSvg = document.querySelector('link[rel="icon"][href="/favicon.svg"]');
      
      if (!existingIconPng) {
        const iconPng = document.createElement('link');
        iconPng.rel = 'icon';
        iconPng.href = `${normalizedBase}/favicon.png`;
        iconPng.type = 'image/png';
        document.head.appendChild(iconPng);
      }
      
      if (!existingIconSvg) {
        const iconSvg = document.createElement('link');
        iconSvg.rel = 'icon';
        iconSvg.href = `${normalizedBase}/favicon.svg`;
        iconSvg.type = 'image/svg+xml';
        document.head.appendChild(iconSvg);
      }
    }
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootLayoutNav />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

