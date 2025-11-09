import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Button, TextInput, Dialog, Portal, useTheme } from 'react-native-paper';
import { Scorecard } from '../../src/components/Scorecard';
import { Player, Score, Round } from '../../src/types';
import { saveRound, generateRoundId } from '../../src/services/storage/roundStorage';
import { router, useLocalSearchParams } from 'expo-router';

export default function ScorecardPlayScreen() {
  const params = useLocalSearchParams<{
    players?: string;
    notes?: string;
    photos?: string;
    location?: string;
  }>();

  // Parse players from URL params
  const initialPlayers: Player[] = params.players 
    ? JSON.parse(decodeURIComponent(params.players))
    : [{ id: 'player_1', name: 'You' }];

  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [holes, setHoles] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const [scores, setScores] = useState<Score[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [roundTitle, setRoundTitle] = useState('');
  const [courseName] = useState(params.location ? decodeURIComponent(params.location) : '');
  const [notes] = useState(params.notes ? decodeURIComponent(params.notes) : '');
  const [photos] = useState<string[]>(
    params.photos ? JSON.parse(decodeURIComponent(params.photos)) : []
  );
  const [playerNameDialog, setPlayerNameDialog] = useState({ visible: false, playerId: '' });
  const [newPlayerName, setNewPlayerName] = useState('');

  const currentDate = new Date();

  const handleScoreChange = useCallback((playerId: string, holeNumber: number, throws: number) => {
    setScores((prev) => {
      const existing = prev.findIndex(
        (s) => s.playerId === playerId && s.holeNumber === holeNumber
      );
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { playerId, holeNumber, throws };
        return updated;
      }
      return [...prev, { playerId, holeNumber, throws }];
    });
  }, []);

  const handleAddPlayer = useCallback(() => {
    setPlayerNameDialog({ visible: true, playerId: '' });
  }, []);

  const handleConfirmAddPlayer = useCallback(() => {
    if (newPlayerName.trim()) {
      const newPlayer: Player = {
        id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: newPlayerName.trim(),
      };
      setPlayers((prev) => [...prev, newPlayer]);
      setNewPlayerName('');
    }
    setPlayerNameDialog({ visible: false, playerId: '' });
  }, [newPlayerName]);

  const handleRemovePlayer = useCallback((playerId: string) => {
    if (players.length === 1) {
      Alert.alert('Cannot Remove', 'You must have at least one player');
      return;
    }
    setPlayers((prev) => prev.filter((p) => p.id !== playerId));
    setScores((prev) => prev.filter((s) => s.playerId !== playerId));
  }, [players.length]);

  const handleAddHole = useCallback(() => {
    const maxHole = Math.max(...holes, 0);
    setHoles((prev) => [...prev, maxHole + 1]);
  }, [holes]);

  const handleRemoveHole = useCallback((holeNumber: number) => {
    if (holes.length === 1) {
      Alert.alert('Cannot Remove', 'You must have at least one hole');
      return;
    }
    setHoles((prev) => prev.filter((h) => h !== holeNumber));
    setScores((prev) => prev.filter((s) => s.holeNumber !== holeNumber));
  }, [holes.length]);

  const handleSave = useCallback(() => {
    if (!roundTitle.trim()) {
      Alert.alert('Title Required', 'Please enter a title for this round');
      return;
    }
    setShowSaveDialog(true);
  }, [roundTitle]);

  const handleConfirmSave = useCallback(async () => {
    try {
      const round: Round = {
        id: generateRoundId(),
        title: roundTitle.trim(),
        date: currentDate.getTime(),
        players,
        scores,
        courseName: courseName.trim() || undefined,
        notes: notes.trim() || undefined,
        gameType: 'disc-golf',
        photos: photos.length > 0 ? photos : undefined,
      };

      await saveRound(round);
      setShowSaveDialog(false);
      Alert.alert('Success', 'Round saved successfully!', [
        {
          text: 'OK',
          onPress: () => router.push('/'),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to save round. Please try again.');
      console.error('Error saving round:', error);
    }
  }, [roundTitle, courseName, notes, players, scores, photos]);

  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView}>
        <Scorecard
          players={players}
          holes={holes}
          scores={scores}
          onScoreChange={handleScoreChange}
          onAddPlayer={handleAddPlayer}
          onRemovePlayer={handleRemovePlayer}
          onAddHole={handleAddHole}
          onRemoveHole={handleRemoveHole}
        />

        <View style={styles.actions}>
          <Button
            mode="outlined"
            onPress={handleAddHole}
            style={styles.actionButton}
          >
            Add Hole
          </Button>
          {holes.length > 1 && (
            <Button
              mode="outlined"
              onPress={() => handleRemoveHole(holes[holes.length - 1])}
              style={styles.actionButton}
            >
              Remove Last Hole
            </Button>
          )}
        </View>
      </ScrollView>

      <View style={[styles.saveButtonContainer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outlineVariant }]}>
        <Button
          mode="contained"
          onPress={handleSave}
          style={styles.saveButton}
          buttonColor={theme.colors.primary}
          textColor={theme.colors.onPrimary}
        >
          Save Round
        </Button>
      </View>

      {/* Save Dialog */}
      <Portal>
        <Dialog visible={showSaveDialog} onDismiss={() => setShowSaveDialog(false)}>
          <Dialog.Title>Save Round</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Round Title *"
              value={roundTitle}
              onChangeText={setRoundTitle}
              mode="outlined"
              style={styles.dialogInput}
              placeholder="e.g., Morning Round at Central Park"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowSaveDialog(false)}>Cancel</Button>
            <Button onPress={handleConfirmSave} mode="contained">
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Add Player Dialog */}
      <Portal>
        <Dialog
          visible={playerNameDialog.visible}
          onDismiss={() => setPlayerNameDialog({ visible: false, playerId: '' })}
        >
          <Dialog.Title>Add Player</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Player Name"
              value={newPlayerName}
              onChangeText={setNewPlayerName}
              mode="outlined"
              style={styles.dialogInput}
              placeholder="Enter player name"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setPlayerNameDialog({ visible: false, playerId: '' })}
            >
              Cancel
            </Button>
            <Button onPress={handleConfirmAddPlayer} mode="contained">
              Add
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
  scrollView: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
  saveButtonContainer: {
    padding: 16,
    borderTopWidth: 1,
  },
  saveButton: {
    paddingVertical: 4,
  },
  dialogInput: {
    marginBottom: 16,
  },
});

