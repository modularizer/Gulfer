import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { ThemeProvider, useTheme } from './theme/ThemeContext';

import HomeScreen from './screens/HomeScreen';
import ScorecardScreen from './screens/ScorecardScreen';
import RoundHistoryScreen from './screens/RoundHistoryScreen';
import RoundDetailScreen from './screens/RoundDetailScreen';

export type RootStackParamList = {
  Home: undefined;
  Scorecard: undefined;
  RoundHistory: undefined;
  RoundDetail: { roundId: string };
};

const Stack = createStackNavigator<RootStackParamList>();

function AppContent() {
  const { theme, isDark } = useTheme();

  const navigationTheme = isDark ? NavigationDarkTheme : NavigationDefaultTheme;

  return (
    <PaperProvider theme={theme}>
      <NavigationContainer theme={navigationTheme}>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: theme.colors.background },
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
          />
          <Stack.Screen
            name="Scorecard"
            component={ScorecardScreen}
          />
          <Stack.Screen
            name="RoundHistory"
            component={RoundHistoryScreen}
          />
          <Stack.Screen
            name="RoundDetail"
            component={RoundDetailScreen}
            options={{
              headerShown: true,
              title: 'Round Details',
              headerStyle: { backgroundColor: theme.colors.surface },
              headerTintColor: theme.colors.onSurface,
            }}
          />
        </Stack.Navigator>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </NavigationContainer>
    </PaperProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

