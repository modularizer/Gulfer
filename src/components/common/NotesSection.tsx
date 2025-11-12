/**
 * Shared Notes Section Component
 * Reusable editable notes section for rounds, courses, players, etc.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, useTheme } from 'react-native-paper';

interface NotesSectionProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export default function NotesSection({
  value,
  onChangeText,
  placeholder = 'Add any notes...',
}: NotesSectionProps) {
  const theme = useTheme();

  return (
    <View style={styles.notesSection}>
      <Text style={[styles.notesTitle, { color: theme.colors.onSurface }]}>
        Notes
      </Text>
      <TextInput
        mode="flat"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline
        numberOfLines={3}
        style={styles.notesInput}
        contentStyle={styles.notesContent}
        underlineColor="transparent"
        activeUnderlineColor={theme.colors.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  notesSection: {
    paddingHorizontal: 24,
    paddingBottom: 0, // No padding to minimize space below notes
  },
  notesTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 0,
  },
  notesInput: {
    backgroundColor: 'transparent',
    marginTop: 8,
  },
  notesContent: {
    fontSize: 16,
    paddingVertical: 8,
    paddingTop: 0,
  },
});

