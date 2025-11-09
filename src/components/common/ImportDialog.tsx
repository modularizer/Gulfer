/**
 * Shared Import Dialog Component
 * Reusable dialog for importing entities (courses, players, rounds)
 */

import React from 'react';
import { Dialog, Portal, Button, Text, TextInput, useTheme } from 'react-native-paper';
import { Platform, StyleSheet } from 'react-native';

interface ImportDialogProps {
  visible: boolean;
  title: string;
  helpText: string;
  importText: string;
  onImportTextChange: (text: string) => void;
  onDismiss: () => void;
  onImport: () => void | Promise<void>;
  disabled?: boolean;
}

export default function ImportDialog({
  visible,
  title,
  helpText,
  importText,
  onImportTextChange,
  onDismiss,
  onImport,
  disabled = false,
}: ImportDialogProps) {
  const theme = useTheme();

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={styles.dialog}
      >
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <Text style={[styles.helpText, { color: theme.colors.onSurfaceVariant }]}>
            {helpText}
          </Text>
          <TextInput
            mode="outlined"
            value={importText}
            onChangeText={onImportTextChange}
            multiline
            numberOfLines={20}
            style={styles.textInput}
            contentStyle={styles.textContent}
            placeholder="Paste export text here..."
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button
            mode="contained"
            onPress={onImport}
            disabled={disabled || !importText.trim()}
          >
            Import
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '80%',
  },
  helpText: {
    marginBottom: 12,
    fontSize: 14,
  },
  textInput: {
    maxHeight: 400,
  },
  textContent: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },
});

