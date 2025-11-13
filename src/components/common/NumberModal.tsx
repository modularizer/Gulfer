import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Dialog, Portal, IconButton } from 'react-native-paper';
import { useDialogStyle } from '@/hooks/useDialogStyle';

interface NumberModalProps {
  visible: boolean;
  title: string;
  defaultValue: number;
  onSave: (value: number | null) => void;
  onDismiss: () => void;
  min?: number;
  max?: number;
  allowClear?: boolean;
}

export default function NumberModal({
  visible,
  title,
  defaultValue,
  onSave,
  onDismiss,
  min = 0,
  max = 20,
  allowClear = false,
}: NumberModalProps) {
  const dialogStyle = useDialogStyle();
  const [editValue, setEditValue] = useState(defaultValue.toString());

  // Update value when defaultValue changes (e.g., when modal opens with new value)
  useEffect(() => {
    if (visible) {
      setEditValue(defaultValue.toString());
    }
  }, [defaultValue, visible]);

  const handleValueChange = (text: string) => {
    // Only update the display value, don't save yet
    setEditValue(text);
  };

  const handleClose = () => {
    // Save before closing
    const trimmedValue = editValue.trim();
    
    // If allowClear is true and value is empty or 0, clear the value
    if (allowClear && (trimmedValue === '' || trimmedValue === '0')) {
      onSave(null);
    } else {
      const num = parseInt(trimmedValue, 10);
      if (!isNaN(num) && num >= min && num <= max) {
        onSave(num);
      }
    }
    onDismiss();
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={handleClose} style={dialogStyle}>
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

