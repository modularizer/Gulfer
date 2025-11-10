import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';
import AppLayout from '@/components/common/AppLayout';
import { usePWARouteCache } from '@/utils/pwa';
import '@/utils/suppressWarnings';
import '@/utils/assetPathPatch';

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
  // Preload and cache favicons on web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined' && typeof window !== 'undefined') {
      // Get base path dynamically for GitHub Pages compatibility
      // Try to detect base path from script tags or calculate from pathname
      let basePath = '';
      const scripts = document.querySelectorAll('script[src]');
      for (const script of Array.from(scripts)) {
        const src = script.getAttribute('src');
        if (src && src.includes('/_expo/')) {
          // Extract base path from script src (e.g., "/Gulfer/_expo/..." -> "/Gulfer/")
          // Match pattern: /[repo-name]/_expo/...
          const match = src.match(/^(\/[^\/]+\/)/);
          if (match) {
            basePath = match[1];
            break;
          }
        }
      }
      
      // Fallback: calculate from pathname
      // If pathname is "/" or starts with "/_expo/", we're at root
      // Otherwise, extract first segment as base path
      if (!basePath) {
        const pathname = window.location.pathname;
        if (pathname === '/' || pathname.startsWith('/_expo/')) {
          basePath = '/';
        } else {
          const pathSegments = pathname.split('/').filter(Boolean);
          if (pathSegments.length > 0) {
            basePath = `/${pathSegments[0]}/`;
          } else {
            basePath = '/';
          }
        }
      }
      
      // Ensure basePath ends with / (unless it's root)
      if (basePath !== '/' && !basePath.endsWith('/')) {
        basePath += '/';
      }
      
      const faviconPng = `${basePath}favicon.png`;
      const faviconSvg = `${basePath}favicon.svg`;
      
      // Check if preload links already exist
      const existingPng = document.querySelector('link[rel="preload"][href*="favicon.png"]');
      const existingSvg = document.querySelector('link[rel="preload"][href*="favicon.svg"]');
      
      if (!existingPng) {
        const linkPng = document.createElement('link');
        linkPng.rel = 'preload';
        linkPng.as = 'image';
        linkPng.href = faviconPng;
        linkPng.type = 'image/png';
        document.head.appendChild(linkPng);
      }
      
      if (!existingSvg) {
        const linkSvg = document.createElement('link');
        linkSvg.rel = 'preload';
        linkSvg.as = 'image';
        linkSvg.href = faviconSvg;
        linkSvg.type = 'image/svg+xml';
        document.head.appendChild(linkSvg);
      }
      
      // Also add as icon links for browser compatibility
      const existingIconPng = document.querySelector('link[rel="icon"][href*="favicon.png"]');
      const existingIconSvg = document.querySelector('link[rel="icon"][href*="favicon.svg"]');
      
      if (!existingIconPng) {
        const iconPng = document.createElement('link');
        iconPng.rel = 'icon';
        iconPng.href = faviconPng;
        iconPng.type = 'image/png';
        document.head.appendChild(iconPng);
      }
      
      if (!existingIconSvg) {
        const iconSvg = document.createElement('link');
        iconSvg.rel = 'icon';
        iconSvg.href = faviconSvg;
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

