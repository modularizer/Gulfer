/**
 * Shared Notes Section Component
 * Reusable editable notes section for rounds, courses, players, etc.
 */

import React, { useState } from 'react';
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
  const [inputHeight, setInputHeight] = useState(60);

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
        style={[styles.notesInput, { height: Math.max(inputHeight, 140), marginBottom: - 70 }]}
        contentStyle={styles.notesContent}
        underlineColor="transparent"
        activeUnderlineColor={theme.colors.primary}
        scrollEnabled={false}
        dense={false}
        onContentSizeChange={(event) => {
          const { height } = event.nativeEvent.contentSize;
          setInputHeight(height);
        }}
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
    minHeight: 90, // Minimum height of 60px
  },
  notesContent: {
    fontSize: 16,
    paddingVertical: 8,
    paddingTop: 0,
  },
});

