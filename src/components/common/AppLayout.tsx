import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import Footer from './Footer';
import { getAllUsers, saveUser, saveCurrentUserName, generateUserId, User } from '../../services/storage/userStorage';
import NameUsernameDialog from './NameUsernameDialog';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const [showNameModal, setShowNameModal] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [initialName, setInitialName] = useState('');

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
    <View style={styles.container}>
      <View style={styles.content}>
        {children}
      </View>
      <SafeAreaView edges={['bottom']}>
        <Footer />
      </SafeAreaView>

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

