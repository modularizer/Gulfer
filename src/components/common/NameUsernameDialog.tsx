import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Dialog, Portal, TextInput, Button, Text, useTheme } from 'react-native-paper';
import { useDialogStyle } from '../../hooks/useDialogStyle';
interface NameUsernameDialogProps {
  visible: boolean;
  title: string;
  nameLabel?: string;
  initialName?: string;
  initialUsername?: string; // Deprecated, kept for backward compatibility
  excludeUserId?: string; // Deprecated, kept for backward compatibility
  onDismiss: (() => void) | null;
  onSave: (name: string, username: string) => Promise<void>; // username parameter is ignored
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
  const dialogStyle = useDialogStyle();
  const [name, setName] = useState('');

  useEffect(() => {
    if (visible) {
      setName(initialName);
    }
  }, [visible, initialName]);

  const handleNameChange = (text: string) => {
    setName(text);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      return;
    }

    try {
      // username parameter is ignored, but we pass empty string for backward compatibility
      await onSave(name.trim(), '');
      setName('');
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
        style={[styles.dialog, dialogStyle]}
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
            onSubmitEditing={handleSave}
          />
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
            disabled={!name.trim()}
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

