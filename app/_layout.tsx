import { Stack } from 'expo-router';

// Early initialization - import adapters to trigger auto-initialization
// This ensures PGlite and registry are set up before any database operations
import '../xp-deeby/adapters';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'Database Test',
          headerShown: false
        }} 
      />
      <Stack.Screen 
        name="db-browser/index"
        options={{ 
          title: 'Database Browser',
          headerShown: false
        }} 
      />
      <Stack.Screen 
        name="db-browser/[db]/[table]" 
        options={{ 
          headerShown: false,
          title: ''
        }} 
      />
        <Stack.Screen
            name="db-browser/[db]/index"
            options={{
                headerShown: false,
                title: ''
            }}
        />
    </Stack>
  );
}
