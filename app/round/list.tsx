import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getAllRounds, deleteRound, deleteRounds } from '@/services/storage/roundStorage';
import { getAllCourses } from '@/services/storage/courseStorage';
import { router, useFocusEffect } from 'expo-router';
import {
  ListPageLayout,
  RoundCard,
  CardMode,
} from '@/components/common';
import { useSelection } from '@/hooks/useSelection';
import { useListPage } from '@/hooks/useListPage';
import { getCachedCardMode, loadCardMode, saveCardMode } from '@/services/storage/cardModeStorage';

export default function RoundHistoryScreen() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [filteredRounds, setFilteredRounds] = useState<Round[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [cardMode, setCardMode] = useState<CardMode>(() => getCachedCardMode('rounds'));
  const roundsRef = useRef<Round[]>([]);
  
  // Keep ref in sync with state
  useEffect(() => {
    roundsRef.current = rounds;
  }, [rounds]);

  useEffect(() => {
    let isMounted = true;
    loadCardMode('rounds').then((storedMode) => {
      if (isMounted) {
        setCardMode((prev) => (prev === storedMode ? prev : storedMode));
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCardModeChange = useCallback((mode: CardMode) => {
    setCardMode((prev) => {
      if (prev === mode) {
        return prev;
      }
      saveCardMode('rounds', mode).catch((error) => {
        console.error('Error saving round card mode:', error);
      });
      return mode;
    });
  }, []);

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

  const selection = useSelection<string>();
  const listPage = useListPage<string>({
    onDelete: async (ids) => {
      // Store original state in case we need to rollback (use ref to get current value)
      const originalRounds = [...roundsRef.current];
      
      try {
        // Update local state first to provide immediate UI feedback (optimistic update)
        setRounds((prevRounds) => {
          const filtered = prevRounds.filter((r) => !ids.includes(r.id));
          return filtered;
        });
        
        // Delete from storage
        if (ids.length === 1) {
          await deleteRound(ids[0]);
        } else {
          await deleteRounds(ids);
        }
        
        // Don't reload immediately - trust the optimistic update
        // This avoids race conditions with IndexedDB timing
        // The state is already correct from the optimistic update
      } catch (error) {
        console.error('Error deleting rounds:', error);
        // On error, rollback to original state
        setRounds(originalRounds);
        throw error; // Re-throw so useListPage can handle the error
      }
    },
    onRefresh: loadRounds,
    itemType: 'round',
  });

  const applyFilters = useCallback(
    (roundsToFilter: Round[]) => {
      const sorted = roundsToFilter.sort((a, b) => b.date - a.date);
      setFilteredRounds(sorted);
    },
    []
  );

  // Load rounds on mount and when page comes into focus
  useFocusEffect(
    useCallback(() => {
      loadRounds();
    }, [loadRounds])
  );

  useEffect(() => {
    applyFilters(rounds);
  }, [rounds, applyFilters]);

  const handleRoundPress = useCallback(
    async (roundId: string) => {
      if (selection.selectedCount > 0) {
        selection.toggleSelection(roundId);
      } else {
        router.push(`/round/${roundId}/overview`);
      }
    },
    [selection]
  );

  const handleRoundLongPress = useCallback(
    (roundId: string) => {
      selection.addToSelection(roundId);
    },
    [selection]
  );

  const handleDeleteSelected = useCallback(async () => {
    const success = await listPage.handleDeleteSelected(selection.selectedIds);
    if (success) {
      selection.clearSelection();
    }
  }, [selection, listPage]);

  const renderRoundItem = useCallback(
    ({ item }: { item: Round }) => {
      const course = courses.find(c => c.name === item.courseName);
      const expectedHoles = course 
        ? (Array.isArray(course.holes) ? course.holes.length : (course.holes as unknown as number || 0))
        : 0;
      const isSelected = selection.isSelected(item.id);

      return (
        <RoundCard
          round={item}
          courseHoleCount={expectedHoles}
          showPhotos={cardMode !== 'list' && cardMode !== 'small'}
          mode={cardMode}
          isSelected={isSelected}
          onPress={() => handleRoundPress(item.id)}
          onLongPress={() => handleRoundLongPress(item.id)}
        />
      );
    },
    [handleRoundPress, handleRoundLongPress, selection, courses, cardMode]
  );

  return (
    <ListPageLayout
      currentValue="rounds"
      addLabel="Add Round"
      onAdd={() => router.push('/round/add')}
      items={filteredRounds}
      renderItem={renderRoundItem}
      keyExtractor={(item) => item.id.toString()}
      emptyMessage="No rounds saved yet. Create a round to begin!"
      selectedCount={selection.selectedCount}
      onClearSelection={selection.clearSelection}
      onDelete={() => listPage.setShowDeleteDialog(true)}
      showDeleteDialog={listPage.showDeleteDialog}
      onDismissDeleteDialog={() => listPage.setShowDeleteDialog(false)}
      onConfirmDelete={handleDeleteSelected}
      itemType="round"
      refreshing={listPage.refreshing}
      onRefresh={listPage.handleRefresh}
      errorDialog={listPage.errorDialog}
      onDismissError={listPage.hideError}
      cardMode={cardMode}
      onCardModeChange={handleCardModeChange}
    />
  );
}

