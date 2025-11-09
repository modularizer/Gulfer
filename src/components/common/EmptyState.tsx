/**
 * Shared Empty State Component
 * Reusable empty state message for list views
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Paragraph, useTheme } from 'react-native-paper';

interface EmptyStateProps {
  message: string;
}

export default function EmptyState({ message }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Paragraph style={[styles.text, { color: theme.colors.onSurfaceVariant }]}>
        {message}
      </Paragraph>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  text: {
    textAlign: 'center',
    fontSize: 16,
  },
});

