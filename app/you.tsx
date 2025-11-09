import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { IconButton, useTheme, Text, TextInput, Button } from 'react-native-paper';
import { router } from 'expo-router';
import { getCurrentUserName, saveCurrentUserName, getAllUsers, saveUser, User } from '../src/services/storage/userStorage';

export default function YouScreen() {
  const theme = useTheme();
  const [username, setUsername] = useState('');
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      try {
        const users = await getAllUsers();
        const currentUser = users.find(u => u.isCurrentUser);
        if (currentUser) {
          // Show current username if set, otherwise show name
          setUsername(currentUser.username || currentUser.name || '');
        } else {
          // No current user, show name from storage
          const currentName = await getCurrentUserName();
          if (currentName) {
            setUsername(currentName);
          }
        }
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setIsInitialLoad(false);
      }
    };
    loadUser();
  }, []);

  const handleSave = async () => {
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    // Normalize username (lowercase, replace spaces with underscores)
    const normalizedUsername = username.trim().toLowerCase().replace(/\s+/g, '_');

    try {
      const users = await getAllUsers();
      const currentUser = users.find(u => u.isCurrentUser);

      // Check if username is available (excluding current user)
      const conflictingUser = users.find(u => 
        u.id !== currentUser?.id && u.username === normalizedUsername
      );

      if (conflictingUser) {
        setError('This username is already taken');
        return;
      }

      if (currentUser) {
        // Update existing user
        currentUser.name = username.trim();
        currentUser.username = normalizedUsername;
        await saveUser(currentUser);
      } else {
        // Create new user
        const newUser: User = {
          id: 'current_user',
          name: username.trim(),
          username: normalizedUsername,
          isCurrentUser: true,
        };
        await saveUser(newUser);
        // Also save to current user name storage
        await saveCurrentUserName(username.trim());
      }

      setError('');
      // Navigate to the player page after saving
      router.replace(`/player/${encodeURIComponent(normalizedUsername)}`);
    } catch (error) {
      console.error('Error saving username:', error);
      setError('Failed to save username');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header with Back Button */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.outlineVariant }]}>
        <IconButton
          icon="arrow-left"
          size={24}
          iconColor={theme.colors.onSurface}
          onPress={() => router.back()}
          style={styles.backButton}
        />
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
          Set Username
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
          Choose a unique username. This will be used to identify you in rounds and on your player page.
        </Text>

        {/* Username Input */}
        <View style={styles.usernameSection}>
          <Text style={[styles.label, { color: theme.colors.onSurface }]}>
            Username
          </Text>
          <TextInput
            mode="outlined"
            value={username}
            onChangeText={(text) => {
              setUsername(text);
              setError('');
            }}
            placeholder="Enter your username"
            style={styles.usernameInput}
            error={!!error}
          />
          {error ? (
            <Text style={[styles.errorText, { color: theme.colors.error }]}>
              {error}
            </Text>
          ) : null}
        </View>

        {/* Save Button */}
        <Button
          mode="contained"
          onPress={handleSave}
          style={styles.saveButton}
          disabled={!username.trim() || isInitialLoad}
        >
          Save Username
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingLeft: 4,
    paddingRight: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  backButton: {
    margin: 0,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
    flex: 1,
    marginLeft: 8,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 24,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  usernameSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  usernameInput: {
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  saveButton: {
    marginTop: 8,
  },
});

