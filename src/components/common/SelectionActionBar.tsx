import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';

interface SelectionActionBarProps {
  selectedCount: number;
  onCancel: () => void;
  onDelete: () => void;
}

export default function SelectionActionBar({
  selectedCount,
  onCancel,
  onDelete,
}: SelectionActionBarProps) {
  const theme = useTheme();

  if (selectedCount === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.actionBar,
        { backgroundColor: theme.colors.surface },
      ]}
    >
      <Text style={[styles.actionBarText, { color: theme.colors.onSurface }]}>
        {selectedCount} selected
      </Text>
      <View style={styles.actionBarButtons}>
        <Button
          mode="text"
          onPress={onCancel}
          textColor={theme.colors.onSurface}
        >
          Cancel
        </Button>
        <Button
          mode="contained"
          buttonColor={theme.colors.error}
          textColor="#fff"
          icon="delete"
          onPress={onDelete}
        >
          Delete
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  actionBarText: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionBarButtons: {
    flexDirection: 'row',
    gap: 8,
  },
});

