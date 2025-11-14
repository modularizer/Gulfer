import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { IconButton, useTheme, Text, TextInput, Button } from 'react-native-paper';
import { router } from 'expo-router';
import { getCurrentUserName, saveCurrentUserName, getAllUsers, saveUser, generateUserId, getUserById } from '@/services/storage/userStorage';
import { getCurrentUserId, setCurrentUserId } from '@/services/storage/currentUserStorage';
import { encodeNameForUrl } from '@/utils/urlEncoding';

export default function YouScreen() {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUserId = await getCurrentUserId();
        if (currentUserId) {
          const currentUser = await getUserById(currentUserId);
          if (currentUser) {
            // Show current name
            setName(currentUser.name || '');
          }
        } else {
          // No current user, show name from storage
          const currentName = await getCurrentUserName();
          if (currentName) {
            setName(currentName);
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
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    try {
      const currentUserId = await getCurrentUserId();
      let currentUser = currentUserId ? await getUserById(currentUserId) : null;

      if (currentUser) {
        // Update existing user
        currentUser.name = name.trim();
        await saveUser(currentUser);
      } else {
        // Create new user
        const userId = await generateUserId();
        const newUser = {
          id: userId,
          name: name.trim(),
        };
        await saveUser(newUser);
        // Set as current user
        await setCurrentUserId(userId);
        // Also save to current user name storage
        await saveCurrentUserName(name.trim());
        currentUser = newUser;
      }

      setError('');
      // Navigate to the player page after saving
      if (currentUser) {
        router.replace(`/player/${encodeNameForUrl(currentUser.name)}/overview`);
      }
    } catch (error) {
      console.error('Error saving name:', error);
      setError('Failed to save name');
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
          Set Name
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
          Enter your name. This will be used to identify you in rounds and on your player page.
        </Text>

        {/* Name Input */}
        <View style={styles.usernameSection}>
          <Text style={[styles.label, { color: theme.colors.onSurface }]}>
            Name
          </Text>
          <TextInput
            mode="outlined"
            value={name}
            onChangeText={(text) => {
              setName(text);
              setError('');
            }}
            placeholder="Enter your name"
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
          disabled={!name.trim() || isInitialLoad}
        >
          Save Name
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

