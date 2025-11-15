import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'Database Test',
          headerShown: true 
        }} 
      />
      <Stack.Screen 
        name="db-browser/list" 
        options={{ 
          title: 'Database Browser',
          headerShown: true 
        }} 
      />
      <Stack.Screen 
        name="db-browser/[dbname]" 
        options={{ 
          title: 'Database Browser',
          headerShown: true 
        }} 
      />
    </Stack>
  );
}
