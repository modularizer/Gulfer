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
import { importPlayer } from '../src/services/playerExport';
import { getShadowStyle } from '../src/utils';
import { router } from 'expo-router';
import { Alert, Platform } from 'react-native';
import {
  SegmentedButtonsHeader,
  SelectionActionBar,
  DeleteConfirmationDialog,
  NameUsernameDialog,
} from '../src/components/common';

export default function PlayersScreen() {
  const [players, setPlayers] = useState<User[]>([]);
  const [playerRoundsCount, setPlayerRoundsCount] = useState<Map<number, number>>(new Map());
  const [playerCoursesCount, setPlayerCoursesCount] = useState<Map<number, number>>(new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [newPlayerDialogVisible, setNewPlayerDialogVisible] = useState(false);
  const [importDialogVisible, setImportDialogVisible] = useState(false);
  const [importText, setImportText] = useState('');
  const [errorDialog, setErrorDialog] = useState({ visible: false, title: '', message: '' });
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const loadPlayers = useCallback(async () => {
    try {
      const loadedPlayers = await getAllUsers();
      setPlayers(loadedPlayers);
      
      // Count rounds and courses for each player
      const allRounds = await getAllRounds();
      const roundsCountMap = new Map<number, number>();
      const coursesCountMap = new Map<number, number>();
      
      loadedPlayers.forEach(player => {
        const playerRounds = allRounds.filter(round => {
          return round.players.some(p => p.id === player.id) && round.scores && round.scores.length > 0;
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
    async (playerId: number) => {
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
        if (!player) {
          console.error('Player not found:', playerId);
          return;
        }
        const { idToCodename } = await import('../src/utils/idUtils');
        const playerCodename = idToCodename(player.id);
        router.push(`/player/${playerCodename}`);
      }
    },
    [selectedPlayerIds.size, players]
  );

  const handlePlayerLongPress = useCallback(
    (playerId: number) => {
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
        id: await generateUserId(),
        name,
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
        <Button
          mode="outlined"
          icon="import"
          onPress={() => setImportDialogVisible(true)}
          style={styles.importButton}
        >
          Import Player
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
          keyExtractor={(item) => item.id.toString()}
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

      {/* Import Player Dialog */}
      <Portal>
        <Dialog
          visible={importDialogVisible}
          onDismiss={() => {
            setImportDialogVisible(false);
            setImportText('');
          }}
          style={styles.importDialog}
        >
          <Dialog.Title>Import Player</Dialog.Title>
          <Dialog.Content>
            <Text style={[styles.importHelpText, { color: theme.colors.onSurfaceVariant }]}>
              Paste the player export text below.
            </Text>
            <TextInput
              mode="outlined"
              value={importText}
              onChangeText={setImportText}
              multiline
              numberOfLines={20}
              style={styles.importTextInput}
              contentStyle={styles.importTextContent}
              placeholder="Paste player export text here..."
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
                  Alert.alert('Error', 'Please paste the player export text');
                  return;
                }

                try {
                  const newPlayerId = await importPlayer(importText);
                  setImportText('');
                  setImportDialogVisible(false);
                  // Refresh players list
                  await loadPlayers();
                  // Navigate to the imported player
                  const { encodeNameForUrl } = await import('../src/utils/urlEncoding');
                  const { getUserById } = await import('../src/services/storage/userStorage');
                  const importedPlayer = await getUserById(newPlayerId);
                  if (importedPlayer) {
                    router.push(`/player/${encodeNameForUrl(importedPlayer.name)}`);
                  }
                } catch (error) {
                  console.error('Error importing player:', error);
                  Alert.alert('Import Error', error instanceof Error ? error.message : 'Failed to import player');
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

