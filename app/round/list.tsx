import React, { useState, useEffect, useCallback } from 'react';
import { TouchableOpacity } from 'react-native';
import { Round, Course } from '../src/types';
import { getAllRounds, deleteRound, deleteRounds } from '../src/services/storage/roundStorage';
import { getAllCourses } from '../src/services/storage/courseStorage';
import { router } from 'expo-router';
import {
  ListPageLayout,
  RoundCard,
} from '../src/components/common';
import { useSelection } from '../src/hooks/useSelection';
import { useListPage } from '../src/hooks/useListPage';

export default function RoundHistoryScreen() {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [filteredRounds, setFilteredRounds] = useState<Round[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

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
      if (ids.length === 1) {
        await deleteRound(ids[0]);
      } else {
        await deleteRounds(ids);
      }
      await loadRounds();
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

  useEffect(() => {
    loadRounds();
  }, []);

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
        <TouchableOpacity
          onPress={() => handleRoundPress(item.id)}
          onLongPress={() => handleRoundLongPress(item.id)}
          style={isSelected && { opacity: 0.7 }}
        >
          <RoundCard
            round={item}
            courseHoleCount={expectedHoles}
            showPhotos={true}
          />
        </TouchableOpacity>
      );
    },
    [handleRoundPress, handleRoundLongPress, selection, courses]
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
    />
  );
}

