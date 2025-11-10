import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import Footer, { FooterContext } from './Footer';
import { getAllUsers, saveUser, saveCurrentUserName, generateUserId, User } from '../../services/storage/userStorage';
import NameUsernameDialog from './NameUsernameDialog';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const [customCenterHandler, setCustomCenterHandler] = useState<(() => void) | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [initialName, setInitialName] = useState('');
  
  // Use ref to store handler to avoid re-renders when handler changes
  const handlerRef = useRef<(() => void) | null>(null);

  const registerCenterButtonHandler = useCallback((handler: (() => void) | null) => {
    // Only update state if handler actually changed to prevent unnecessary re-renders
    if (handlerRef.current !== handler) {
      handlerRef.current = handler;
      // Defer state update to avoid updating during render
      // This prevents the "Cannot update a component while rendering" warning
      Promise.resolve().then(() => {
        setCustomCenterHandler(handler);
      });
    }
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  // Note: We use handlerRef.current in the context value so Footer can access the latest handler
  // even if state hasn't updated yet
  const contextValue = useMemo(() => ({
    registerCenterButtonHandler,
    customCenterHandler: handlerRef.current || customCenterHandler,
  }), [registerCenterButtonHandler, customCenterHandler]);

  // Check if username is set on mount and on navigation changes
  useEffect(() => {
    const checkUsername = async () => {
      // Don't show modal on /you page (that page is for setting username)
      if (pathname === '/you') {
        setShowNameModal(false);
        setIsChecking(false);
        return;
      }

      try {
        const users = await getAllUsers();
        const currentUser = users.find(u => u.isCurrentUser);
        
        if (!currentUser || !currentUser.name) {
          // No name set, show modal
          setShowNameModal(true);
        } else {
          // Name is set, hide modal if it was showing
          setShowNameModal(false);
        }
      } catch (error) {
        console.error('Error checking username:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkUsername();
  }, [pathname]); // Re-check when pathname changes (navigation)

  // Load initial name when modal should be shown
  useEffect(() => {
    const loadInitialName = async () => {
      if (showNameModal && !isChecking) {
        try {
          const users = await getAllUsers();
          const currentUser = users.find(u => u.isCurrentUser);
          if (currentUser?.name) {
            setInitialName(currentUser.name);
          } else {
            setInitialName('');
          }
        } catch (error) {
          console.error('Error loading initial name:', error);
          setInitialName('');
        }
      }
    };
    loadInitialName();
  }, [showNameModal, isChecking]);

  const handleSaveName = async (name: string, username: string) => {
    try {
      const users = await getAllUsers();
      const currentUser = users.find(u => u.isCurrentUser);

      if (currentUser) {
        // Update existing user
        currentUser.name = name;
        await saveUser(currentUser);
      } else {
        // Create new user
        const userId = await generateUserId();
        const newUser: User = {
          id: userId,
          name,
          isCurrentUser: true,
        };
        await saveUser(newUser);
        // Also save to current user name storage
        await saveCurrentUserName(name);
      }

      setShowNameModal(false);
    } catch (error) {
      console.error('Error saving name:', error);
    }
  };

  return (
    <FooterContext.Provider value={contextValue}>
      <View style={styles.container}>
        <View style={styles.content}>
          {children}
        </View>
        <SafeAreaView edges={['bottom']}>
          <Footer customCenterHandler={customCenterHandler} />
        </SafeAreaView>
      </View>

      {/* Name Modal */}
      {showNameModal && !isChecking && (
        <NameUsernameDialog
          visible={true}
          title="Welcome!"
          nameLabel="Your Name"
          initialName={initialName}
          onDismiss={null} // Non-dismissible
          onSave={handleSaveName}
        />
      )}
    </FooterContext.Provider>
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

