import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import Footer from './Footer';
import { getAllUsers, saveUser, saveCurrentUserName, generateUserId, User } from '../../services/storage/userStorage';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();

  // Ensure current user exists with name "You" if no name is set
  useEffect(() => {
    const ensureCurrentUser = async () => {
      try {
        const users = await getAllUsers();
        const currentUser = users.find(u => u.isCurrentUser);
        
        if (!currentUser || !currentUser.name) {
          // No current user or no name set, create/update with "You"
          if (currentUser) {
            // Update existing user
            currentUser.name = 'You';
            await saveUser(currentUser);
          } else {
            // Create new user
            const userId = await generateUserId();
            const newUser: User = {
              id: userId,
              name: 'You',
              isCurrentUser: true,
            };
            await saveUser(newUser);
            // Also save to current user name storage
            await saveCurrentUserName('You');
          }
        }
      } catch (error) {
        console.error('Error ensuring current user:', error);
      }
    };

    ensureCurrentUser();
  }, [pathname]); // Re-check when pathname changes (navigation)

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {children}
      </View>
      <SafeAreaView edges={['bottom']}>
        <Footer />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});

