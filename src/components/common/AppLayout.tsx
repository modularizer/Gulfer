import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform, Dimensions, useColorScheme } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import Footer from './Footer';
import { getAllUsers, saveUser, saveCurrentUserName, generateUserId, getUserById } from '@/services/storage/userStorage';
import { getCurrentUserId, setCurrentUserId } from '@/services/storage/currentUserStorage';
import { useTheme } from '../../theme/ThemeContext';
import backgroundImage from '../../../assets/background.webp';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const { theme } = useTheme();
  const systemColorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const [isBigScreen, setIsBigScreen] = useState(false);
  
  // Determine safe area background color based on system theme
  // This ensures the safe area insets match the system notification bar
  // CRITICAL: Must match system theme to avoid white-on-white text conflicts
  // Dark mode = black background (white text), Light mode = white background (dark text)
  const safeAreaBackgroundColor = Platform.OS !== 'web' 
    ? (systemColorScheme === 'dark' ? '#000000' : '#FFFFFF')
    : undefined;

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
        const currentUserId = await getCurrentUserId();
        let currentUser = currentUserId ? await getUserById(currentUserId) : null;
        
        if (!currentUser || !currentUser.name) {
          // No current user or no name set, create/update with "You"
          if (currentUser) {
            // Update existing user
            currentUser.name = 'You';
            await saveUser(currentUser);
          } else {
            // Create new user
            const userId = await generateUserId();
            const newUser = {
              id: userId,
              name: 'You',
            };
            await saveUser(newUser);
            // Set as current user
            await setCurrentUserId(userId);
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
    <View style={[
      styles.outerContainer, 
      Platform.OS === 'web' && { backgroundColor: theme.colors.background },
      Platform.OS !== 'web' && { backgroundColor: safeAreaBackgroundColor }
    ]}>
      {Platform.OS === 'web' && (
        <Image
          source={backgroundImage}
          style={styles.backgroundImage}
          contentFit="cover"
        />
      )}
      {/* Safe area overlay - ensures correct background color for status bar area */}
      {Platform.OS !== 'web' && safeAreaBackgroundColor && (
        <View 
          style={[
            styles.safeAreaTop,
            { 
              height: insets.top,
              backgroundColor: safeAreaBackgroundColor 
            }
          ]}
        />
      )}
      <View style={[
        styles.container, 
        Platform.OS === 'web' && { backgroundColor: theme.colors.surface },
        Platform.OS === 'web' && isBigScreen && styles.bigScreenContainer,
        Platform.OS !== 'web' && { backgroundColor: theme.colors.background }
      ]}>
        <SafeAreaView 
          style={[
            styles.content,
            Platform.OS !== 'web' && { backgroundColor: 'transparent' }
          ]} 
          edges={['top']}
        >
          {children}
        </SafeAreaView>
        <SafeAreaView 
          edges={['bottom']}
          style={Platform.OS !== 'web' && { backgroundColor: 'transparent' }}
        >
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
  safeAreaTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
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

