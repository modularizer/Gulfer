import React, { useState, useEffect, useCallback } from 'react';
import { TouchableOpacity, View, Platform } from 'react-native';
import { Card, Title, useTheme, Chip, Text } from 'react-native-paper';
import { User } from '@/services/storage/userStorage';
import { getAllUsers, saveUser, generateUserId, deleteUser } from '@/services/storage/userStorage';
import { getAllRounds } from '@/services/storage/roundStorage';
import { getShadowStyle } from '@/utils';
import { router, useFocusEffect } from 'expo-router';
import { encodeNameForUrl } from '@/utils/urlEncoding';
import {
  ListPageLayout,
  NameUsernameDialog,
} from '@/components/common';
import { useSelection } from '@/hooks/useSelection';
import { useListPage } from '@/hooks/useListPage';
import { listPageStyles } from '@/styles/listPageStyles';

export default function PlayersScreen() {
  const [players, setPlayers] = useState<User[]>([]);
  const [playerRoundsCount, setPlayerRoundsCount] = useState<Map<string, number>>(new Map());
  const [playerCoursesCount, setPlayerCoursesCount] = useState<Map<string, number>>(new Map());
  const [newPlayerDialogVisible, setNewPlayerDialogVisible] = useState(false);
  
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

  // Load players on mount and when page comes into focus
  useFocusEffect(
    useCallback(() => {
      loadPlayers();
    }, [loadPlayers])
  );

  const handlePlayerPress = useCallback(
    async (playerId: string) => {
      if (selection.selectedCount > 0) {
        selection.toggleSelection(playerId);
      } else {
        const player = players.find(p => p.id === playerId);
        if (!player) return;
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
          delayLongPress={300}
          {...(Platform.OS === 'web' ? {
            onContextMenu: (e: any) => {
              e.preventDefault();
              e.stopPropagation();
              handlePlayerLongPress(item.id);
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
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Title style={listPageStyles.cardTitle}>{item.name}</Title>
                    {item.isCurrentUser && (
                      <Chip 
                        style={styles.currentUserChip} 
                        textStyle={styles.currentUserChipText}
                        compact
                      >
                        You
                      </Chip>
                    )}
                  </View>
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

    </ListPageLayout>
  );
}

const styles = {
  nameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  statsRow: {
    flexDirection: 'row' as const,
    marginTop: 4,
  },
  statText: {
    fontSize: 14,
  },
  currentUserChip: {
    height: 18,
    minHeight: 18,
    maxHeight: 18,
    paddingHorizontal: 6,
    paddingVertical: 0,
    marginLeft: 6,
    marginVertical: 0,
    alignSelf: 'center',
  },
  currentUserChipText: {
    fontSize: 10,
    lineHeight: 14,
    paddingVertical: 0,
    marginVertical: 0,
    height: 14,
  },
};
