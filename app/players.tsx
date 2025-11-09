import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Card, Title, Paragraph, useTheme, Chip, Button, Dialog, Portal, TextInput, Text } from 'react-native-paper';
import { User } from '../src/services/storage/userStorage';
import { getAllUsers, saveUser, generateUserId, deleteUser } from '../src/services/storage/userStorage';
import { getAllRounds } from '../src/services/storage/roundStorage';
import { getShadowStyle } from '../src/utils';
import { router } from 'expo-router';
import {
  SegmentedButtonsHeader,
  SelectionActionBar,
  DeleteConfirmationDialog,
  NameUsernameDialog,
} from '../src/components/common';

export default function PlayersScreen() {
  const [players, setPlayers] = useState<User[]>([]);
  const [playerRoundsCount, setPlayerRoundsCount] = useState<Map<string, number>>(new Map());
  const [playerCoursesCount, setPlayerCoursesCount] = useState<Map<string, number>>(new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [newPlayerDialogVisible, setNewPlayerDialogVisible] = useState(false);
  const [errorDialog, setErrorDialog] = useState({ visible: false, title: '', message: '' });
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const loadPlayers = useCallback(async () => {
    try {
      const loadedPlayers = await getAllUsers();
      setPlayers(loadedPlayers);
      
      // Count rounds and courses for each player
      const allRounds = await getAllRounds();
      const roundsCountMap = new Map<string, number>();
      const coursesCountMap = new Map<string, number>();
      
      loadedPlayers.forEach(player => {
        const playerRounds = allRounds.filter(round => {
          return round.players.some(p => p.username === player.username) && 
                 round.scores && round.scores.length > 0;
        });
        
        roundsCountMap.set(player.id, playerRounds.length);
        
        // Count unique courses
        const uniqueCourses = new Set<string>();
        playerRounds.forEach(round => {
          if (round.courseName) {
            uniqueCourses.add(round.courseName.trim());
          }
        });
        coursesCountMap.set(player.id, uniqueCourses.size);
      });
      
      setPlayerRoundsCount(roundsCountMap);
      setPlayerCoursesCount(coursesCountMap);
    } catch (error) {
      console.error('Error loading players:', error);
    }
  }, []);

  useEffect(() => {
    loadPlayers();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPlayers();
    setRefreshing(false);
  }, [loadPlayers]);

  const handlePlayerPress = useCallback(
    (playerId: string) => {
      // If in selection mode, toggle selection instead of navigating
      if (selectedPlayerIds.size > 0) {
        setSelectedPlayerIds((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(playerId)) {
            newSet.delete(playerId);
          } else {
            newSet.add(playerId);
          }
          return newSet;
        });
      } else {
        const player = players.find(p => p.id === playerId);
        if (!player || !player.username) {
          console.error('Player missing username:', player);
          return;
        }
        router.push(`/player/${encodeURIComponent(player.username)}`);
      }
    },
    [selectedPlayerIds.size, players]
  );

  const handlePlayerLongPress = useCallback(
    (playerId: string) => {
      setSelectedPlayerIds((prev) => {
        const newSet = new Set(prev);
        newSet.add(playerId);
        return newSet;
      });
    },
    []
  );

  const handleDeleteSelected = useCallback(async () => {
    try {
      // Delete all selected players
      for (const playerId of selectedPlayerIds) {
        await deleteUser(playerId);
      }
      // Clear selection and reload players
      setSelectedPlayerIds(new Set());
      setShowDeleteDialog(false);
      await loadPlayers();
    } catch (error) {
      console.error('Error deleting players:', error);
      setShowDeleteDialog(false);
    }
  }, [selectedPlayerIds, loadPlayers]);

  const handleCancelSelection = useCallback(() => {
    setSelectedPlayerIds(new Set());
  }, []);

  const handleSaveNewPlayer = useCallback(async (name: string, username: string) => {
    try {
      const newUser: User = {
        id: generateUserId(),
        name,
        username,
      };

      await saveUser(newUser);
      setNewPlayerDialogVisible(false);
      // Reload players to show the new one
      await loadPlayers();
    } catch (error) {
      console.error('Error saving player:', error);
      setErrorDialog({ visible: true, title: 'Error', message: 'Failed to save player' });
    }
  }, [loadPlayers]);

  const theme = useTheme();

  const renderPlayerItem = useCallback(
    ({ item }: { item: User }) => {
      const isSelected = selectedPlayerIds.has(item.id);
      const roundsCount = playerRoundsCount.get(item.id) || 0;
      const coursesCount = playerCoursesCount.get(item.id) || 0;
      
      return (
        <TouchableOpacity
          onPress={() => handlePlayerPress(item.id)}
          onLongPress={() => handlePlayerLongPress(item.id)}
        >
          <Card style={[
            styles.playerCard, 
            getShadowStyle(2),
            isSelected && { backgroundColor: theme.colors.primaryContainer }
          ]}>
            <Card.Content>
              <View style={styles.playerHeader}>
                <View style={styles.playerInfo}>
                  <Title style={styles.playerTitle}>{item.name}</Title>
                  {(roundsCount > 0 || coursesCount > 0) && (
                    <View style={styles.statsRow}>
                      {roundsCount > 0 && (
                        <Text style={[styles.statText, { color: theme.colors.onSurfaceVariant }]}>
                          {roundsCount} {roundsCount === 1 ? 'round' : 'rounds'}
                        </Text>
                      )}
                      {roundsCount > 0 && coursesCount > 0 && (
                        <Text style={[styles.statText, { color: theme.colors.onSurfaceVariant }]}>
                          {' • '}
                        </Text>
                      )}
                      {coursesCount > 0 && (
                        <Text style={[styles.statText, { color: theme.colors.onSurfaceVariant }]}>
                          {coursesCount} {coursesCount === 1 ? 'course' : 'courses'}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
                {item.isCurrentUser && (
                  <Chip style={styles.currentUserChip} icon="account">
                    You
                  </Chip>
                )}
              </View>
            </Card.Content>
          </Card>
        </TouchableOpacity>
      );
    },
    [handlePlayerPress, handlePlayerLongPress, selectedPlayerIds, playerRoundsCount, playerCoursesCount, theme.colors.primaryContainer, theme.colors.onSurfaceVariant]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SegmentedButtonsHeader currentValue="players" />

      {/* Add Player Button */}
      <View style={styles.addButtonContainer}>
        <Button
          mode="contained"
          icon="plus"
          onPress={() => setNewPlayerDialogVisible(true)}
          style={styles.addButton}
        >
          Add Player
        </Button>
      </View>
      {players.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Paragraph style={styles.emptyText}>
            No players saved yet. Players will be added as you create rounds.
          </Paragraph>
        </View>
      ) : (
        <FlatList
          data={players}
          renderItem={renderPlayerItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      <SelectionActionBar
        selectedCount={selectedPlayerIds.size}
        onCancel={handleCancelSelection}
        onDelete={() => setShowDeleteDialog(true)}
      />

      <DeleteConfirmationDialog
        visible={showDeleteDialog}
        itemType="player"
        count={selectedPlayerIds.size}
        onDismiss={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteSelected}
      />

      {/* Add New Player Dialog */}
      <NameUsernameDialog
        visible={newPlayerDialogVisible}
        title="Add New Player"
        nameLabel="Player Name"
        onDismiss={() => setNewPlayerDialogVisible(false)}
        onSave={handleSaveNewPlayer}
      />

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
  playerCard: {
    marginBottom: 12,
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerInfo: {
    flex: 1,
  },
  playerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  statText: {
    fontSize: 14,
  },
  currentUserChip: {
    height: 28,
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

