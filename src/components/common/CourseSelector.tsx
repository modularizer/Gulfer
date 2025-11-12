import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { IconButton, Menu, Dialog, Portal, Button, TextInput, useTheme } from 'react-native-paper';
import { Course, getAllCourses, saveCourse, generateCourseId, getLastUsedCourse, getLatestAddedCourse } from '@/services/storage/courseStorage';

// Helper function to get number of holes from Course (handles both old and new format)
const getHoleCount = (course: Course): number => {
  if (Array.isArray(course.holes)) {
    return course.holes.length;
  }
  return course.holes as unknown as number || 0;
};

interface CourseSelectorProps {
  selectedCourseId: string | null;
  onCourseChange: (courseId: string | null) => void;
  onHolesChange?: (holes: number) => void; // Optional callback when holes change
  initialCourseName?: string; // Optional: course name to match on initial load
}

export default function CourseSelector({
  selectedCourseId,
  onCourseChange,
  onHolesChange,
  initialCourseName,
}: CourseSelectorProps) {
  const theme = useTheme();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseMenuVisible, setCourseMenuVisible] = useState(false);
  const [newCourseDialog, setNewCourseDialog] = useState({ visible: false, name: '', holes: '9' });
  const [errorDialog, setErrorDialog] = useState({ visible: false, title: '', message: '' });
  const [isInitialized, setIsInitialized] = useState(false);

  // Load courses and initialize selection
  useEffect(() => {
    const loadCourses = async () => {
      try {
        const loadedCourses = await getAllCourses();
        setCourses(loadedCourses);
        
        // If we have an initial course name but no selected course ID, try to find it
        if (initialCourseName && !selectedCourseId && !isInitialized) {
          const trimmedInitialName = initialCourseName.trim();
          const matchingCourse = loadedCourses.find(c => c.name.trim() === trimmedInitialName);
          if (matchingCourse) {
            onCourseChange(matchingCourse.id);
            if (onHolesChange) {
              onHolesChange(getHoleCount(matchingCourse));
            }
          } else {
            // No match found - default to last used or latest added
            const defaultCourse = await getLastUsedCourse() || await getLatestAddedCourse();
            if (defaultCourse) {
              onCourseChange(defaultCourse.id);
              if (onHolesChange) {
                onHolesChange(getHoleCount(defaultCourse));
              }
            }
          }
          setIsInitialized(true);
        } else if (!selectedCourseId && !isInitialized) {
          // No initial course name - default to last used or latest added
          const defaultCourse = await getLastUsedCourse() || await getLatestAddedCourse();
          if (defaultCourse) {
            onCourseChange(defaultCourse.id);
            if (onHolesChange) {
              onHolesChange(getHoleCount(defaultCourse));
            }
          }
          setIsInitialized(true);
        } else {
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('Error loading courses:', error);
        setIsInitialized(true);
      }
    };

    loadCourses();
  }, [initialCourseName, selectedCourseId, isInitialized, onCourseChange, onHolesChange]);

  // Helper function to format course display name
  const formatCourseDisplayName = useCallback((course: Course | undefined): string => {
    if (!course) return 'Select Course';
    return `${course.name} (${getHoleCount(course)} holes)`;
  }, []);

  const handleSelectCourse = useCallback((courseId: string | null) => {
    onCourseChange(courseId);
    setCourseMenuVisible(false);
    
    // Notify about holes change if callback provided
    if (courseId !== null && onHolesChange) {
      const selectedCourse = courses.find(c => c.id === courseId);
      if (selectedCourse) {
        onHolesChange(getHoleCount(selectedCourse));
      }
    }
  }, [courses, onCourseChange, onHolesChange]);

  const handleAddNewCourse = useCallback(() => {
    setNewCourseDialog({ visible: true, name: '', holes: '9' });
    setCourseMenuVisible(false);
  }, []);

  const handleSaveNewCourse = useCallback(async () => {
    if (!newCourseDialog.name.trim()) {
      setErrorDialog({ visible: true, title: 'Error', message: 'Course name is required' });
      return;
    }

    const holesNum = parseInt(newCourseDialog.holes, 10);
    if (isNaN(holesNum) || holesNum <= 0) {
      setErrorDialog({ visible: true, title: 'Error', message: 'Number of holes must be a positive number' });
      return;
    }

    try {
      const newCourse: Course = {
        id: await generateCourseId(),
        name: newCourseDialog.name.trim(),
        holes: Array.from({ length: holesNum }, (_, i) => ({
          number: i + 1,
        })),
      };

      await saveCourse(newCourse);
      // Add the new course to the courses array immediately
      const updatedCourses = [...courses, newCourse];
      setCourses(updatedCourses);
      // Auto-select the new course
      onCourseChange(newCourse.id);
      if (onHolesChange) {
        onHolesChange(getHoleCount(newCourse));
      }
      setNewCourseDialog({ visible: false, name: '', holes: '9' });
    } catch (error) {
      console.error('Error saving course:', error);
      setErrorDialog({ visible: true, title: 'Error', message: 'Failed to save course' });
    }
  }, [newCourseDialog, courses, onCourseChange, onHolesChange]);

  const selectedCourse = selectedCourseId 
    ? courses.find(c => c.id === selectedCourseId)
    : undefined;

  return (
    <>
      <Menu
        visible={courseMenuVisible}
        onDismiss={() => setCourseMenuVisible(false)}
        anchor={
          <TouchableOpacity
            onPress={() => setCourseMenuVisible(true)}
            style={[styles.courseSelector, { borderBottomColor: theme.colors.outlineVariant }]}
            activeOpacity={0.7}
          >
            <View style={styles.courseSelectorContent}>
              <IconButton
                icon="map-marker"
                size={20}
                iconColor={theme.colors.onSurface}
                style={styles.courseIcon}
              />
              <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
                <Text 
                  style={[styles.courseSelectorText, { color: theme.colors.onSurface }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {formatCourseDisplayName(selectedCourse)}
                </Text>
              </View>
              <IconButton
                icon="chevron-down"
                size={20}
                iconColor={theme.colors.onSurface}
                style={styles.courseIcon}
              />
            </View>
          </TouchableOpacity>
        }
      >
        {courses.map((course) => (
          <Menu.Item
            key={course.id}
            onPress={() => handleSelectCourse(course.id)}
            title={formatCourseDisplayName(course)}
            titleStyle={selectedCourseId === course.id ? { fontWeight: 'bold' } : {}}
          />
        ))}
        <Menu.Item
          onPress={handleAddNewCourse}
          title="+ Add New Course"
          titleStyle={{ color: theme.colors.primary }}
        />
      </Menu>

      {/* Add New Course Dialog */}
      <Portal>
        <Dialog
          visible={newCourseDialog.visible}
          onDismiss={() => setNewCourseDialog({ visible: false, name: '', holes: '9' })}
        >
          <Dialog.Title>Add New Course</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Course Name"
              value={newCourseDialog.name}
              onChangeText={(name) => setNewCourseDialog(prev => ({ ...prev, name }))}
              mode="outlined"
              style={styles.dialogInput}
              placeholder="Enter course name"
              autoFocus
            />
            <TextInput
              label="Number of Holes"
              value={newCourseDialog.holes}
              onChangeText={(holes) => setNewCourseDialog(prev => ({ ...prev, holes }))}
              mode="outlined"
              style={styles.dialogInput}
              placeholder="9"
              keyboardType="numeric"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setNewCourseDialog({ visible: false, name: '', holes: '9' })}
            >
              Cancel
            </Button>
            <Button onPress={handleSaveNewCourse} mode="contained">
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Error Dialog */}
      <Portal>
        <Dialog
          visible={errorDialog.visible}
          onDismiss={() => setErrorDialog({ visible: false, title: '', message: '' })}
        >
          <Dialog.Title>{errorDialog.title}</Dialog.Title>
          <Dialog.Content>
            <Text>{errorDialog.message}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setErrorDialog({ visible: false, title: '', message: '' })}>
              OK
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  courseSelector: {
    borderBottomWidth: 1,
    minHeight: 56,
    height: 56,
    justifyContent: 'center',
    width: '100%',
    minWidth: 300,
    maxWidth: 400,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  courseSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    width: '100%',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  courseSelectorText: {
    fontSize: 16,
  },
  courseIcon: {
    margin: 0,
    padding: 0,
    width: 40,
    height: 40,
  },
  dialogInput: {
    marginBottom: 16,
  },
});

