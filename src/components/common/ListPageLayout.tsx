import React, { ReactNode } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useTheme } from 'react-native-paper';
import SegmentedButtonsHeader from './SegmentedButtonsHeader';
import AddImportButtons from './AddImportButtons';
import EmptyState from './EmptyState';
import SelectionActionBar from './SelectionActionBar';
import DeleteConfirmationDialog from './DeleteConfirmationDialog';
import ErrorDialog from './ErrorDialog';
import { CardMode } from './CardModeToggle';

interface ListPageLayoutProps<T> {
  currentValue: 'rounds' | 'courses' | 'players';
  addLabel: string;
  onAdd: () => void;
  importLabel?: string;
  onImport?: () => void;
  items: T[];
  renderItem: ({ item }: { item: T }) => ReactNode;
  keyExtractor: (item: T) => string;
  emptyMessage: string;
  selectedCount: number;
  onClearSelection: () => void;
  onDelete: () => void;
  showDeleteDialog: boolean;
  onDismissDeleteDialog: () => void;
  onConfirmDelete: () => void;
  itemType: string;
  refreshing: boolean;
  onRefresh: () => void;
  errorDialog: {
    visible: boolean;
    title: string;
    message: string;
  };
  onDismissError: () => void;
  cardMode?: CardMode;
  onCardModeChange?: (mode: CardMode) => void;
  children?: ReactNode; // For additional dialogs/components
}

export default function ListPageLayout<T>({
  currentValue,
  addLabel,
  onAdd,
  importLabel,
  onImport,
  items,
  renderItem,
  keyExtractor,
  emptyMessage,
  selectedCount,
  onClearSelection,
  onDelete,
  showDeleteDialog,
  onDismissDeleteDialog,
  onConfirmDelete,
  itemType,
  refreshing,
  onRefresh,
  errorDialog,
  onDismissError,
  cardMode,
  onCardModeChange,
  children,
}: ListPageLayoutProps<T>) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SegmentedButtonsHeader currentValue={currentValue} />
      
      <AddImportButtons
        addLabel={addLabel}
        onAdd={onAdd}
        importLabel={importLabel}
        onImport={onImport}
        cardMode={cardMode}
        onCardModeChange={onCardModeChange}
      />

      {items.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      <SelectionActionBar
        selectedCount={selectedCount}
        onCancel={onClearSelection}
        onDelete={onDelete}
      />

      <DeleteConfirmationDialog
        visible={showDeleteDialog}
        itemType={itemType}
        count={selectedCount}
        onDismiss={onDismissDeleteDialog}
        onConfirm={onConfirmDelete}
      />

      <ErrorDialog
        visible={errorDialog.visible}
        title={errorDialog.title}
        message={errorDialog.message}
        onDismiss={onDismissError}
      />

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
});

