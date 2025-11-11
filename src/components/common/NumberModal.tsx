import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Dialog, Portal, IconButton } from 'react-native-paper';

interface NumberModalProps {
  visible: boolean;
  title: string;
  defaultValue: number;
  onSave: (value: number) => void;
  onDismiss: () => void;
  min?: number;
  max?: number;
}

export default function NumberModal({
  visible,
  title,
  defaultValue,
  onSave,
  onDismiss,
  min = 0,
  max = 20,
}: NumberModalProps) {
  const [editValue, setEditValue] = useState(defaultValue.toString());

  // Update value when defaultValue changes (e.g., when modal opens with new value)
  useEffect(() => {
    if (visible) {
      setEditValue(defaultValue.toString());
    }
  }, [defaultValue, visible]);

  const handleValueChange = (text: string) => {
    setEditValue(text);
    const num = parseInt(text, 10);
    if (!isNaN(num) && num >= min && num <= max) {
      // Auto-save on valid input
      onSave(num);
    }
  };

  const handleClose = () => {
    // Save before closing
    const num = parseInt(editValue, 10);
    if (!isNaN(num) && num >= min && num <= max) {
      onSave(num);
    }
    onDismiss();
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={handleClose}>
        <View style={styles.modalHeader}>
          <Dialog.Title style={styles.modalTitle}>{title}</Dialog.Title>
          <IconButton
            icon="close"
            size={24}
            onPress={handleClose}
            style={styles.closeButton}
          />
        </View>
        <Dialog.Content>
          <View style={styles.modalContent}>
            <TextInput
              mode="outlined"
              value={editValue}
              onChangeText={handleValueChange}
              keyboardType="numeric"
              style={styles.modalInput}
              autoFocus
              selectTextOnFocus
            />
          </View>
        </Dialog.Content>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 8,
  },
  modalTitle: {
    flex: 1,
  },
  closeButton: {
    margin: 0,
  },
  modalContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  modalInput: {
    width: 100,
  },
});

