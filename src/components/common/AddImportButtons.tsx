/**
 * Shared Add/Import Button Container
 * Reusable button container for Add and Import actions
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';

interface AddImportButtonsProps {
  addLabel: string;
  onAdd: () => void;
  importLabel?: string;
  onImport?: () => void;
}

export default function AddImportButtons({
  addLabel,
  onAdd,
  importLabel,
  onImport,
}: AddImportButtonsProps) {
  return (
    <View style={styles.container}>
      <Button
        mode="contained"
        icon="plus"
        onPress={onAdd}
        style={styles.addButton}
      >
        {addLabel}
      </Button>
      {importLabel && onImport && (
        <Button
          mode="outlined"
          icon="import"
          onPress={onImport}
          style={styles.importButton}
        >
          {importLabel}
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    gap: 8,
  },
  addButton: {
    alignSelf: 'flex-start',
    marginRight: 8,
  },
  importButton: {
    alignSelf: 'flex-start',
  },
});

