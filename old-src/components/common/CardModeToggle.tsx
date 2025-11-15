/**
 * Card Mode Toggle Component
 * Toggles between different card display modes: list, small, medium, large
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SegmentedButtons, useTheme } from 'react-native-paper';

export type CardMode = 'list' | 'small' | 'medium' | 'large';

interface CardModeToggleProps {
  mode: CardMode;
  onModeChange: (mode: CardMode) => void;
}

export default function CardModeToggle({
  mode,
  onModeChange,
}: CardModeToggleProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={mode}
        onValueChange={(value) => onModeChange(value as CardMode)}
        buttons={[
          {
            value: 'list',
            icon: 'format-list-bulleted',
            style: styles.button,
          },
          {
            value: 'small',
            icon: 'view-grid-outline',
            style: styles.button,
          },
          {
            value: 'medium',
            icon: 'view-grid',
            style: styles.button,
          },
          {
            value: 'large',
            icon: 'view-agenda',
            style: styles.button,
          },
        ]}
        style={styles.segmentedButtons}
        density="small"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'flex-end',
  },
  segmentedButtons: {
    maxWidth: 300,
  },
  button: {
    minWidth: 50,
  },
});

