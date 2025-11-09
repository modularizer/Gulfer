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
import { getShadowStyle } from '../src/utils';
import { router } from 'expo-router';
import {
  SegmentedButtonsHeader,
  SelectionActionBar,
  DeleteConfirmationDialog,
} from '../src/components/common';

export default function PlayersScreen() {
  const [players, setPlayers] = useState<User[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [newPlayerDialog, setNewPlayerDialog] = useState({ visible: false, name: '' });
  const [errorDialog, setErrorDialog] = useState({ visible: false, title: '', message: '' });
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const loadPlayers = useCallback(async () => {
    try {
      const loadedPlayers = await getAllUsers();
      setPlayers(loadedPlayers);
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
    (playerId: string, playerName: string) => {
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
        router.push(`/player/${encodeURIComponent(playerName)}`);
      }
    },
    [selectedPlayerIds.size]
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

  const handleSaveNewPlayer = useCallback(async () => {
    if (!newPlayerDialog.name.trim()) {
      setErrorDialog({ visible: true, title: 'Error', message: 'Player name is required' });
      return;
    }

    try {
      const newUser: User = {
        id: generateUserId(),
        name: newPlayerDialog.name.trim(),
      };

      await saveUser(newUser);
      setNewPlayerDialog({ visible: false, name: '' });
      // Reload players to show the new one
      await loadPlayers();
    } catch (error) {
      console.error('Error saving player:', error);
      setErrorDialog({ visible: true, title: 'Error', message: 'Failed to save player' });
    }
  }, [newPlayerDialog, loadPlayers]);

  const theme = useTheme();

  const renderPlayerItem = useCallback(
    ({ item }: { item: User }) => {
      const isSelected = selectedPlayerIds.has(item.id);
      
      return (
        <TouchableOpacity
          onPress={() => handlePlayerPress(item.id, item.name)}
          onLongPress={() => handlePlayerLongPress(item.id)}
        >
          <Card style={[
            styles.playerCard, 
            getShadowStyle(2),
            isSelected && { backgroundColor: theme.colors.primaryContainer }
          ]}>
            <Card.Content>
              <View style={styles.playerHeader}>
                <Title style={styles.playerTitle}>{item.name}</Title>
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
    [handlePlayerPress, handlePlayerLongPress, selectedPlayerIds, theme.colors.primaryContainer]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SegmentedButtonsHeader currentValue="players" />

      {/* Add Player Button */}
      <View style={styles.addButtonContainer}>
        <Button
          mode="contained"
          icon="plus"
          onPress={() => setNewPlayerDialog({ visible: true, name: '' })}
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
      <Portal>
        <Dialog
          visible={newPlayerDialog.visible}
          onDismiss={() => setNewPlayerDialog({ visible: false, name: '' })}
        >
          <Dialog.Title>Add New Player</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Player Name"
              value={newPlayerDialog.name}
              onChangeText={(name) => setNewPlayerDialog(prev => ({ ...prev, name }))}
              mode="outlined"
              style={styles.dialogInput}
              placeholder="Enter player name"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setNewPlayerDialog({ visible: false, name: '' })}
            >
              Cancel
            </Button>
            <Button onPress={handleSaveNewPlayer} mode="contained">
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
  playerCard: {
    marginBottom: 12,
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
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

