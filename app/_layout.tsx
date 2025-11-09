import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import AppLayout from '../src/components/common/AppLayout';
import '../src/utils/suppressWarnings';

function RootLayoutNav() {
  const { theme, isDark } = useTheme();

  return (
    <PaperProvider theme={theme}>
      <AppLayout>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        >
          <Stack.Screen 
            name="round/[id]" 
            options={{
              headerShown: true,
              title: 'Round Details',
              headerStyle: { backgroundColor: theme.colors.surface },
              headerTintColor: theme.colors.onSurface,
            }}
          />
        </Stack>
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

