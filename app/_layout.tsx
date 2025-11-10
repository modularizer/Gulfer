import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import AppLayout from '../src/components/common/AppLayout';
import { usePWARouteCache } from '../src/utils/pwa';
import '../src/utils/suppressWarnings';

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
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootLayoutNav />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

