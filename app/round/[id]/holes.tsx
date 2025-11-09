import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Button, Dialog, Portal, Text, useTheme } from 'react-native-paper';
import { Scorecard } from '../../../src/components/Scorecard';
import { Player, Score, Round } from '../../../src/types';
import { saveRound, getRoundById } from '../../../src/services/storage/roundStorage';
import { getAllCourses } from '../../../src/services/storage/courseStorage';
import { router, useLocalSearchParams } from 'expo-router';

export default function ScorecardPlayScreen() {
  const { id: roundIdParam } = useLocalSearchParams<{ id: string }>();
  const [round, setRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [holes, setHoles] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const [scores, setScores] = useState<Score[]>([]);
  const [errorDialog, setErrorDialog] = useState({ visible: false, title: '', message: '' });
  const [warningDialog, setWarningDialog] = useState({ visible: false, message: '' });
  const [courseHoles, setCourseHoles] = useState<number | undefined>(undefined);

  // Load round data
  useEffect(() => {
    const loadRound = async () => {
      if (!roundIdParam) {
        setErrorDialog({ visible: true, title: 'Error', message: 'Round ID is missing' });
        setTimeout(() => router.push('/'), 1000);
        return;
      }

      try {
        const loadedRound = await getRoundById(roundIdParam);
        if (!loadedRound) {
          setErrorDialog({ visible: true, title: 'Error', message: 'Round not found' });
          setTimeout(() => router.push('/'), 1000);
          return;
        }

        setRound(loadedRound);
        setPlayers(loadedRound.players);
        setScores(loadedRound.scores || []);

        // Load course information and initialize holes
        if (loadedRound.courseName) {
          try {
            const courses = await getAllCourses();
            const course = courses.find(c => c.name === loadedRound.courseName);
            if (course) {
              const holeCount = Array.isArray(course.holes) ? course.holes.length : (course.holes as unknown as number || 0);
              setCourseHoles(holeCount);
              const holeNumbers = Array.from({ length: holeCount }, (_, i) => i + 1);
              setHoles(holeNumbers);
            }
          } catch (error) {
            console.error('Error loading course info:', error);
          }
        } else {
          if (loadedRound.scores && loadedRound.scores.length > 0) {
            const holeNumbers = [...new Set(loadedRound.scores.map(s => s.holeNumber))].sort((a, b) => a - b);
            if (holeNumbers.length > 0) {
              setHoles(holeNumbers);
            }
          }
        }
      } catch (error) {
        console.error('Error loading round:', error);
        setErrorDialog({ visible: true, title: 'Error', message: 'Failed to load round' });
        setTimeout(() => router.push('/'), 1000);
      } finally {
        setLoading(false);
      }
    };

    if (roundIdParam) {
      loadRound();
    }
  }, [roundIdParam]);

  // Auto-save scores
  const saveRoundData = useCallback(async () => {
    if (!round) return;

    const updatedRound: Round = {
      ...round,
      players,
      scores,
    };

    await saveRound(updatedRound);
    setRound(updatedRound);
  }, [round, players, scores]);

  useEffect(() => {
    if (round && !loading) {
      const timeoutId = setTimeout(() => {
        saveRoundData();
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [scores, players, round, loading, saveRoundData]);

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

  const handleAddHole = useCallback(() => {
    const maxHole = Math.max(...holes, 0);
    setHoles((prev) => [...prev, maxHole + 1]);
  }, [holes]);

  const handleRemoveHole = useCallback((holeNumber: number) => {
    if (holes.length === 1) {
      setWarningDialog({ visible: true, message: 'You must have at least one hole' });
      return;
    }
    setHoles((prev) => prev.filter((h) => h !== holeNumber));
    setScores((prev) => prev.filter((s) => s.holeNumber !== holeNumber));
  }, [holes.length]);

  const theme = useTheme();

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!round) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Scorecard
        players={players}
        holes={holes}
        scores={scores}
        onScoreChange={handleScoreChange}
        onAddHole={handleAddHole}
        onRemoveHole={handleRemoveHole}
        onAddPlayer={() => {}}
        onRemovePlayer={() => {}}
        allowAddPlayer={false}
        courseName={round.courseName}
        onBack={() => {
          if (!round) return;
          router.push(`/round/${round.id}/overview`);
        }}
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

      {/* Warning Dialog */}
      <Portal>
        <Dialog
          visible={warningDialog.visible}
          onDismiss={() => setWarningDialog({ visible: false, message: '' })}
        >
          <Dialog.Title>Warning</Dialog.Title>
          <Dialog.Content>
            <Text>{warningDialog.message}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setWarningDialog({ visible: false, message: '' })}>
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
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

