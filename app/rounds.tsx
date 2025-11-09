import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Card, Title, Paragraph, useTheme, Menu, Chip, Button, IconButton, Dialog, Portal, Text, TextInput } from 'react-native-paper';
import { Round, Course, Player, Score } from '../src/types';
import { getAllRounds, deleteRound, deleteRounds } from '../src/services/storage/roundStorage';
import { getAllCourses } from '../src/services/storage/courseStorage';
import { router } from 'expo-router';
import HashedImage from '../src/components/common/HashedImage';
import { getShadowStyle } from '../src/utils';
import {
  SegmentedButtonsHeader,
  PlayerChip,
  SelectionActionBar,
  DeleteConfirmationDialog,
} from '../src/components/common';

export default function RoundHistoryScreen() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [filteredRounds, setFilteredRounds] = useState<Round[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
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
    (roundsToFilter: Round[]) => {
      // Sort by newest first (default)
      const sorted = roundsToFilter.sort((a, b) => {
        return b.date - a.date;
      });

      setFilteredRounds(sorted);
    },
    []
  );

  useEffect(() => {
    loadRounds();
  }, []);

  useEffect(() => {
    applyFilters(rounds);
  }, [rounds, applyFilters]);

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
      // Delete all selected rounds at once (more efficient and avoids race conditions)
      const roundIdsArray = Array.from(selectedRoundIds);
      if (roundIdsArray.length === 1) {
        await deleteRound(roundIdsArray[0]);
      } else {
        await deleteRounds(roundIdsArray);
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

  const theme = useTheme();

  const renderRoundItem = useCallback(
    ({ item }: { item: Round }) => {
      const totalHoles = Math.max(...item.scores.map((s) => s.holeNumber), 0);
      
      // Calculate player scores
      const playerScores = item.players.map((player) => {
        const total = item.scores
          ? item.scores
              .filter((s) => s.playerId === player.id)
              .reduce((sum, s) => sum + s.throws, 0)
          : 0;
        return { player, total };
      });

      // Find winner (lowest score wins in golf/disc golf)
      const winnerScore = Math.min(...playerScores.map((ps) => ps.total));
      const winner = playerScores.find((ps) => ps.total === winnerScore);

      // Format date
      const date = new Date(item.date);
      const dateStr = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'numeric',
        day: 'numeric',
        year: '2-digit',
      });
      const timeStr = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      // Check if round is complete (all players have scores on all holes)
      const course = courses.find(c => c.name === item.courseName);
      const expectedHoles = course 
        ? (Array.isArray(course.holes) ? course.holes.length : (course.holes as unknown as number || 0))
        : totalHoles;
      const isComplete = item.players.every(player => {
        const playerScores = item.scores?.filter(s => s.playerId === player.id) || [];
        return playerScores.length === expectedHoles && expectedHoles > 0;
      });

      const isSelected = selectedRoundIds.has(item.id);

      return (
        <TouchableOpacity
          onPress={() => handleRoundPress(item.id)}
          onLongPress={() => handleRoundLongPress(item.id)}
        >
          <Card
            style={[
              styles.roundCard,
              getShadowStyle(2),
              isSelected && { backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <Card.Content>
              {/* Date and Location */}
              <View style={styles.roundHeader}>
                <Text style={[styles.roundDate, { color: theme.colors.onSurface }]}>
                  <Text style={styles.boldText}>
                    {dateStr} {timeStr}
                  </Text>
                  {item.courseName && (
                    <>
                      {' '}
                      <Text style={styles.normalText}>
                        @ {item.courseName} {expectedHoles > 0 && `(${expectedHoles} ⛳)`}
                      </Text>
                    </>
                  )}
                </Text>
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
                    <PlayerChip
                      key={player.id}
                      player={player}
                      score={total}
                      isWinner={isWinner}
                      onPress={() => router.push(`/${item.id}/play`)}
                    />
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
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <SegmentedButtonsHeader currentValue="rounds" />
      
      {/* Add Round Button */}
      <View style={styles.addButtonContainer}>
        <Button
          mode="contained"
          icon="plus"
          onPress={() => router.push('/add-round')}
          style={styles.addButton}
        >
          Add Round
        </Button>
      </View>

      {filteredRounds.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Paragraph style={styles.emptyText}>
            No rounds saved yet. Create a round to begin!
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

      <SelectionActionBar
        selectedCount={selectedRoundIds.size}
        onCancel={handleCancelSelection}
        onDelete={() => setShowDeleteDialog(true)}
      />

      <DeleteConfirmationDialog
        visible={showDeleteDialog}
        itemType="round"
        count={selectedRoundIds.size}
        onDismiss={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteSelected}
      />
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
  roundCard: {
    marginBottom: 12,
  },
  roundHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roundDate: {
    fontSize: 14,
    flex: 1,
  },
  boldText: {
    fontWeight: 'bold',
  },
  normalText: {
    fontWeight: 'normal',
  },
  completionBadge: {
    fontSize: 20,
    marginLeft: 8,
  },
  imagesContainer: {
    marginBottom: 8,
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreImagesText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  playersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
});

