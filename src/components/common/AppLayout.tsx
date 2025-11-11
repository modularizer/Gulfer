import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import Footer from './Footer';
import { getAllUsers, saveUser, saveCurrentUserName, generateUserId, User } from '../../services/storage/userStorage';
import { useTheme } from '../../theme/ThemeContext';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const { theme } = useTheme();
  const [isBigScreen, setIsBigScreen] = useState(false);

  // Check if we're on a big screen (where size constraints would apply)
  useEffect(() => {
    if (Platform.OS === 'web') {
      const checkScreenSize = () => {
        const { width, height } = Dimensions.get('window');
        // Big screen if width > maxWidth (500) or height > maxHeight (900)
        setIsBigScreen(width > 500 || height > 900);
      };
      
      checkScreenSize();
      const subscription = Dimensions.addEventListener('change', checkScreenSize);
      
      return () => {
        subscription?.remove();
      };
    }
  }, []);

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
    <View style={[styles.outerContainer, Platform.OS === 'web' && { backgroundColor: theme.colors.background }]}>
      {Platform.OS === 'web' && (
        <Image
          source={require('../../../assets/background.webp')}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
      )}
      <View style={[
        styles.container, 
        Platform.OS === 'web' && { backgroundColor: theme.colors.surface },
        Platform.OS === 'web' && isBigScreen && styles.bigScreenContainer
      ]}>
        <SafeAreaView style={styles.content} edges={['top']}>
          {children}
        </SafeAreaView>
        <SafeAreaView edges={['bottom']}>
          <Footer />
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      alignItems: 'center',
      justifyContent: 'center', // Center vertically when height is limited
      position: 'relative',
    }),

  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.15,
    zIndex: 0,
  },
  container: {
    flex: 1,
    width: '100%',
    ...(Platform.OS === 'web' && {
      maxWidth: 500, // Wider phone-sized width to accommodate footer
      maxHeight: 900, // Limit height on tall desktop screens
      height: '100%',
      boxShadow: '0 0 20px rgba(0, 0, 0, 0.1)', // Subtle shadow to distinguish the app container
      overflow: 'hidden', // Ensure footer doesn't overflow
      zIndex: 1, // Ensure container is above background image
      position: 'relative',
    }),
  },
  bigScreenContainer: {
    borderRadius: 15,
    borderWidth: 2,
  },
  content: {
    flex: 1,
  },
});

