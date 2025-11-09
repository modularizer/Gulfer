import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { IconButton, useTheme, Text, TextInput, Button, Dialog, Portal } from 'react-native-paper';
import { router } from 'expo-router';
import { getCurrentUserName, saveCurrentUserName, getProfileImageHash, saveProfileImageHash } from '../src/services/storage/userStorage';
import { clear } from '../src/services/storage/storageAdapter';
import { pickPhoto } from '../src/services/photos/photoService';
import HashedImage from '../src/components/common/HashedImage';

export default function ProfileScreen() {
  const theme = useTheme();
  const [username, setUsername] = useState('');
  const [profileImageHash, setProfileImageHash] = useState<string | null>(null);
  const [resetDialogVisible, setResetDialogVisible] = useState(false);
  const [resetConfirmationText, setResetConfirmationText] = useState('');
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const currentName = await getCurrentUserName();
        if (currentName) {
          setUsername(currentName);
        }
        const imageHash = await getProfileImageHash();
        if (imageHash) {
          setProfileImageHash(imageHash);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setIsInitialLoad(false);
      }
    };
    loadProfile();
  }, []);

  // Auto-save username when it changes (but not on initial load)
  useEffect(() => {
    if (isInitialLoad) return;

    const saveUsername = async () => {
      if (username.trim()) {
        try {
          await saveCurrentUserName(username.trim());
        } catch (error) {
          console.error('Error saving username:', error);
        }
      }
    };

    // Debounce the save to avoid too many saves while typing
    const timeoutId = setTimeout(() => {
      saveUsername();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username, isInitialLoad]);

  const handleResetData = async () => {
    if (resetConfirmationText !== 'DELETE ALL') {
      return;
    }

    try {
      await clear();
      setResetConfirmationText('');
      Alert.alert('Success', 'All data has been reset', [
        {
          text: 'OK',
          onPress: () => {
            router.push('/');
          },
        },
      ]);
    } catch (error) {
      console.error('Error resetting data:', error);
      Alert.alert('Error', 'Failed to reset data');
    }
    setResetDialogVisible(false);
  };

  const handleCloseResetDialog = () => {
    setResetDialogVisible(false);
    setResetConfirmationText('');
  };

  const handlePickProfileImage = async () => {
    try {
      const photo = await pickPhoto();
      if (photo) {
        await saveProfileImageHash(photo.hash);
        setProfileImageHash(photo.hash);
      }
    } catch (error) {
      console.error('Error picking profile image:', error);
      Alert.alert('Error', 'Failed to set profile picture');
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
          Profile
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Picture Section */}
        <View style={styles.profilePictureSection}>
          <TouchableOpacity
            style={[styles.profilePictureContainer, { borderColor: theme.colors.outline }]}
            onPress={handlePickProfileImage}
          >
            {profileImageHash ? (
              <HashedImage
                hash={profileImageHash}
                style={styles.profilePicture}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.profilePicturePlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
                <IconButton
                  icon="camera"
                  size={40}
                  iconColor={theme.colors.onSurfaceVariant}
                  style={styles.cameraIcon}
                />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Username Section */}
        <View style={styles.usernameSection}>
          <Text style={[styles.label, { color: theme.colors.onSurface }]}>
            Username
          </Text>
          <TextInput
            mode="outlined"
            value={username}
            onChangeText={setUsername}
            placeholder="Enter your username"
            style={styles.usernameInput}
          />
        </View>

        {/* Reset Data Section */}
        <View style={styles.resetSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Danger Zone
          </Text>
          <Button
            mode="contained"
            buttonColor={theme.colors.error}
            textColor="#fff"
            icon="delete"
            onPress={() => setResetDialogVisible(true)}
            style={styles.resetButton}
          >
            Reset All Data
          </Button>
          <Text style={[styles.resetWarning, { color: theme.colors.error }]}>
            This will permanently delete all rounds, courses, players, and settings. This action cannot be undone.
          </Text>
        </View>
      </ScrollView>

      {/* Reset Confirmation Dialog */}
      <Portal>
        <Dialog
          visible={resetDialogVisible}
          onDismiss={handleCloseResetDialog}
        >
          <Dialog.Title>Reset All Data</Dialog.Title>
          <Dialog.Content>
            <Text>
              Are you sure you want to reset all data? This will permanently delete:
            </Text>
            <Text style={styles.dialogList}>
              • All rounds{'\n'}
              • All courses{'\n'}
              • All players{'\n'}
              • All settings
            </Text>
            <Text style={styles.dialogWarning}>
              This action cannot be undone.
            </Text>
            <Text style={styles.dialogConfirmationLabel}>
              Type "DELETE ALL" to confirm:
            </Text>
            <TextInput
              mode="outlined"
              value={resetConfirmationText}
              onChangeText={setResetConfirmationText}
              placeholder="DELETE ALL"
              style={styles.dialogInput}
              autoCapitalize="characters"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleCloseResetDialog}>
              Cancel
            </Button>
            <Button
              buttonColor={theme.colors.error}
              textColor="#fff"
              onPress={handleResetData}
              disabled={resetConfirmationText !== 'DELETE ALL'}
            >
              Reset All Data
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  profilePictureSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  profilePictureContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  profilePicture: {
    width: '100%',
    height: '100%',
  },
  profilePicturePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIcon: {
    margin: 0,
  },
  usernameSection: {
    marginBottom: 32,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  usernameInput: {
    marginBottom: 8,
  },
  resetSection: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  resetButton: {
    marginBottom: 12,
  },
  resetWarning: {
    fontSize: 12,
    lineHeight: 18,
  },
  dialogList: {
    marginTop: 12,
    marginBottom: 12,
    lineHeight: 24,
  },
  dialogWarning: {
    marginTop: 8,
    fontWeight: '600',
    color: '#d32f2f',
  },
  dialogConfirmationLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  dialogInput: {
    marginTop: 8,
  },
});

