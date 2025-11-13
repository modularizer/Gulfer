import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Button, Dialog, Portal, Text, useTheme } from 'react-native-paper';
import { Scorecard } from '@/components/Scorecard';
import { Score } from '@/services/storage/roundStorage';
import { saveRound, getRoundById } from '@/services/storage/roundStorage';
import { getAllCourses } from '@/services/storage/courseStorage';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import CornerStatisticsSettingsDialog from '@/components/common/CornerStatisticsSettingsDialog';
import { CornerStatisticsConfig } from '@/services/cornerStatistics';
import { getCornerConfig, saveCornerConfig, getColumnVisibility, saveColumnVisibility, ColumnVisibilityConfig } from '@/services/storage/cornerConfigStorage';
import { getCurrentUserName } from '@/services/storage/userStorage';
import { useAppFocusState } from '@/hooks';
import { useScorecard } from '@/contexts/ScorecardContext';

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
  const [courseId, setCourseId] = useState<string | undefined>(undefined);
  const [settingsDialogVisible, setSettingsDialogVisible] = useState(false);
  const [cornerConfig, setCornerConfig] = useState<CornerStatisticsConfig | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityConfig | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const [autoOpenNextHole, setAutoOpenNextHole] = useState(false);

  // Track if initial load is complete - don't save during initial load or reload
  const initialLoadCompleteRef = useRef(false);
  // Track if we've already attempted to auto-open on this focus
  const hasAutoOpenedRef = useRef(false);

  // Track if app was focused within last 5 seconds
  const isRecentlyFocused = useAppFocusState(5000);
  const { hasNextHole } = useScorecard();

  // Check if we should auto-open the next hole modal when navigating to this page
  useFocusEffect(
    useCallback(() => {
      // Reset the auto-open flag when screen comes into focus
      hasAutoOpenedRef.current = false;

      // Only proceed if:
      // 1. Round is loaded
      // 2. App was recently focused (within last 5 seconds)
      // 3. There's actually a next hole (hasNextHole from Scorecard context)
      // 4. Players and holes are available
      if (!round || !isRecentlyFocused || !hasNextHole || players.length === 0 || holes.length === 0) {
        return;
      }

      // Only auto-open once per focus
      if (hasAutoOpenedRef.current) {
        return;
      }

      // There's a next hole - auto-open the modal
      hasAutoOpenedRef.current = true;
      setAutoOpenNextHole(true);
      // Reset after a short delay to prevent re-opening
      const timeout = setTimeout(() => {
        setAutoOpenNextHole(false);
      }, 500);
      return () => clearTimeout(timeout);
    }, [round, isRecentlyFocused, hasNextHole, players, holes])
  );

  // Load corner config, column visibility, and current user ID
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const [config, visibility] = await Promise.all([
          getCornerConfig(),
          getColumnVisibility(),
        ]);
        setCornerConfig(config);
        setColumnVisibility(visibility);
        
        // Resolve current user ID
        const userName = await getCurrentUserName();
        if (userName && players.length > 0) {
          const userPlayer = players.find(p => p.name === userName);
          if (userPlayer) {
            setCurrentUserId(userPlayer.id);
          } else if (players.length > 0) {
            setCurrentUserId(players[0].id);
          }
        } else if (players.length > 0) {
          setCurrentUserId(players[0].id);
        }
      } catch (error) {
        console.error('Error loading config:', error);
      }
    };
    if (players.length > 0) {
      loadConfig();
    }
  }, [players]);

  // Load round data - reload on mount and whenever page comes into focus
  const loadRound = useCallback(async () => {
    if (!roundIdParam) {
      setErrorDialog({ visible: true, title: 'Error', message: 'Round ID is missing' });
      setTimeout(() => router.push('/'), 1000);
      return;
    }

    // Reset initial load flag when reloading - don't save during reload
    initialLoadCompleteRef.current = false;
    setLoading(true);
    try {
      const loadedRound = await getRoundById(roundIdParam);
      if (!loadedRound) {
        // Round was deleted (likely auto-deleted), navigate away silently
        router.replace('/round/list');
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
            setCourseId(course.id);
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
  }, [roundIdParam]);

  // Load on mount
  useEffect(() => {
    if (roundIdParam) {
      loadRound();
    }
  }, [roundIdParam, loadRound]);

  // Reload whenever page comes into focus to get latest data
  useFocusEffect(
    useCallback(() => {
      if (roundIdParam) {
        loadRound();
      }
    }, [roundIdParam, loadRound])
  );

  // Auto-save scores
  const saveRoundData = useCallback(async () => {
    if (!round) {
      console.log('[SAVE] Round holes: No round, skipping save');
      return;
    }

    console.log('[SAVE] Round holes: Starting save for round', round.id);

    // Verify the round still exists in storage before saving
    // This prevents auto-save from restoring deleted rounds
    const existingRound = await getRoundById(round.id);
    if (!existingRound) {
      // Round was deleted, don't save it back - silently skip
      console.log('[SAVE] Round holes: Round was deleted, skipping save');
      return;
    }

    const updatedRound: Round = {
      ...round,
      players,
      scores,
    };

    console.log('[SAVE] Round holes: Saving round', round.id, {
      players: updatedRound.players.length,
      scores: updatedRound.scores?.length || 0
    });

    try {
      await saveRound(updatedRound);
      console.log('[SAVE] Round holes: Successfully saved round', round.id);
      // Don't update round state here - it causes infinite loop
      // State will be updated when data actually changes
    } catch (error) {
      console.error('[SAVE] Round holes: Failed to save round', round.id, error);
      throw error;
    }
  }, [round, players, scores]);

  // Track if we're currently saving to prevent concurrent saves
  const isSavingRef = useRef(false);
  // Store save function in ref to avoid dependency issues
  const saveRoundDataRef = useRef(saveRoundData);
  
  // Update ref when save function changes
  useEffect(() => {
    saveRoundDataRef.current = saveRoundData;
  }, [saveRoundData]);

  // Mark initial load as complete after first load
  useEffect(() => {
    if (round && !loading) {
      // Use a small delay to ensure all state updates from load are complete
      const timeoutId = setTimeout(() => {
        initialLoadCompleteRef.current = true;
      }, 100);
      return () => clearTimeout(timeoutId);
    } else {
      initialLoadCompleteRef.current = false;
    }
  }, [round, loading]);

  // Auto-save when data changes - save immediately
  // Note: Use ref for save function to avoid infinite loop from saveRoundData changing
  // Only save if initial load is complete (user has actually changed data)
  // round is NOT in dependencies - we only check it exists, we don't react to its changes
  useEffect(() => {
    if (round && !loading && !isSavingRef.current && initialLoadCompleteRef.current) {
      isSavingRef.current = true;
      console.log('[SAVE] Round holes: Data changed, triggering save');
      saveRoundDataRef.current()
        .catch((error) => {
          console.error('[SAVE] Round holes: Error in auto-save', error);
        })
        .finally(() => {
          isSavingRef.current = false;
        });
    }
  }, [scores, players, loading]);

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

  const handleSaveCornerConfig = useCallback(async (config: CornerStatisticsConfig) => {
    try {
      await saveCornerConfig(config);
      setCornerConfig(config);
    } catch (error) {
      console.error('Error saving corner config:', error);
      setErrorDialog({ visible: true, title: 'Error', message: 'Failed to save settings' });
    }
  }, []);

  const handleSaveColumnVisibility = useCallback(async (visibility: ColumnVisibilityConfig) => {
    try {
      await saveColumnVisibility(visibility);
      setColumnVisibility(visibility);
    } catch (error) {
      console.error('Error saving column visibility:', error);
      setErrorDialog({ visible: true, title: 'Error', message: 'Failed to save settings' });
    }
  }, []);

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
        courseId={courseId}
        onBack={() => {
          if (!round) return;
          router.push(`/round/${round.id}/overview`);
        }}
        cornerStatisticsConfig={cornerConfig || undefined}
        currentUserId={currentUserId}
        onSettingsPress={() => setSettingsDialogVisible(true)}
        columnVisibility={columnVisibility || undefined}
        currentRoundDate={round.date}  // Exclude rounds that started at the same time or after
        autoOpenNextHole={autoOpenNextHole}
        onScrollToTop={() => {
          if (!round) return;
          router.push(`/round/${round.id}/overview`);
        }}
      />

      {/* Corner Statistics Settings Dialog */}
      <CornerStatisticsSettingsDialog
        visible={settingsDialogVisible}
        onDismiss={() => setSettingsDialogVisible(false)}
        onSave={handleSaveCornerConfig}
        onColumnVisibilitySave={handleSaveColumnVisibility}
        initialConfig={cornerConfig}
        initialColumnVisibility={columnVisibility}
        courseName={round.courseName}
        currentRoundPlayers={players}
        currentRoundDate={round.date}
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

