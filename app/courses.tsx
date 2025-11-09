import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Card, Title, Paragraph, useTheme, Chip, Button, Dialog, Portal, TextInput, Text } from 'react-native-paper';
import { Course, Round, Player, Score } from '../src/types';
import { getAllCourses, saveCourse, generateCourseId, deleteCourse } from '../src/services/storage/courseStorage';
import { getAllRounds } from '../src/services/storage/roundStorage';
import { ensurePlayerHasUsername } from '../src/services/storage/userStorage';
import { getShadowStyle } from '../src/utils';
import { router } from 'expo-router';
import {
  SegmentedButtonsHeader,
  PlayerChip,
  SelectionActionBar,
  DeleteConfirmationDialog,
} from '../src/components/common';

export default function CoursesScreen() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [newCourseDialog, setNewCourseDialog] = useState({ visible: false, name: '', holes: '9' });
  const [errorDialog, setErrorDialog] = useState({ visible: false, title: '', message: '' });
  const [bestScoresByCourse, setBestScoresByCourse] = useState<Map<string, Map<string, { player: Player; score: number }>>>(new Map());
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  
  // Helper to convert course ID to string for Set operations
  const courseIdToString = (id: string | number): string => id.toString();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const loadCourses = useCallback(async () => {
    try {
      const loadedCourses = await getAllCourses();
      setCourses(loadedCourses);
      setFilteredCourses(loadedCourses);
      
      // Load rounds and calculate best scores per course
      const allRounds = await getAllRounds();
      const bestScoresMap = new Map<string, Map<string, { player: Player; score: number }>>();
      
      // Debug: log all rounds and their course names
      console.log('All rounds:', allRounds.map(r => ({ id: r.id, courseName: r.courseName, scoresCount: r.scores?.length || 0 })));
      console.log('All courses:', loadedCourses.map(c => ({ id: c.id, name: c.name })));
      
      await Promise.all(loadedCourses.map(async (course) => {
        // Match course name (trim whitespace for robustness)
        const courseRounds = allRounds.filter(r => {
          const roundCourseName = r.courseName?.trim();
          const courseName = course.name.trim();
          return roundCourseName === courseName;
        });
        
        console.log(`Course "${course.name}": Found ${courseRounds.length} rounds`);
        
        const courseBestScores = new Map<string, { player: Player; score: number }>();
        
        await Promise.all(courseRounds.map(async (round) => {
          if (round.scores && round.scores.length > 0 && round.players) {
            await Promise.all(round.players.map(async (player) => {
              const playerScores = round.scores!.filter(s => s.playerId === player.id);
              if (playerScores.length === 0) return; // Skip if no scores for this player
              
              const total = playerScores.reduce((sum, s) => sum + s.throws, 0);
              
              // Ensure player has username
              const playerWithUsername = await ensurePlayerHasUsername(player);
              if (!playerWithUsername.username) {
                console.error('Player missing username:', player);
                return;
              }
              
              const key = playerWithUsername.username;
              const existing = courseBestScores.get(key);
              if (!existing || total < existing.score) {
                courseBestScores.set(key, { player: { ...player, username: playerWithUsername.username }, score: total });
              }
            }));
          }
        }));
        
        console.log(`Course "${course.name}": Best scores count: ${courseBestScores.size}`);
        
        if (courseBestScores.size > 0) {
          bestScoresMap.set(course.id.toString(), courseBestScores);
        }
      }));
      
      setBestScoresByCourse(bestScoresMap);
    } catch (error) {
      console.error('Error loading courses:', error);
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCourses();
    setRefreshing(false);
  }, [loadCourses]);

  const handleCoursePress = useCallback(
    async (courseId: string | number, courseName: string) => {
      // If in selection mode, toggle selection instead of navigating
      if (selectedCourseIds.size > 0) {
        setSelectedCourseIds((prev) => {
          const newSet = new Set(prev);
          const idStr = courseId.toString();
          if (newSet.has(idStr)) {
            newSet.delete(idStr);
          } else {
            newSet.add(idStr);
          }
          return newSet;
        });
      } else {
        // Convert course ID to codename for URL
        const { idToCodename } = await import('../src/utils/idUtils');
        const courseCodename = idToCodename(courseId);
        router.push(`/course/${courseCodename}`);
      }
    },
    [selectedCourseIds.size]
  );

  const handleCourseLongPress = useCallback(
    (courseId: string) => {
      setSelectedCourseIds((prev) => {
        const newSet = new Set(prev);
        newSet.add(courseId);
        return newSet;
      });
    },
    []
  );

  const handleDeleteSelected = useCallback(async () => {
    try {
      // Delete all selected courses
      for (const courseId of selectedCourseIds) {
        await deleteCourse(courseId);
      }
      // Clear selection and reload courses
      setSelectedCourseIds(new Set());
      setShowDeleteDialog(false);
      await loadCourses();
    } catch (error) {
      console.error('Error deleting courses:', error);
      setShowDeleteDialog(false);
    }
  }, [selectedCourseIds, loadCourses]);

  const handleCancelSelection = useCallback(() => {
    setSelectedCourseIds(new Set());
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
      setNewCourseDialog({ visible: false, name: '', holes: '9' });
      // Reload courses to show the new one
      await loadCourses();
    } catch (error) {
      console.error('Error saving course:', error);
      setErrorDialog({ visible: true, title: 'Error', message: 'Failed to save course' });
    }
  }, [newCourseDialog, loadCourses]);

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
      const courseBestScores = bestScoresByCourse.get(item.id.toString());
      const bestScoresArray = courseBestScores ? Array.from(courseBestScores.values()) : [];
      const isSelected = selectedCourseIds.has(item.id.toString());
      
      // Find the lowest score (winner)
      const winner = bestScoresArray.length > 0 
        ? bestScoresArray.reduce((min, current) => current.score < min.score ? current : min)
        : null;

      return (
        <TouchableOpacity 
          onPress={() => handleCoursePress(item.id, item.name)}
          onLongPress={() => handleCourseLongPress(item.id.toString())}
        >
          <Card style={[
            styles.courseCard, 
            getShadowStyle(2),
            isSelected && { backgroundColor: theme.colors.primaryContainer }
          ]}>
            <Card.Content>
              <View style={styles.courseHeader}>
                <Title style={styles.courseTitle}>
                  {item.name} ({holeCount} {holeCount === 1 ? 'hole' : 'holes'})
                </Title>
              </View>
              {bestScoresArray.length > 0 ? (
                <View style={styles.bestScoresContainer}>
                  {bestScoresArray
                    .sort((a, b) => a.score - b.score)
                    .map(({ player, score }) => {
                      if (!player.username) {
                        console.error('Player missing username:', player);
                        return null;
                      }
                      const playerUsername = player.username; // TypeScript guard
                      const isWinner = winner ? playerUsername === winner.player.username : false;
                      return (
                        <PlayerChip
                          key={playerUsername}
                          player={player}
                          score={score}
                          isWinner={isWinner}
                          onPress={() => router.push(`/player/${encodeURIComponent(playerUsername)}`)}
                        />
                      );
                    })
                    .filter(Boolean)}
                </View>
              ) : null}
            </Card.Content>
          </Card>
        </TouchableOpacity>
      );
    },
    [handleCoursePress, handleCourseLongPress, selectedCourseIds, bestScoresByCourse, theme.colors.primaryContainer]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SegmentedButtonsHeader currentValue="courses" />

      {/* Add Course Button */}
      <View style={styles.addButtonContainer}>
        <Button
          mode="contained"
          icon="plus"
          onPress={() => setNewCourseDialog({ visible: true, name: '', holes: '9' })}
          style={styles.addButton}
        >
          Add Course
        </Button>
      </View>

      {filteredCourses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Paragraph style={styles.emptyText}>
            No courses saved yet. Create a course to begin!
          </Paragraph>
        </View>
      ) : (
        <FlatList
          data={filteredCourses}
          renderItem={renderCourseItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      <SelectionActionBar
        selectedCount={selectedCourseIds.size}
        onCancel={handleCancelSelection}
        onDelete={() => setShowDeleteDialog(true)}
      />

      <DeleteConfirmationDialog
        visible={showDeleteDialog}
        itemType="course"
        count={selectedCourseIds.size}
        onDismiss={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteSelected}
      />

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  addButtonContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  addButton: {
    alignSelf: 'flex-start',
  },
  listContent: {
    padding: 16,
  },
  courseCard: {
    marginBottom: 12,
  },
  courseHeader: {
    marginBottom: 8,
  },
  courseTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  bestScoresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
  },
  dialogInput: {
    marginBottom: 12,
  },
});

