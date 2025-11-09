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
import { importCourse } from '../src/services/courseExport';
// Username functionality removed - using IDs instead
import { getShadowStyle } from '../src/utils';
import { router } from 'expo-router';
import { Alert, Platform } from 'react-native';
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
  const [importDialogVisible, setImportDialogVisible] = useState(false);
  const [importText, setImportText] = useState('');
  const [errorDialog, setErrorDialog] = useState({ visible: false, title: '', message: '' });
  const [bestScoresByCourse, setBestScoresByCourse] = useState<Map<string, Map<string, { player: Player; score: number }>>>(new Map());
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
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
              
              // Use player ID as key
              const key = player.id;
              const existing = courseBestScores.get(key);
              if (!existing || total < existing.score) {
                courseBestScores.set(key, { player, score: total });
              }
            }));
          }
        }));
        
        console.log(`Course "${course.name}": Best scores count: ${courseBestScores.size}`);
        
        if (courseBestScores.size > 0) {
          bestScoresMap.set(course.id, courseBestScores);
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
    async (courseId: string, courseName: string) => {
      // If in selection mode, toggle selection instead of navigating
      if (selectedCourseIds.size > 0) {
        setSelectedCourseIds((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(courseId)) {
            newSet.delete(courseId);
          } else {
            newSet.add(courseId);
          }
          return newSet;
        });
      } else {
        // Use course name for URL
        const { encodeNameForUrl } = await import('../src/utils/urlEncoding');
        router.push(`/course/${encodeNameForUrl(courseName)}`);
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
      const courseBestScores = bestScoresByCourse.get(item.id);
      const bestScoresArray = courseBestScores ? Array.from(courseBestScores.values()) : [];
      const isSelected = selectedCourseIds.has(item.id);
      
      // Find the lowest score (winner)
      const winner = bestScoresArray.length > 0 
        ? bestScoresArray.reduce((min, current) => current.score < min.score ? current : min)
        : null;

      return (
        <TouchableOpacity 
          onPress={() => handleCoursePress(item.id, item.name)}
          onLongPress={() => handleCourseLongPress(item.id)}
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
                      const isWinner = winner ? player.id === winner.player.id : false;
                      return (
                        <PlayerChip
                          key={player.id}
                          player={player}
                          score={score}
                          isWinner={isWinner}
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
        <Button
          mode="outlined"
          icon="import"
          onPress={() => setImportDialogVisible(true)}
          style={styles.importButton}
        >
          Import Course
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

      {/* Import Course Dialog */}
      <Portal>
        <Dialog
          visible={importDialogVisible}
          onDismiss={() => {
            setImportDialogVisible(false);
            setImportText('');
          }}
          style={styles.importDialog}
        >
          <Dialog.Title>Import Course</Dialog.Title>
          <Dialog.Content>
            <Text style={[styles.importHelpText, { color: theme.colors.onSurfaceVariant }]}>
              Paste the course export text below.
            </Text>
            <TextInput
              mode="outlined"
              value={importText}
              onChangeText={setImportText}
              multiline
              numberOfLines={20}
              style={styles.importTextInput}
              contentStyle={styles.importTextContent}
              placeholder="Paste course export text here..."
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => {
              setImportDialogVisible(false);
              setImportText('');
            }}>
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={async () => {
                if (!importText.trim()) {
                  Alert.alert('Error', 'Please paste the course export text');
                  return;
                }

                try {
                  const newCourseId = await importCourse(importText);
                  setImportText('');
                  setImportDialogVisible(false);
                  // Refresh courses list
                  await loadCourses();
                  // Navigate to the imported course
                  const { encodeNameForUrl } = await import('../src/utils/urlEncoding');
                  const { getCourseById } = await import('../src/services/storage/courseStorage');
                  const importedCourse = await getCourseById(newCourseId);
                  if (importedCourse) {
                    router.push(`/course/${encodeNameForUrl(importedCourse.name)}`);
                  }
                } catch (error) {
                  console.error('Error importing course:', error);
                  Alert.alert('Import Error', error instanceof Error ? error.message : 'Failed to import course');
                }
              }}
              disabled={!importText.trim()}
            >
              Import
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
    marginRight: 8,
  },
  importButton: {
    alignSelf: 'flex-start',
  },
  importDialog: {
    maxHeight: '80%',
  },
  importHelpText: {
    marginBottom: 12,
    fontSize: 14,
  },
  importTextInput: {
    maxHeight: 400,
  },
  importTextContent: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
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

