/**
 * Shared Add/Import Button Container
 * Reusable button container for Add and Import actions
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import CardModeToggle, { CardMode } from './CardModeToggle';

interface AddImportButtonsProps {
  addLabel: string;
  onAdd: () => void;
  importLabel?: string;
  onImport?: () => void;
  cardMode?: CardMode;
  onCardModeChange?: (mode: CardMode) => void;
}

export default function AddImportButtons({
  addLabel,
  onAdd,
  importLabel,
  onImport,
  cardMode,
  onCardModeChange,
}: AddImportButtonsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
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
      {cardMode !== undefined && onCardModeChange && (
        <CardModeToggle mode={cardMode} onModeChange={onCardModeChange} />
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },
  addButton: {
    alignSelf: 'flex-start',
  },
  importButton: {
    alignSelf: 'flex-start',
  },
});

