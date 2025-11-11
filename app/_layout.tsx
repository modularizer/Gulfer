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

  // Preload and cache favicons on web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      // Check if preload links already exist
      const existingPng = document.querySelector('link[rel="preload"][href="/favicon.png"]');
      const existingSvg = document.querySelector('link[rel="preload"][href="/favicon.svg"]');
      
      if (!existingPng) {
        const linkPng = document.createElement('link');
        linkPng.rel = 'preload';
        linkPng.as = 'image';
        linkPng.href = '/favicon.png';
        linkPng.type = 'image/png';
        document.head.appendChild(linkPng);
      }
      
      if (!existingSvg) {
        const linkSvg = document.createElement('link');
        linkSvg.rel = 'preload';
        linkSvg.as = 'image';
        linkSvg.href = '/favicon.svg';
        linkSvg.type = 'image/svg+xml';
        document.head.appendChild(linkSvg);
      }
      
      // Also add as icon links for browser compatibility
      const existingIconPng = document.querySelector('link[rel="icon"][href="/favicon.png"]');
      const existingIconSvg = document.querySelector('link[rel="icon"][href="/favicon.svg"]');
      
      if (!existingIconPng) {
        const iconPng = document.createElement('link');
        iconPng.rel = 'icon';
        iconPng.href = '/favicon.png';
        iconPng.type = 'image/png';
        document.head.appendChild(iconPng);
      }
      
      if (!existingIconSvg) {
        const iconSvg = document.createElement('link');
        iconSvg.rel = 'icon';
        iconSvg.href = '/favicon.svg';
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

