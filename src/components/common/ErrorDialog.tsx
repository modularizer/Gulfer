/**
 * Shared Error Dialog Component
 * Reusable error dialog for displaying error messages
 */

import React from 'react';
import { Dialog, Portal, Button, Text } from 'react-native-paper';

interface ErrorDialogProps {
  visible: boolean;
  title: string;
  message: string;
  onDismiss: () => void;
}

export default function ErrorDialog({
  visible,
  title,
  message,
  onDismiss,
}: ErrorDialogProps) {
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <Text>{message}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>OK</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

