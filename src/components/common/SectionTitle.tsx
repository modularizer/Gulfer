/**
 * Shared Section Title Component
 * Consistent section title styling
 */

import React from 'react';
import { Text, useTheme } from 'react-native-paper';

interface SectionTitleProps {
  children: React.ReactNode;
}

export default function SectionTitle({ children }: SectionTitleProps) {
  const theme = useTheme();

  return (
    <Text style={[styles.title, { color: theme.colors.onSurface }]}>
      {children}
    </Text>
  );
}

const styles = {
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
};

