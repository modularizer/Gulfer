import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Card, Title, Paragraph, useTheme, Menu, Chip, Button, IconButton, Dialog, Portal, Text, SegmentedButtons } from 'react-native-paper';
import { Round } from '../src/types';
import { getAllRounds, deleteRound } from '../src/services/storage/roundStorage';
import { getAllCourses, Course } from '../src/services/storage/courseStorage';
import { formatDate, getShadowStyle } from '../src/utils';
import { router } from 'expo-router';
import HashedImage from '../src/components/common/HashedImage';

type SortOrder = 'newest' | 'oldest';

export default function RoundHistoryScreen() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [filteredRounds, setFilteredRounds] = useState<Round[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [courseMenuVisible, setCourseMenuVisible] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [selectedRoundIds, setSelectedRoundIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const loadRounds = useCallback(async () => {
    try {
      const loadedRounds = await getAllRounds();
      setRounds(loadedRounds);
      const loadedCourses = await getAllCourses();
      setCourses(loadedCourses);
    } catch (error) {
      console.error('Error loading rounds:', error);
    }
  }, []);

  const applyFilters = useCallback(
    (roundsToFilter: Round[], courseId: string | null, order: SortOrder) => {
      let filtered = roundsToFilter;

      // Apply course filter
      if (courseId) {
        const selectedCourse = courses.find(c => c.id === courseId);
        if (selectedCourse) {
          filtered = filtered.filter((r) => r.courseName === selectedCourse.name);
        }
      }

      // Apply sort order
      const sorted = filtered.sort((a, b) => {
        return order === 'newest' ? b.date - a.date : a.date - b.date;
      });

      setFilteredRounds(sorted);
    },
    [courses]
  );

  useEffect(() => {
    loadRounds();
  }, []);

  useEffect(() => {
    applyFilters(rounds, selectedCourseId, sortOrder);
  }, [rounds, selectedCourseId, sortOrder, applyFilters]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRounds();
    setRefreshing(false);
  }, [loadRounds]);

  const handleRoundPress = useCallback(
    (roundId: string) => {
      // If in selection mode, toggle selection instead of navigating
      if (selectedRoundIds.size > 0) {
        setSelectedRoundIds((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(roundId)) {
            newSet.delete(roundId);
          } else {
            newSet.add(roundId);
          }
          return newSet;
        });
      } else {
        router.push(`/${roundId}/overview`);
      }
    },
    [selectedRoundIds.size]
  );

  const handleRoundLongPress = useCallback(
    (roundId: string) => {
      setSelectedRoundIds((prev) => {
        const newSet = new Set(prev);
        newSet.add(roundId);
        return newSet;
      });
    },
    []
  );

  const handleDeleteSelected = useCallback(async () => {
    try {
      // Delete all selected rounds
      for (const roundId of selectedRoundIds) {
        await deleteRound(roundId);
      }
      // Clear selection and reload rounds
      setSelectedRoundIds(new Set());
      setShowDeleteDialog(false);
      await loadRounds();
    } catch (error) {
      console.error('Error deleting rounds:', error);
      setShowDeleteDialog(false);
    }
  }, [selectedRoundIds, loadRounds]);

  const handleCancelSelection = useCallback(() => {
    setSelectedRoundIds(new Set());
  }, []);

  const selectedCourse = courses.find(c => c.id === selectedCourseId);
  const theme = useTheme();

  const renderRoundItem = useCallback(
    ({ item }: { item: Round }) => {
      const totalHoles = Math.max(...item.scores.map((s) => s.holeNumber), 0);
      const isSelected = selectedRoundIds.has(item.id);

      // Calculate total score for each player
      const playerScores = item.players.map((player) => {
        const total = item.scores
          .filter((s) => s.playerId === player.id)
          .reduce((sum, s) => sum + s.throws, 0);
        return { player, total };
      });

      // Find winner (lowest score wins in golf/disc golf)
      const winnerScore = Math.min(...playerScores.map((ps) => ps.total));
      const winner = playerScores.find((ps) => ps.total === winnerScore);

      // Check if round is complete (all players have scores for all holes)
      const isComplete = item.players.every((player) => {
        for (let holeNum = 1; holeNum <= totalHoles; holeNum++) {
          const hasScore = item.scores.some(
            (s) => s.playerId === player.id && s.holeNumber === holeNum
          );
          if (!hasScore) return false;
        }
        return true;
      });

      // Format date in compact format: "Sat 11/8/25 7:50PM"
      const date = new Date(item.date);
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
      const month = date.getMonth() + 1; // 1-12
      const day = date.getDate();
      const year = date.toLocaleDateString('en-US', { year: '2-digit' });
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      const timeStr = `${displayHours}:${minutes.toString().padStart(2, '0')}${ampm}`;
      const dateStr = `${dayOfWeek} ${month}/${day}/${year} ${timeStr}`;
      
      // Get course name and number of holes
      const location = item.courseName || 'Unknown Course';
      const holesCount = totalHoles;

      return (
        <TouchableOpacity
          onPress={() => handleRoundPress(item.id)}
          onLongPress={() => handleRoundLongPress(item.id)}
          delayLongPress={500}
        >
          <Card
            style={[
              styles.roundCard,
              getShadowStyle(2),
              isSelected && styles.roundCardSelected,
            ]}
          >
            <Card.Content>
              <View style={styles.roundHeader}>
                <View style={styles.roundHeaderContent}>
                  {isSelected && (
                    <IconButton
                      icon="check-circle"
                      iconColor={theme.colors.primary}
                      size={24}
                      style={styles.checkIcon}
                    />
                  )}
                  <View style={styles.titleContainer}>
                    <Text style={styles.locationDateRow}>
                      <Text style={styles.dateTimeBold}>{dateStr}</Text>
                      <Text style={styles.locationText}> @ {location} ({holesCount} ⛳)</Text>
                      <Text style={styles.completionBadge}> {isComplete ? '✓' : '○'}</Text>
                    </Text>
                  </View>
                </View>
              </View>
              
              {/* Images */}
              {item.photos && item.photos.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.imagesContainer}
                  contentContainerStyle={styles.imagesContent}
                >
                  {item.photos.slice(0, 3).map((hash, index) => (
                    <HashedImage
                      key={hash}
                      hash={hash}
                      style={styles.roundImage}
                      contentFit="cover"
                    />
                  ))}
                  {item.photos.length > 3 && (
                    <View style={[styles.roundImage, styles.moreImagesOverlay]}>
                      <Text style={styles.moreImagesText}>+{item.photos.length - 3}</Text>
                    </View>
                  )}
                </ScrollView>
              )}

              {/* Player chips */}
              <View style={styles.playersContainer}>
                {playerScores.map(({ player, total }) => {
                  const isWinner = winner && player.id === winner.player.id;
                  return (
                    <Chip
                      key={player.id}
                      style={[
                        styles.playerChip,
                        isWinner && styles.winnerChip,
                      ]}
                      textStyle={[
                        styles.playerChipText,
                        isWinner && styles.winnerChipText,
                      ]}
                      icon={isWinner ? 'crown' : undefined}
                    >
                      {player.name}: {total}
                    </Chip>
                  );
                })}
              </View>
            </Card.Content>
          </Card>
        </TouchableOpacity>
      );
    },
    [handleRoundPress, handleRoundLongPress, selectedRoundIds, theme.colors.primary]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.headerContainer, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.outlineVariant }]}>
        <SegmentedButtons
          value="rounds"
          onValueChange={(value) => {
            if (value === 'courses') {
              router.push('/courses');
            } else if (value === 'players') {
              router.push('/players');
            }
          }}
          buttons={[
            { value: 'rounds', label: 'Rounds', icon: 'golf', style: styles.segmentedButton },
            { value: 'courses', label: 'Courses', icon: 'map-marker', style: styles.segmentedButton },
            { value: 'players', label: 'Players', icon: 'account-group', style: styles.segmentedButton },
          ]}
          style={styles.segmentedButtons}
          density="regular"
        />
      </View>
      <View style={styles.filterContainer}>
        <View style={styles.filterRow}>
          <Menu
            visible={courseMenuVisible}
            onDismiss={() => setCourseMenuVisible(false)}
            anchor={
              <Chip
                icon="filter"
                onPress={() => setCourseMenuVisible(true)}
                style={styles.filterChip}
              >
                {selectedCourse ? selectedCourse.name : 'All Courses'}
              </Chip>
            }
          >
            <Menu.Item
              onPress={() => {
                setSelectedCourseId(null);
                setCourseMenuVisible(false);
              }}
              title="All Courses"
            />
            {courses.map((course) => (
              <Menu.Item
                key={course.id}
                onPress={() => {
                  setSelectedCourseId(course.id);
                  setCourseMenuVisible(false);
                }}
                title={course.name}
              />
            ))}
          </Menu>
          <View style={styles.sortContainer}>
            <Chip
              icon={sortOrder === 'newest' ? 'arrow-down' : 'arrow-up'}
              onPress={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
              style={styles.sortChip}
            >
              {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
            </Chip>
          </View>
        </View>
      </View>

      {filteredRounds.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Paragraph style={styles.emptyText}>
            {rounds.length === 0
              ? 'No rounds saved yet. Start a new round to begin tracking!'
              : 'No rounds match your search.'}
          </Paragraph>
        </View>
      ) : (
        <FlatList
          data={filteredRounds}
          renderItem={renderRoundItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      {selectedRoundIds.size > 0 && (
        <View style={[styles.actionBar, { backgroundColor: theme.colors.surface }]}>
          <Button
            mode="text"
            onPress={handleCancelSelection}
            style={styles.actionButton}
          >
            Cancel
          </Button>
          <Paragraph style={styles.selectedCount}>
            {selectedRoundIds.size} selected
          </Paragraph>
          <Button
            mode="contained"
            buttonColor={theme.colors.error}
            onPress={() => setShowDeleteDialog(true)}
            style={styles.actionButton}
            icon="delete"
          >
            Delete
          </Button>
        </View>
      )}

      <Portal>
        <Dialog visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)}>
          <Dialog.Title>Delete Rounds</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Are you sure you want to delete {selectedRoundIds.size} round{selectedRoundIds.size !== 1 ? 's' : ''}? This action cannot be undone.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button
              mode="contained"
              buttonColor={theme.colors.error}
              onPress={handleDeleteSelected}
            >
              Delete
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
  headerContainer: {
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  segmentedButtons: {
    margin: 0,
    borderRadius: 0,
    overflow: 'hidden',
  },
  segmentedButton: {
    borderRadius: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  filterContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    flex: 1,
  },
  sortContainer: {
    flexDirection: 'row',
  },
  sortChip: {
  },
  listContent: {
    padding: 16,
  },
  roundCard: {
    marginBottom: 12,
  },
  roundHeader: {
    marginBottom: 8,
  },
  roundTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  titleContainer: {
    flex: 1,
  },
  locationDateRow: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  dateTimeBold: {
    fontWeight: 'bold',
  },
  locationText: {
    fontWeight: 'normal',
  },
  completionBadge: {
    marginLeft: 4,
  },
  imagesContainer: {
    marginBottom: 12,
  },
  imagesContent: {
    gap: 8,
  },
  roundImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  moreImagesOverlay: {
    backgroundColor: '#00000040',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreImagesText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  playersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  playerChip: {
    height: 36,
    borderRadius: 8,
  },
  winnerChip: {
    backgroundColor: '#FFD700',
  },
  playerChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  winnerChipText: {
    color: '#000',
    fontWeight: 'bold',
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
  roundCardSelected: {
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  roundHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkIcon: {
    margin: 0,
    marginRight: 8,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  actionButton: {
    marginHorizontal: 4,
  },
  selectedCount: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
});

