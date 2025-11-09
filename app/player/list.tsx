import React, { useState, useEffect, useCallback } from 'react';
import { TouchableOpacity } from 'react-native';
import { Card, Title, useTheme, Chip, Text } from 'react-native-paper';
import { User } from '../src/services/storage/userStorage';
import { getAllUsers, saveUser, generateUserId, deleteUser } from '../src/services/storage/userStorage';
import { getAllRounds } from '../src/services/storage/roundStorage';
import { importPlayer } from '../src/services/playerExport';
import { getShadowStyle } from '../src/utils';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import {
  ListPageLayout,
  NameUsernameDialog,
  ImportDialog,
} from '../src/components/common';
import { useSelection } from '../src/hooks/useSelection';
import { useListPage } from '../src/hooks/useListPage';
import { listPageStyles } from '../src/styles/listPageStyles';

export default function PlayersScreen() {
  const [players, setPlayers] = useState<User[]>([]);
  const [playerRoundsCount, setPlayerRoundsCount] = useState<Map<string, number>>(new Map());
  const [playerCoursesCount, setPlayerCoursesCount] = useState<Map<string, number>>(new Map());
  const [newPlayerDialogVisible, setNewPlayerDialogVisible] = useState(false);
  const [importDialogVisible, setImportDialogVisible] = useState(false);
  const [importText, setImportText] = useState('');
  
  const loadPlayers = useCallback(async () => {
    try {
      const loadedPlayers = await getAllUsers();
      setPlayers(loadedPlayers);
      
      const allRounds = await getAllRounds();
      const roundsCountMap = new Map<string, number>();
      const coursesCountMap = new Map<string, number>();
      
      loadedPlayers.forEach(player => {
        const playerRounds = allRounds.filter(round => {
          return round.players.some(p => p.id === player.id) && round.scores && round.scores.length > 0;
        });
        
        roundsCountMap.set(player.id, playerRounds.length);
        
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

  const selection = useSelection<string>();
  const listPage = useListPage<string>({
    onDelete: async (ids) => {
      for (const id of ids) {
        await deleteUser(id);
      }
      await loadPlayers();
    },
    onRefresh: loadPlayers,
    itemType: 'player',
  });

  useEffect(() => {
    loadPlayers();
  }, []);

  const handlePlayerPress = useCallback(
    async (playerId: string) => {
      if (selection.selectedCount > 0) {
        selection.toggleSelection(playerId);
      } else {
        const player = players.find(p => p.id === playerId);
        if (!player) return;
        const { encodeNameForUrl } = await import('../src/utils/urlEncoding');
        router.push(`/player/${encodeNameForUrl(player.name)}/overview`);
      }
    },
    [selection, players]
  );

  const handlePlayerLongPress = useCallback(
    (playerId: string) => {
      selection.addToSelection(playerId);
    },
    [selection]
  );

  const handleDeleteSelected = useCallback(async () => {
    const success = await listPage.handleDeleteSelected(selection.selectedIds);
    if (success) {
      selection.clearSelection();
    }
  }, [selection, listPage]);

  const handleSaveNewPlayer = useCallback(async (name: string) => {
    try {
      const newUser: User = {
        id: await generateUserId(),
        name,
      };

      await saveUser(newUser);
      setNewPlayerDialogVisible(false);
      await loadPlayers();
    } catch (error) {
      console.error('Error saving player:', error);
      listPage.showError('Error', 'Failed to save player');
    }
  }, [loadPlayers, listPage]);

  const handleImport = useCallback(async () => {
    if (!importText.trim()) {
      Alert.alert('Error', 'Please paste the player export text');
      return;
    }

    try {
      const newPlayerId = await importPlayer(importText);
      setImportText('');
      setImportDialogVisible(false);
      await loadPlayers();
      const { encodeNameForUrl } = await import('../src/utils/urlEncoding');
      const { getUserById } = await import('../src/services/storage/userStorage');
      const importedPlayer = await getUserById(newPlayerId);
      if (importedPlayer) {
                    router.push(`/player/${encodeNameForUrl(importedPlayer.name)}/overview`);
      }
    } catch (error) {
      console.error('Error importing player:', error);
      Alert.alert('Import Error', error instanceof Error ? error.message : 'Failed to import player');
    }
  }, [importText, loadPlayers]);

  const theme = useTheme();

  const renderPlayerItem = useCallback(
    ({ item }: { item: User }) => {
      const isSelected = selection.isSelected(item.id);
      const roundsCount = playerRoundsCount.get(item.id) || 0;
      const coursesCount = playerCoursesCount.get(item.id) || 0;
      
      return (
        <TouchableOpacity
          onPress={() => handlePlayerPress(item.id)}
          onLongPress={() => handlePlayerLongPress(item.id)}
        >
          <Card style={[
            listPageStyles.card, 
            getShadowStyle(2),
            isSelected && { backgroundColor: theme.colors.primaryContainer }
          ]}>
            <Card.Content>
              <View style={listPageStyles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Title style={listPageStyles.cardTitle}>{item.name}</Title>
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
    [handlePlayerPress, handlePlayerLongPress, selection, playerRoundsCount, playerCoursesCount, theme.colors.primaryContainer, theme.colors.onSurfaceVariant]
  );

  return (
    <ListPageLayout
      currentValue="players"
      addLabel="Add Player"
      onAdd={() => router.push('/player/add')}
      importLabel="Import Player"
      onImport={() => setImportDialogVisible(true)}
      items={players}
      renderItem={renderPlayerItem}
      keyExtractor={(item) => item.id.toString()}
      emptyMessage="No players saved yet. Players will be added as you create rounds."
      selectedCount={selection.selectedCount}
      onClearSelection={selection.clearSelection}
      onDelete={() => listPage.setShowDeleteDialog(true)}
      showDeleteDialog={listPage.showDeleteDialog}
      onDismissDeleteDialog={() => listPage.setShowDeleteDialog(false)}
      onConfirmDelete={handleDeleteSelected}
      itemType="player"
      refreshing={listPage.refreshing}
      onRefresh={listPage.handleRefresh}
      errorDialog={listPage.errorDialog}
      onDismissError={listPage.hideError}
    >
      <NameUsernameDialog
        visible={newPlayerDialogVisible}
        title="Add New Player"
        nameLabel="Player Name"
        onDismiss={() => setNewPlayerDialogVisible(false)}
        onSave={handleSaveNewPlayer}
      />

      <ImportDialog
        visible={importDialogVisible}
        title="Import Player"
        helpText="Paste the player export text below."
        importText={importText}
        onImportTextChange={setImportText}
        onDismiss={() => {
          setImportDialogVisible(false);
          setImportText('');
        }}
        onImport={handleImport}
      />
    </ListPageLayout>
  );
}

const styles = {
  statsRow: {
    flexDirection: 'row' as const,
    marginTop: 4,
  },
  statText: {
    fontSize: 14,
  },
  currentUserChip: {
    height: 28,
  },
};
