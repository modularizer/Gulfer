import { Stack } from 'expo-router';

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
        name="db-browser/list" 
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
    </Stack>
  );
}
