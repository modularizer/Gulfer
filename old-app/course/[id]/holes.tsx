import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from 'react-native-paper';
import HolesTable from '@/components/common/HolesTable';
import { getCourseByName, saveCourse } from '@/services/storage/courseStorage';
import { router, useLocalSearchParams } from 'expo-router';

export default function CourseHolesScreen() {
  const { id: courseNameParam } = useLocalSearchParams<{ id: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [distanceUnit, setDistanceUnit] = useState<'yd' | 'm'>('yd');
  const theme = useTheme();

  // Load course storage
  useEffect(() => {
    const loadCourse = async () => {
      if (!courseNameParam) {
        setTimeout(() => router.push('/course/list'), 1000);
        return;
      }

      try {
        // Decode the course name from URL
        const courseName = decodeURIComponent(courseNameParam);
        const loadedCourse = await getCourseByName(courseName);
        if (!loadedCourse) {
          setTimeout(() => router.push('/course/list'), 1000);
          return;
        }

        setCourse(loadedCourse);
      } catch (error) {
        console.error('Error loading course:', error);
        setTimeout(() => router.push('/course/list'), 1000);
      } finally {
        setLoading(false);
      }
    };

    if (courseNameParam) {
      loadCourse();
    }
  }, [courseNameParam]);

  const handleHoleUpdate = useCallback(async (updatedHole: Hole) => {
    if (!course) return;

    const updatedHoles = course.holes.map((h) => {
      if (h.number === updatedHole.number) {
        return updatedHole;
      }
      return h;
    });

    const updatedCourse: Course = {
      ...course,
      holes: updatedHoles,
    };

    setCourse(updatedCourse);
    await saveCourse(updatedCourse);
  }, [course]);

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!course) {
    return null;
  }

  const holeCount = Array.isArray(course.holes) ? course.holes.length : (course.holes as unknown as number || 0);
  const holes: Hole[] = Array.isArray(course.holes) 
    ? course.holes 
    : Array.from({ length: holeCount }, (_, i) => ({ number: i + 1 }));

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <HolesTable
        holes={holes}
        onHoleUpdate={handleHoleUpdate}
        onBack={() => {
          if (courseNameParam) {
            router.push(`/course/${encodeURIComponent(courseNameParam)}/overview`);
          } else {
            router.push('/course/list');
          }
        }}
        distanceUnit={distanceUnit}
        onDistanceUnitChange={setDistanceUnit}
        courseId={course.id}
        showGStats={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

