/**
 * Generic Table Viewer Component
 * 
 * A reusable component for displaying tabular data with sorting, filtering,
 * pagination, and column visibility. Has no knowledge of databases or SQL.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';

export interface TableViewerColumn {
  name: string;
  label?: string;
}

export interface TableViewerRow {
  id: string;
  [key: string]: any;
}

export interface TableViewerProps {
  columns: TableViewerColumn[];
  rows: TableViewerRow[];
  totalRowCount: number;
  loading?: boolean;
  error?: string | null;
  
  // Pagination
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  
  // Sorting
  sortBy: string | null;
  sortOrder: 'asc' | 'desc';
  onSort: (column: string) => void;
  
  // Filtering
  filterText: string;
  onFilterChange: (text: string) => void;
  
  // Column visibility
  visibleColumns: Set<string> | null;
  onToggleColumnVisibility: (column: string) => void;
  
  // Formatting
  formatValue?: (value: any, column: string) => string;
}

export default function TableViewer({
  columns,
  rows,
  totalRowCount,
  loading = false,
  error = null,
  page,
  pageSize,
  onPageChange,
  sortBy,
  sortOrder,
  onSort,
  filterText,
  onFilterChange,
  visibleColumns,
  onToggleColumnVisibility,
  formatValue,
}: TableViewerProps) {
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  const defaultFormatValue = useCallback((value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
  }, []);

  const formatCellValue = useCallback((value: any, column: string): string => {
    if (formatValue) {
      return formatValue(value, column);
    }
    return defaultFormatValue(value);
  }, [formatValue, defaultFormatValue]);

  const isValueNull = useCallback((value: any): boolean => {
    return value === null || value === undefined;
  }, []);

  const getVisibleColumns = useMemo(() => {
    if (!visibleColumns) return columns;
    return columns.filter(col => visibleColumns.has(col.name));
  }, [columns, visibleColumns]);

  const totalPages = Math.ceil(totalRowCount / pageSize);

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  if (loading && rows.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter input */}
      <View style={styles.filterContainer}>
        <TextInput
          style={styles.filterInput}
          value={filterText}
          onChangeText={onFilterChange}
          placeholder="Filter rows..."
          placeholderTextColor="#999"
        />
        <TouchableOpacity
          style={styles.columnMenuButton}
          onPress={() => setShowColumnMenu(true)}
        >
          <Text style={styles.columnMenuButtonText}>⚙</Text>
        </TouchableOpacity>
      </View>

      {/* Table */}
      <View style={styles.tableContainer}>
        <ScrollView horizontal style={styles.tableScroll}>
          <View>
            {/* Header */}
            <View style={styles.tableHeader}>
              {getVisibleColumns.map((col) => (
                <TouchableOpacity
                  key={col.name}
                  style={[styles.tableHeaderCell, { width: 150 }]}
                  onPress={() => onSort(col.name)}
                >
                  <View style={styles.headerCellContent}>
                    <Text style={styles.tableHeaderText} numberOfLines={1}>
                      {col.label || col.name}
                    </Text>
                    {sortBy === col.name && (
                      <Text style={styles.sortIndicator}>
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            {/* Rows */}
            <ScrollView style={styles.tableBodyScroll}>
              {rows.map((row) => (
                <View key={row.id} style={styles.tableRow}>
                  {getVisibleColumns.map((col) => {
                    const value = row[col.name];
                    const isNull = isValueNull(value);
                    return (
                      <View key={col.name} style={[styles.tableCell, { width: 150 }]}>
                        <Text
                          style={[
                            styles.tableCellText,
                            isNull && styles.nullValueText,
                          ]}
                          numberOfLines={1}
                        >
                          {isNull ? '?' : formatCellValue(value, col.name)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ))}
              {rows.length === 0 && (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyText}>No rows found</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </ScrollView>
        
        {/* Pagination */}
        <View style={styles.pagination}>
          <TouchableOpacity
            style={[styles.paginationButton, page === 1 && styles.paginationButtonDisabled]}
            onPress={() => onPageChange(page - 1)}
            disabled={page === 1}
          >
            <Text style={styles.paginationButtonText}>Previous</Text>
          </TouchableOpacity>
          <Text style={styles.paginationText}>
            Page {page} of {totalPages} ({totalRowCount.toLocaleString()} total rows)
          </Text>
          <TouchableOpacity
            style={[styles.paginationButton, page >= totalPages && styles.paginationButtonDisabled]}
            onPress={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            <Text style={styles.paginationButtonText}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Column visibility menu */}
      <Modal
        visible={showColumnMenu}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowColumnMenu(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Column Visibility</Text>
              <TouchableOpacity
                onPress={() => setShowColumnMenu(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {columns.map((col) => {
                const isVisible = !visibleColumns || visibleColumns.has(col.name);
                return (
                  <TouchableOpacity
                    key={col.name}
                    style={styles.columnMenuItem}
                    onPress={() => {
                      onToggleColumnVisibility(col.name);
                    }}
                  >
                    <Text style={styles.columnMenuCheckbox}>
                      {isVisible ? '✓' : '○'}
                    </Text>
                    <Text style={styles.columnMenuText}>{col.label || col.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  // Show all columns
                  columns.forEach(col => {
                    if (!visibleColumns || !visibleColumns.has(col.name)) {
                      onToggleColumnVisibility(col.name);
                    }
                  });
                  setShowColumnMenu(false);
                }}
              >
                <Text style={styles.modalButtonText}>Show All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fafafa',
    gap: 8,
  },
  filterInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 8,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  columnMenuButton: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnMenuButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
  tableContainer: {
    flex: 1,
  },
  tableScroll: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#667eea',
    borderBottomWidth: 2,
    borderBottomColor: '#5568d3',
  },
  tableHeaderCell: {
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: '#5568d3',
    justifyContent: 'center',
  },
  headerCellContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tableHeaderText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  sortIndicator: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tableBodyScroll: {
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tableCell: {
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: '#f0f0f0',
    justifyContent: 'center',
  },
  tableCellText: {
    fontSize: 12,
    color: '#333',
    fontFamily: 'monospace',
  },
  nullValueText: {
    color: '#bbb',
    fontStyle: 'normal',
  },
  emptyRow: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
    fontStyle: 'italic',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },
  paginationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#667eea',
    borderRadius: 4,
  },
  paginationButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.5,
  },
  paginationButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  paginationText: {
    fontSize: 14,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 24,
    color: '#666',
  },
  modalBody: {
    maxHeight: 400,
  },
  columnMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  columnMenuCheckbox: {
    fontSize: 16,
    marginRight: 12,
    color: '#667eea',
    width: 24,
  },
  columnMenuText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalButton: {
    padding: 12,
    backgroundColor: '#667eea',
    borderRadius: 4,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

