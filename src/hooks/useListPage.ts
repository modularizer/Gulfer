/**
 * Hook for managing common list page state and operations
 * Handles refreshing, selection, deletion, and error dialogs
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';

interface UseListPageOptions<T extends string | number> {
  onDelete: (ids: T[]) => Promise<void>;
  onRefresh: () => Promise<void>;
  itemType: string;
}

export function useListPage<T extends string | number>({
  onDelete,
  onRefresh,
  itemType,
}: UseListPageOptions<T>) {
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [errorDialog, setErrorDialog] = useState({ visible: false, title: '', message: '' });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error(`Error refreshing ${itemType}s:`, error);
      setErrorDialog({
        visible: true,
        title: 'Error',
        message: `Failed to refresh ${itemType}s`,
      });
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, itemType]);

  const handleDeleteSelected = useCallback(
    async (selectedIds: Set<T>) => {
      try {
        const idsArray = Array.from(selectedIds);
        await onDelete(idsArray);
        setShowDeleteDialog(false);
        return true;
      } catch (error) {
        console.error(`Error deleting ${itemType}s:`, error);
        setErrorDialog({
          visible: true,
          title: 'Error',
          message: `Failed to delete ${itemType}s`,
        });
        setShowDeleteDialog(false);
        return false;
      }
    },
    [onDelete, itemType]
  );

  const showError = useCallback((title: string, message: string) => {
    setErrorDialog({ visible: true, title, message });
  }, []);

  const hideError = useCallback(() => {
    setErrorDialog({ visible: false, title: '', message: '' });
  }, []);

  return {
    refreshing,
    showDeleteDialog,
    setShowDeleteDialog,
    errorDialog,
    showError,
    hideError,
    handleRefresh,
    handleDeleteSelected,
  };
}

