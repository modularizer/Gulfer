import React, { useState, useEffect, useCallback } from 'react';
import { User } from '@/services/storage/userStorage';
import { getAllUsers, saveUser, generateUserId, deleteUser } from '@/services/storage/userStorage';
import { getAllRounds } from '@/services/storage/roundStorage';
import { router, useFocusEffect } from 'expo-router';
import { encodeNameForUrl } from '@/utils/urlEncoding';
import { loadPhotosByStorageKey } from '@/utils/photoStorage';
import {
  ListPageLayout,
  NameUsernameDialog,
  PlayerCard,
} from '@/components/common';
import { useSelection } from '@/hooks/useSelection';
import { useListPage } from '@/hooks/useListPage';
import { listPageStyles } from '@/styles/listPageStyles';

export default function PlayersScreen() {
  const [players, setPlayers] = useState<User[]>([]);
  const [playerRoundsCount, setPlayerRoundsCount] = useState<Map<string, number>>(new Map());
  const [playerCoursesCount, setPlayerCoursesCount] = useState<Map<string, number>>(new Map());
  const [playerWinsCount, setPlayerWinsCount] = useState<Map<string, number>>(new Map());
  const [playerTotalThrows, setPlayerTotalThrows] = useState<Map<string, number>>(new Map());
  const [playerHolesCount, setPlayerHolesCount] = useState<Map<string, number>>(new Map());
  const [photosByPlayer, setPhotosByPlayer] = useState<Map<string, string[]>>(new Map());
  const [newPlayerDialogVisible, setNewPlayerDialogVisible] = useState(false);
  
  const loadPlayers = useCallback(async () => {
    try {
      const loadedPlayers = await getAllUsers();
      setPlayers(loadedPlayers);
      
      const allRounds = await getAllRounds();
      const roundsCountMap = new Map<string, number>();
      const coursesCountMap = new Map<string, number>();
      const winsCountMap = new Map<string, number>();
      const totalThrowsMap = new Map<string, number>();
      const holesCountMap = new Map<string, number>();
      const photosMap = new Map<string, string[]>();
      
      // Load photos and stats for all players
      await Promise.all(loadedPlayers.map(async (player) => {
        // Load photos for this player
        const photos = await loadPhotosByStorageKey(player.id);
        photosMap.set(player.id, photos);
        
        const playerRounds = allRounds.filter(round => {
          return round.players.some(p => p.id === player.id) && round.scores && round.scores.length > 0;
        });
        
        roundsCountMap.set(player.id, playerRounds.length);
        
        const uniqueCourses = new Set<string>();
        let wins = 0;
        let totalThrows = 0;
        let holesPlayed = 0;
        
        playerRounds.forEach(round => {
          if (round.courseName) {
            uniqueCourses.add(round.courseName.trim());
          }
          
          // Calculate player's total throws for this round
          const playerScores = round.scores?.filter(s => s.playerId === player.id) || [];
          const playerTotal = playerScores.reduce((sum, s) => sum + s.throws, 0);
          totalThrows += playerTotal;
          holesPlayed += playerScores.length;
          
          // Check if player won this round (lowest score)
          if (round.scores && round.players && round.scores.length > 0) {
            const allPlayerTotals = round.players.map(p => {
              const scores = round.scores!.filter(s => s.playerId === p.id);
              return scores.reduce((sum, s) => sum + s.throws, 0);
            });
            const minScore = Math.min(...allPlayerTotals);
            if (playerTotal === minScore && playerTotal > 0) {
              wins++;
            }
          }
        });
        
        coursesCountMap.set(player.id, uniqueCourses.size);
        winsCountMap.set(player.id, wins);
        totalThrowsMap.set(player.id, totalThrows);
        holesCountMap.set(player.id, holesPlayed);
      }));
      
      setPlayerRoundsCount(roundsCountMap);
      setPlayerCoursesCount(coursesCountMap);
      setPlayerWinsCount(winsCountMap);
      setPlayerTotalThrows(totalThrowsMap);
      setPlayerHolesCount(holesCountMap);
      setPhotosByPlayer(photosMap);
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

  const renderPlayerItem = useCallback(
    ({ item }: { item: User }) => {
      const isSelected = selection.isSelected(item.id);
      const roundsCount = playerRoundsCount.get(item.id) || 0;
      const coursesCount = playerCoursesCount.get(item.id) || 0;
      const winsCount = playerWinsCount.get(item.id) || 0;
      const totalThrows = playerTotalThrows.get(item.id) || 0;
      const holesCount = playerHolesCount.get(item.id) || 0;
      const photos = photosByPlayer.get(item.id) || [];
      
      return (
        <PlayerCard
          player={item}
          photos={photos}
          showPhotos={true}
          isSelected={isSelected}
          roundsCount={roundsCount}
          coursesCount={coursesCount}
          winsCount={winsCount}
          totalThrows={totalThrows}
          holesCount={holesCount}
          onPress={() => handlePlayerPress(item.id)}
          onLongPress={() => handlePlayerLongPress(item.id)}
        />
      );
    },
    [handlePlayerPress, handlePlayerLongPress, selection, playerRoundsCount, playerCoursesCount, playerWinsCount, playerTotalThrows, playerHolesCount, photosByPlayer]
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
