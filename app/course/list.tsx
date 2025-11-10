import React, { useState, useEffect, useCallback } from 'react';
import { TouchableOpacity, View, Platform } from 'react-native';
import { Card, Title, useTheme, Dialog, Portal, TextInput, Button } from 'react-native-paper';
import { Course, Player } from '@/types';
import { getAllCourses, saveCourse, generateCourseId, deleteCourse } from '@/services/storage/courseStorage';
import { getAllRounds } from '@/services/storage/roundStorage';
import { getShadowStyle } from '@/utils';
import { router } from 'expo-router';
import { encodeNameForUrl } from '@/utils/urlEncoding';
import { Alert } from 'react-native';
import {
  ListPageLayout,
  PlayerChip,
} from '@/components/common';
import { useSelection } from '@/hooks/useSelection';
import { useListPage } from '@/hooks/useListPage';
import { listPageStyles } from '@/styles/listPageStyles';

export default function CoursesScreen() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [newCourseDialog, setNewCourseDialog] = useState({ visible: false, name: '', holes: '9' });
  const [bestScoresByCourse, setBestScoresByCourse] = useState<Map<string, Map<string, { player: Player; score: number }>>>(new Map());
  
  const loadCourses = useCallback(async () => {
    try {
      const loadedCourses = await getAllCourses();
      setCourses(loadedCourses);
      setFilteredCourses(loadedCourses);
      
      // Load rounds and calculate best scores per course
      const allRounds = await getAllRounds();
      const bestScoresMap = new Map<string, Map<string, { player: Player; score: number }>>();
      
      await Promise.all(loadedCourses.map(async (course) => {
        const courseRounds = allRounds.filter(r => {
          const roundCourseName = r.courseName?.trim();
          const courseName = course.name.trim();
          return roundCourseName === courseName;
        });
        
        const courseBestScores = new Map<string, { player: Player; score: number }>();
        
        await Promise.all(courseRounds.map(async (round) => {
          if (round.scores && round.scores.length > 0 && round.players) {
            await Promise.all(round.players.map(async (player) => {
              const playerScores = round.scores!.filter(s => s.playerId === player.id);
              if (playerScores.length === 0) return;
              
              const total = playerScores.reduce((sum, s) => sum + s.throws, 0);
              const key = player.id;
              const existing = courseBestScores.get(key);
              if (!existing || total < existing.score) {
                courseBestScores.set(key, { player, score: total });
              }
            }));
          }
        }));
        
        if (courseBestScores.size > 0) {
          bestScoresMap.set(course.id, courseBestScores);
        }
      }));
      
      setBestScoresByCourse(bestScoresMap);
    } catch (error) {
      console.error('Error loading courses:', error);
    }
  }, []);

  const selection = useSelection<string>();
  const listPage = useListPage<string>({
    onDelete: async (ids) => {
      for (const id of ids) {
        await deleteCourse(id);
      }
      await loadCourses();
    },
    onRefresh: loadCourses,
    itemType: 'course',
  });

  useEffect(() => {
    loadCourses();
  }, []);

  const handleCoursePress = useCallback(
    async (courseId: string, courseName: string) => {
      if (selection.selectedCount > 0) {
        selection.toggleSelection(courseId);
      } else {
        router.push(`/course/${encodeNameForUrl(courseName)}/overview`);
      }
    },
    [selection]
  );

  const handleCourseLongPress = useCallback(
    (courseId: string) => {
      selection.addToSelection(courseId);
    },
    [selection]
  );

  const handleDeleteSelected = useCallback(async () => {
    const success = await listPage.handleDeleteSelected(selection.selectedIds);
    if (success) {
      selection.clearSelection();
    }
  }, [selection, listPage]);

  const handleSaveNewCourse = useCallback(async () => {
    if (!newCourseDialog.name.trim()) {
      listPage.showError('Error', 'Course name is required');
      return;
    }

    const holesNum = parseInt(newCourseDialog.holes, 10);
    if (isNaN(holesNum) || holesNum <= 0) {
      listPage.showError('Error', 'Number of holes must be a positive number');
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
      setNewCourseDialog({ visible: false, name: '', holes: '9' });
      await loadCourses();
    } catch (error) {
      console.error('Error saving course:', error);
      listPage.showError('Error', 'Failed to save course');
    }
  }, [newCourseDialog, loadCourses, listPage]);


  const getHoleCount = (course: Course): number => {
    if (Array.isArray(course.holes)) {
      return course.holes.length;
    }
    return course.holes as unknown as number || 0;
  };

  const theme = useTheme();

  const renderCourseItem = useCallback(
    ({ item }: { item: Course }) => {
      const holeCount = getHoleCount(item);
      const courseBestScores = bestScoresByCourse.get(item.id);
      const bestScoresArray = courseBestScores ? Array.from(courseBestScores.values()) : [];
      const isSelected = selection.isSelected(item.id);
      
      const winner = bestScoresArray.length > 0 
        ? bestScoresArray.reduce((min, current) => current.score < min.score ? current : min)
        : null;

      return (
        <TouchableOpacity 
          onPress={() => handleCoursePress(item.id, item.name)}
          onLongPress={() => handleCourseLongPress(item.id)}
          delayLongPress={300}
          {...(Platform.OS === 'web' ? {
            onContextMenu: (e: any) => {
              e.preventDefault();
              e.stopPropagation();
              handleCourseLongPress(item.id);
            }
          } : {})}
        >
          <Card style={[
            listPageStyles.card, 
            getShadowStyle(2),
            isSelected && { backgroundColor: theme.colors.primaryContainer }
          ]}>
            <Card.Content>
              <View style={listPageStyles.cardHeader}>
                <Title style={listPageStyles.cardTitle}>
                  {item.name} ({holeCount} {holeCount === 1 ? 'hole' : 'holes'})
                </Title>
              </View>
              {bestScoresArray.length > 0 && (
                <View style={listPageStyles.bestScoresContainer}>
                  {bestScoresArray
                    .sort((a, b) => a.score - b.score)
                    .map(({ player, score }) => {
                      const isWinner = winner ? player.id === winner.player.id : false;
                      return (
                        <PlayerChip
                          key={player.id}
                          player={player}
                          score={score}
                          isWinner={isWinner}
                        />
                      );
                    })}
                </View>
              )}
            </Card.Content>
          </Card>
        </TouchableOpacity>
      );
    },
    [handleCoursePress, handleCourseLongPress, selection, bestScoresByCourse, theme.colors.primaryContainer]
  );

  return (
    <ListPageLayout
      currentValue="courses"
      addLabel="Add Course"
      onAdd={() => router.push('/course/add')}
      items={filteredCourses}
      renderItem={renderCourseItem}
      keyExtractor={(item) => item.id.toString()}
      emptyMessage="No courses saved yet. Create a course to begin!"
      selectedCount={selection.selectedCount}
      onClearSelection={selection.clearSelection}
      onDelete={() => listPage.setShowDeleteDialog(true)}
      showDeleteDialog={listPage.showDeleteDialog}
      onDismissDeleteDialog={() => listPage.setShowDeleteDialog(false)}
      onConfirmDelete={handleDeleteSelected}
      itemType="course"
      refreshing={listPage.refreshing}
      onRefresh={listPage.handleRefresh}
      errorDialog={listPage.errorDialog}
      onDismissError={listPage.hideError}
    >
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
              style={listPageStyles.dialogInput}
              placeholder="Enter course name"
              autoFocus
            />
            <TextInput
              label="Number of Holes"
              value={newCourseDialog.holes}
              onChangeText={(holes) => setNewCourseDialog(prev => ({ ...prev, holes }))}
              mode="outlined"
              style={listPageStyles.dialogInput}
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

    </ListPageLayout>
  );
}

