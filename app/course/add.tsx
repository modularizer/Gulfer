import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Dialog, Portal, TextInput, useTheme, Text } from 'react-native-paper';
import { router } from 'expo-router';
import { Course } from '../../src/types';
import { saveCourse, generateCourseId } from '../../src/services/storage/courseStorage';
import { ErrorDialog } from '../../src/components/common';

export default function AddCourseScreen() {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [holes, setHoles] = useState('9');
  const [errorDialog, setErrorDialog] = useState({ visible: false, title: '', message: '' });

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setErrorDialog({ visible: true, title: 'Error', message: 'Course name is required' });
      return;
    }

    const holesNum = parseInt(holes, 10);
    if (isNaN(holesNum) || holesNum <= 0) {
      setErrorDialog({ visible: true, title: 'Error', message: 'Number of holes must be a positive number' });
      return;
    }

    try {
      const newCourse: Course = {
        id: await generateCourseId(),
        name: name.trim(),
        holes: Array.from({ length: holesNum }, (_, i) => ({
          number: i + 1,
        })),
      };

      await saveCourse(newCourse);
      const { encodeNameForUrl } = await import('../../src/utils/urlEncoding');
      router.push(`/course/${encodeNameForUrl(newCourse.name)}/overview`);
    } catch (error) {
      console.error('Error saving course:', error);
      setErrorDialog({ visible: true, title: 'Error', message: 'Failed to save course' });
    }
  }, [name, holes]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Button
          icon="arrow-left"
          onPress={() => router.back()}
          textColor={theme.colors.onSurface}
        >
          Back
        </Button>
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          Add Course
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <TextInput
          label="Course Name"
          value={name}
          onChangeText={setName}
          mode="outlined"
          style={styles.input}
          placeholder="Enter course name"
          autoFocus
        />
        <TextInput
          label="Number of Holes"
          value={holes}
          onChangeText={setHoles}
          mode="outlined"
          style={styles.input}
          placeholder="9"
          keyboardType="numeric"
        />
        <Button
          mode="contained"
          onPress={handleSave}
          style={styles.saveButton}
        >
          Save Course
        </Button>
      </View>

      <ErrorDialog
        visible={errorDialog.visible}
        title={errorDialog.title}
        message={errorDialog.message}
        onDismiss={() => setErrorDialog({ visible: false, title: '', message: '' })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerSpacer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    padding: 24,
  },
  input: {
    marginBottom: 16,
  },
  saveButton: {
    marginTop: 8,
  },
});

