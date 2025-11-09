import React from 'react';
import { Dialog, Button, Text, useTheme, Portal } from 'react-native-paper';

interface DeleteConfirmationDialogProps {
  visible: boolean;
  itemType: string; // e.g., "round", "course", "player"
  count: number;
  onDismiss: () => void;
  onConfirm: () => void;
}

export default function DeleteConfirmationDialog({
  visible,
  itemType,
  count,
  onDismiss,
  onConfirm,
}: DeleteConfirmationDialogProps) {
  const theme = useTheme();
  const itemTypePlural = count !== 1 ? `${itemType}s` : itemType;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>Delete {itemTypePlural.charAt(0).toUpperCase() + itemTypePlural.slice(1)}</Dialog.Title>
        <Dialog.Content>
          <Text>
            Are you sure you want to delete {count} {itemTypePlural}? This action cannot be undone.
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button
            buttonColor={theme.colors.error}
            textColor="#fff"
            onPress={onConfirm}
          >
            Delete
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

