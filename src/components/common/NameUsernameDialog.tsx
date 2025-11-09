import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Dialog, Portal, TextInput, Button, Text, useTheme } from 'react-native-paper';
import { isUsernameAvailable } from '../../services/storage/userStorage';

interface NameUsernameDialogProps {
  visible: boolean;
  title: string;
  nameLabel?: string;
  initialName?: string;
  initialUsername?: string;
  excludeUserId?: string;
  onDismiss: (() => void) | null;
  onSave: (name: string, username: string) => Promise<void>;
}

export default function NameUsernameDialog({
  visible,
  title,
  nameLabel = 'Name',
  initialName = '',
  initialUsername = '',
  excludeUserId,
  onDismiss,
  onSave,
}: NameUsernameDialogProps) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(initialName);
      const defaultUsername = initialUsername || initialName.trim().toLowerCase().replace(/\s+/g, '_');
      setUsername(defaultUsername);
      setUsernameError('');
    }
  }, [visible, initialName, initialUsername]);

  // Generate default username when name changes
  const handleNameChange = (text: string) => {
    setName(text);
    // Only auto-update username if user hasn't manually edited it
    if (!username || username === name.trim().toLowerCase().replace(/\s+/g, '_')) {
      const defaultUsername = text.trim().toLowerCase().replace(/\s+/g, '_');
      setUsername(defaultUsername);
      setUsernameError('');
    }
  };

  // Check username availability
  const handleUsernameChange = useCallback(async (text: string) => {
    const normalized = text.trim().toLowerCase().replace(/\s+/g, '_');
    setUsername(normalized);
    setUsernameError('');

    if (!normalized) {
      return;
    }

    setIsCheckingUsername(true);
    try {
      const available = await isUsernameAvailable(normalized, excludeUserId);
      
      if (!available) {
        setUsernameError('This username is already taken');
      }
    } catch (error) {
      console.error('Error checking username:', error);
    } finally {
      setIsCheckingUsername(false);
    }
  }, [excludeUserId]);

  const handleSave = async () => {
    if (!name.trim()) {
      return;
    }

    if (!username.trim()) {
      setUsernameError('Username is required');
      return;
    }

    if (usernameError) {
      return;
    }

    try {
      const normalizedUsername = username.trim().toLowerCase().replace(/\s+/g, '_');

      // Final check for availability
      const available = await isUsernameAvailable(normalizedUsername, excludeUserId);
      if (!available) {
        setUsernameError('This username is already taken');
        return;
      }

      await onSave(name.trim(), normalizedUsername);
      setName('');
      setUsername('');
      setUsernameError('');
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss || undefined}
        dismissable={onDismiss !== null}
        style={styles.dialog}
      >
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <TextInput
            mode="outlined"
            label={nameLabel}
            value={name}
            onChangeText={handleNameChange}
            placeholder={`Enter ${nameLabel.toLowerCase()}`}
            style={styles.nameInput}
            autoFocus
          />
          <View style={styles.usernameContainer}>
            <Text style={[styles.usernameLabel, { color: theme.colors.onSurface }]}>
              Username
            </Text>
            <TextInput
              mode="outlined"
              value={username}
              onChangeText={handleUsernameChange}
              placeholder="username"
              style={styles.usernameInput}
              contentStyle={[styles.usernameInputText, { color: theme.colors.onSurfaceVariant }]}
              left={
                <TextInput.Icon
                  icon={() => <Text style={[styles.atSymbol, { color: theme.colors.onSurfaceVariant }]}>@</Text>}
                  style={styles.atSymbolContainer}
                />
              }
              error={!!usernameError}
              disabled={isCheckingUsername}
            />
            {usernameError ? (
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                {usernameError}
              </Text>
            ) : null}
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          {onDismiss && (
            <Button onPress={onDismiss}>
              Cancel
            </Button>
          )}
          <Button
            mode="contained"
            onPress={handleSave}
            disabled={!name.trim() || !username.trim() || !!usernameError || isCheckingUsername}
          >
            {onDismiss ? 'Save' : 'Continue'}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    zIndex: 1000,
  },
  nameInput: {
    marginTop: 8,
  },
  usernameContainer: {
    marginTop: 16,
  },
  usernameLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  usernameInput: {
    paddingVertical: 4,
  },
  atSymbolContainer: {
    marginLeft: 0,
    marginRight: -4,
    paddingRight: 0,
  },
  atSymbol: {
    fontSize: 14,
    fontWeight: '500',
  },
  usernameInputText: {
    fontSize: 13,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
});

