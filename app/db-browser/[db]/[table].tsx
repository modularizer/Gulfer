/**
 * Database Browser - Table View Page
 * 
 * Displays table data with sorting, filtering, pagination, and column visibility.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getAdapterByType } from '../../../storage/adapters';

// Memoized table item component to prevent unnecessary re-renders
const TableItem = React.memo(({ 
  table, 
  rowCount, 
  isEmpty, 
  isSelected, 
  onPress 
}: { 
  table: string; 
  rowCount: number | undefined; 
  isEmpty: boolean; 
  isSelected: boolean; 
  onPress: (table: string) => void;
}) => (
  <TouchableOpacity
    style={[
      styles.tableItem,
      isEmpty && styles.tableItemEmpty,
      isSelected && styles.tableItemSelected,
    ]}
    onPress={() => onPress(table)}
  >
    <View style={styles.tableItemContent}>
      <Text
        style={[
          styles.tableItemText,
          isEmpty && styles.tableItemTextEmpty,
          isSelected && styles.tableItemTextSelected,
        ]}
      >
        {table}
      </Text>
      {rowCount !== undefined && (
        <Text
          style={[
            styles.tableItemCount,
            isEmpty && styles.tableItemCountEmpty,
            isSelected && styles.tableItemCountSelected,
          ]}
        >
          {rowCount.toLocaleString()}
        </Text>
      )}
    </View>
  </TouchableOpacity>
), (prevProps, nextProps) => {
  // Only re-render if selection state changes or row count changes
  return prevProps.isSelected === nextProps.isSelected && 
         prevProps.rowCount === nextProps.rowCount &&
         prevProps.isEmpty === nextProps.isEmpty;
});

export default function TableView() {
  const router = useRouter();
  const { db, table } = useLocalSearchParams<{ db: string; table: string }>();
  const searchParams = useLocalSearchParams<{
    page?: string;
    pageSize?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    filter?: string;
    visibleColumns?: string;
  }>();
  
  const dbName = db ? decodeURIComponent(db) : null;
  const initialTableName = table ? decodeURIComponent(table) : null;
  
  // Use local state for current table to avoid re-renders on URL changes
  const [currentTableName, setCurrentTableName] = useState<string | null>(initialTableName);
  const isInternalNavigationRef = useRef(false);
  const currentTableNameRef = useRef<string | null>(initialTableName);
  
  // Keep ref in sync with state
  useEffect(() => {
    currentTableNameRef.current = currentTableName;
  }, [currentTableName]);
  
  // Sync with URL params only on initial load or when db changes (not on internal table switches)
  useEffect(() => {
    if (isInternalNavigationRef.current) {
      isInternalNavigationRef.current = false;
      return; // Skip sync during internal navigation
    }
    if (initialTableName && initialTableName !== currentTableName) {
      setCurrentTableName(initialTableName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTableName, dbName]); // Sync when URL changes externally or db changes
  
  const tableName = currentTableName;
  
  // Extract stable values from searchParams to avoid recreating callbacks
  const page = useMemo(() => parseInt(searchParams.page || '1', 10), [searchParams.page]);
  const pageSize = useMemo(() => parseInt(searchParams.pageSize || '50', 10), [searchParams.pageSize]);
  const sortBy = useMemo(() => searchParams.sortBy || null, [searchParams.sortBy]);
  const sortOrder = useMemo(() => (searchParams.sortOrder as 'asc' | 'desc') || 'asc', [searchParams.sortOrder]);
  const filterParam = useMemo(() => searchParams.filter || '', [searchParams.filter]);
  const visibleColumnsParam = useMemo(() => searchParams.visibleColumns || '', [searchParams.visibleColumns]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tableData, setTableData] = useState<{
    columns: string[];
    rows: any[];
    rowCount: number;
  } | null>(null);
  const [dbInstance, setDbInstance] = useState<any>(null);
  
  // Cache table data to avoid reloading
  const [tableDataCache, setTableDataCache] = useState<Record<string, {
    columns: string[];
    rows: any[];
    rowCount: number;
    timestamp: number;
  }>>({});
  
  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tables, setTables] = useState<string[]>([]);
  const [tableRowCounts, setTableRowCounts] = useState<Record<string, number>>({});
  const loadingTableListRef = useRef(false);
  
  // Filter state
  const [filterText, setFilterText] = useState(filterParam);
  
  // Column visibility state
  const visibleColumns = useMemo(() => {
    if (visibleColumnsParam) {
      return new Set(visibleColumnsParam.split(','));
    }
    return null; // null means all columns visible
  }, [visibleColumnsParam]);
  
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  
  // Sync filterText with URL param when it changes externally
  useEffect(() => {
    setFilterText(filterParam);
  }, [filterParam]);

  const loadTableList = useCallback(async () => {
    if (!dbName || loadingTableListRef.current) return;
    
    try {
      loadingTableListRef.current = true;
      
      // Get adapter type from registry
      const { getDatabaseRegistryEntries } = await import('../../../storage/adapters');
      const entries = await getDatabaseRegistryEntries();
      const entry = entries.find(e => e.name === dbName);
      
      if (!entry) {
        loadingTableListRef.current = false;
        return;
      }
      
      // Connect to database
      const adapter = await getAdapterByType(entry.adapterType);
      if (!adapter.getDatabaseByName || !adapter.getTableNames) {
        loadingTableListRef.current = false;
        return;
      }
      
      const database = await adapter.getDatabaseByName(dbName);
      
      // Get table names
      const tableNames = await adapter.getTableNames(database);
      
      // Get row counts for all tables
      const { sql } = await import('drizzle-orm');
      const counts: Record<string, number> = {};
      
      await Promise.all(
        tableNames.map(async (tableName) => {
          try {
            const countQuery = `SELECT COUNT(*) as count FROM "${tableName}"`;
            console.log(`[db-browser] Sidebar count query for ${tableName}:`, countQuery);
            const countResult = await database.execute(sql.raw(countQuery)) as any[];
            console.log(`[db-browser] Sidebar count result for ${tableName}:`, countResult);
            
            const count = countResult[0]?.count || countResult[0]?.['count'] || countResult[0]?.[0] || 0;
            const parsedCount = typeof count === 'number' ? count : parseInt(String(count), 10);
            console.log(`[db-browser] Parsed count for ${tableName}:`, parsedCount, 'from raw:', count);
            counts[tableName] = parsedCount;
          } catch (err) {
            console.error(`[db-browser] Error counting rows for ${tableName}:`, err);
            counts[tableName] = 0;
          }
        })
      );
      
      // Set both tables and row counts together to avoid flickering
      // Preserve existing tables until we have new data ready
      setTables(prevTables => {
        // Only update if we have new data, otherwise preserve existing
        if (tableNames.length > 0) {
          return tableNames;
        }
        return prevTables; // Keep existing tables
      });
      setTableRowCounts(prevCounts => {
        // Merge with existing counts to preserve state during updates
        return { ...prevCounts, ...counts };
      });
    } catch (err) {
      console.error(`[db-browser] Error loading table list:`, err);
      // Don't clear existing tables on error - preserve what we have
    } finally {
      loadingTableListRef.current = false;
    }
  }, [dbName]);

  // Load table list for sidebar (only once when dbName changes)
  useEffect(() => {
    if (dbName) {
      loadTableList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbName]);

  const loadTableData = useCallback(async (targetTable?: string, useCache = true) => {
    const currentTable = targetTable || tableName;
    if (!dbName || !currentTable) return;
    
    // Check cache first (if enabled and no filter/sort changes)
    const cacheKey = `${currentTable}-${page}-${pageSize}-${sortBy}-${sortOrder}-${filterParam}`;
    if (useCache && tableDataCache[cacheKey]) {
      const cached = tableDataCache[cacheKey];
      // Use cache if less than 30 seconds old
      if (Date.now() - cached.timestamp < 30000) {
        setTableData(cached);
        setLoading(false);
        return;
      }
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Get adapter type from registry
      const { getDatabaseRegistryEntries } = await import('../../../storage/adapters');
      const entries = await getDatabaseRegistryEntries();
      const entry = entries.find(e => e.name === dbName);
      
      if (!entry) {
        setError(`Database ${dbName} not found in registry`);
        setLoading(false);
        return;
      }
      
      // Connect to database
      const adapter = await getAdapterByType(entry.adapterType);
      if (!adapter.getDatabaseByName) {
        setError(`Adapter ${entry.adapterType} does not support getDatabaseByName`);
        setLoading(false);
        return;
      }
      
      const database = await adapter.getDatabaseByName(dbName);
      if (!dbInstance) {
        setDbInstance(database);
      }
      
      // Get column information
      const { sql } = await import('drizzle-orm');
      const columnInfo = await database.execute(sql.raw(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '${currentTable}'
        ORDER BY ordinal_position
      `)) as any[];
      
      const columns = columnInfo.map((col: any) => {
        const colName = col.column_name || col['column_name'] || col[0];
        return colName;
      }).filter(Boolean);
      
      // Get total row count (with filter if applicable)
      let countQuery = `SELECT COUNT(*) as count FROM "${currentTable}"`;
      if (filterParam && filterParam.trim()) {
        const filterLower = filterParam.toLowerCase();
        const columnFilters = columns.map(col => 
          `LOWER(CAST("${col}" AS TEXT)) LIKE '%${filterLower.replace(/'/g, "''")}%'`
        ).join(' OR ');
        countQuery += ` WHERE (${columnFilters})`;
      }
      
      console.log(`[db-browser] Data count query for ${currentTable}:`, countQuery);
      console.log(`[db-browser] Filter param:`, filterParam);
      const countResult = await database.execute(sql.raw(countQuery)) as any[];
      console.log(`[db-browser] Data count result for ${currentTable}:`, countResult);
      const totalRowCount = countResult[0]?.count || countResult[0]?.['count'] || countResult[0]?.[0] || 0;
      console.log(`[db-browser] Parsed totalRowCount for ${currentTable}:`, totalRowCount, 'from raw:', countResult[0]);
      
      // Build query with sorting and filtering
      let query = `SELECT * FROM "${currentTable}"`;
      const conditions: string[] = [];
      
      // Apply text filter if provided
      if (filterParam && filterParam.trim()) {
        const filterLower = filterParam.toLowerCase();
        const columnFilters = columns.map(col => 
          `LOWER(CAST("${col}" AS TEXT)) LIKE '%${filterLower.replace(/'/g, "''")}%'`
        ).join(' OR ');
        conditions.push(`(${columnFilters})`);
      }
      
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      // Apply sorting
      if (sortBy && columns.includes(sortBy)) {
        query += ` ORDER BY "${sortBy}" ${sortOrder.toUpperCase()}`;
      }
      
      // Apply pagination
      const offset = (page - 1) * pageSize;
      query += ` LIMIT ${pageSize} OFFSET ${offset}`;
      
      console.log(`[db-browser] Data query for ${currentTable}:`, query);
      console.log(`[db-browser] Columns:`, columns);
      // Execute query
      const rows = await database.execute(sql.raw(query)) as any[];
      console.log(`[db-browser] Data query result for ${currentTable}:`, rows.length, 'rows');
      console.log(`[db-browser] First row sample:`, rows[0]);
      
      // Ensure each row has an id
      const rowsWithIds = rows.map((row, index) => ({
        ...row,
        id: row.id || `row-${currentTable}-${offset + index}`,
      }));
      
      const newTableData = {
        columns,
        rows: rowsWithIds,
        rowCount: typeof totalRowCount === 'number' ? totalRowCount : parseInt(String(totalRowCount), 10),
      };
      
      // Only set as current table data if this is the active table
      if (currentTable === tableName) {
        setTableData(newTableData);
      }
      
      // Cache the data
      setTableDataCache(prev => ({
        ...prev,
        [cacheKey]: {
          ...newTableData,
          timestamp: Date.now(),
        },
      }));
    } catch (err) {
      console.error(`[db-browser] Error loading table data:`, err);
      if (currentTable === tableName) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (currentTable === tableName) {
        setLoading(false);
      }
    }
  }, [dbName, tableName, page, pageSize, sortBy, sortOrder, filterParam, dbInstance]);

  // Load database and table data
  useEffect(() => {
    if (dbName && tableName) {
      loadTableData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbName, tableName, page, pageSize, sortBy, sortOrder, filterParam]);
  
  // Preload adjacent tables in the background
  useEffect(() => {
    if (tables.length > 0 && tableName && dbName) {
      const currentIndex = tables.indexOf(tableName);
      if (currentIndex >= 0) {
        // Preload next 2 tables
        const tablesToPreload = tables.slice(currentIndex + 1, currentIndex + 3);
        tablesToPreload.forEach(table => {
          // Preload in background without blocking
          loadTableData(table, true).catch(() => {
            // Silently fail preloading
          });
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables, tableName, dbName]);

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
  };

  const isValueNull = (value: any): boolean => {
    return value === null || value === undefined;
  };

  const handleSort = (column: string) => {
    const newSortOrder = sortBy === column && sortOrder === 'asc' ? 'desc' : 'asc';
    const params = new URLSearchParams();
    params.set('page', '1');
    if (pageSize !== 50) params.set('pageSize', String(pageSize));
    params.set('sortBy', column);
    params.set('sortOrder', newSortOrder);
    if (filterText) params.set('filter', filterText);
    if (visibleColumns) params.set('visibleColumns', Array.from(visibleColumns).join(','));
    
    router.push(`/db-browser/${encodeURIComponent(dbName!)}/${encodeURIComponent(tableName!)}?${params.toString()}`);
  };

  const toggleColumnVisibility = (column: string) => {
    const newVisible = visibleColumns ? new Set(visibleColumns) : new Set(tableData?.columns || []);
    
    if (newVisible.has(column)) {
      newVisible.delete(column);
    } else {
      newVisible.add(column);
    }
    
    // If all columns are visible, don't include visibleColumns param
    const allColumns = tableData?.columns || [];
    const shouldShowAll = newVisible.size === allColumns.length;
    
    const params = new URLSearchParams();
    params.set('page', String(page));
    if (pageSize !== 50) params.set('pageSize', String(pageSize));
    if (sortBy) {
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
    }
    if (filterText) params.set('filter', filterText);
    if (!shouldShowAll) params.set('visibleColumns', Array.from(newVisible).join(','));
    
    router.push(`/db-browser/${encodeURIComponent(dbName!)}/${encodeURIComponent(tableName!)}?${params.toString()}`);
  };

  const handleFilterChange = useCallback((text: string) => {
    setFilterText(text);
  }, []);

  // Debounced filter effect - only update URL if filterText differs from filterParam
  useEffect(() => {
    // Skip if filterText matches filterParam (to avoid loops)
    if (filterText === filterParam) return;
    
    const timeoutId = setTimeout(() => {
      const params = new URLSearchParams();
      params.set('page', '1');
      if (pageSize !== 50) params.set('pageSize', String(pageSize));
      if (sortBy) {
        params.set('sortBy', sortBy);
        params.set('sortOrder', sortOrder);
      }
      if (filterText) params.set('filter', filterText);
      if (visibleColumns) params.set('visibleColumns', Array.from(visibleColumns).join(','));
      
      router.push(`/db-browser/${encodeURIComponent(dbName!)}/${encodeURIComponent(tableName!)}?${params.toString()}`);
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [filterText, filterParam, dbName, tableName, pageSize, sortBy, sortOrder, visibleColumns, router]);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams();
    params.set('page', String(newPage));
    if (pageSize !== 50) params.set('pageSize', String(pageSize));
    if (sortBy) {
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
    }
    if (filterText) params.set('filter', filterText);
    if (visibleColumns) params.set('visibleColumns', Array.from(visibleColumns).join(','));
    
    router.push(`/db-browser/${encodeURIComponent(dbName!)}/${encodeURIComponent(tableName!)}?${params.toString()}`);
  };

  const getVisibleColumns = () => {
    if (!tableData) return [];
    if (!visibleColumns) return tableData.columns;
    return tableData.columns.filter(col => visibleColumns.has(col));
  };

  const totalPages = tableData ? Math.ceil(tableData.rowCount / pageSize) : 1;

  if (!dbName || !tableName) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Database or table name missing</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push('/db-browser/list')}
          >
            <Text style={styles.backButtonText}>Back to List</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {/* Left section */}
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push(`/db-browser/${encodeURIComponent(dbName)}`)}
          >
            <Text style={styles.headerButtonText}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <Text style={styles.headerButtonText}>{sidebarCollapsed ? '☰' : '◀'}</Text>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerDbName} numberOfLines={1}>{dbName}</Text>
            <Text style={styles.headerTableName} numberOfLines={1}>{tableName}</Text>
          </View>
        </View>
        
        {/* Center section - Search and Pagination */}
        <View style={styles.headerCenter}>
          <TextInput
            style={styles.headerFilterInput}
            value={filterText}
            onChangeText={handleFilterChange}
            placeholder="Filter rows..."
            placeholderTextColor="#999"
          />
          {tableData && (
            <View style={styles.headerPagination}>
              <TouchableOpacity
                style={[styles.headerPaginationButton, page === 1 && styles.headerPaginationButtonDisabled]}
                onPress={() => handlePageChange(page - 1)}
                disabled={page === 1}
              >
                <Text style={styles.headerPaginationButtonText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.headerPaginationText}>
                {page}/{totalPages}
              </Text>
              <TouchableOpacity
                style={[styles.headerPaginationButton, page >= totalPages && styles.headerPaginationButtonDisabled]}
                onPress={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
              >
                <Text style={styles.headerPaginationButtonText}>›</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        {/* Right section */}
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowColumnMenu(true)}
          >
            <Text style={styles.headerButtonText}>⚙</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      )}

      <View style={styles.content}>
        {/* Sidebar */}
        {!sidebarCollapsed && (
          <View style={styles.sidebar}>
            <ScrollView style={styles.tableList}>
              {useMemo(() => {
                // Always show tables we know about, even during loading
                if (tables.length === 0) {
                  return null;
                }
                
                // Use existing row counts - only sort if we have counts for all tables
                // Otherwise preserve the current order
                const hasAllCounts = tables.every(table => tableRowCounts[table] !== undefined);
                
                let sortedTables = [...tables];
                if (hasAllCounts) {
                  // Sort tables: non-empty first, then empty tables
                  sortedTables.sort((a, b) => {
                    const countA = tableRowCounts[a] ?? 0;
                    const countB = tableRowCounts[b] ?? 0;
                    if ((countA === 0 && countB === 0) || (countA > 0 && countB > 0)) {
                      return 0;
                    }
                    return countA === 0 ? 1 : -1;
                  });
                }
                
                return sortedTables.map((table) => {
                  // Use existing row count if available, otherwise undefined
                  const rowCount = tableRowCounts[table];
                  // Only mark as empty if we have a confirmed count of 0
                  const isEmpty = rowCount !== undefined && rowCount === 0;
                  // Don't check selection here - will be handled by style prop
                  return (
                    <TableItem
                      key={table}
                      table={table}
                      rowCount={rowCount}
                      isEmpty={isEmpty}
                      isSelected={table === currentTableName}
                      onPress={(tableName) => {
                        // Mark as internal navigation to prevent URL sync
                        isInternalNavigationRef.current = true;
                        // Update local state immediately (no re-render of sidebar)
                        setCurrentTableName(tableName);
                        // Update URL directly without triggering navigation
                        if (typeof window !== 'undefined') {
                          const newPath = `/db-browser/${encodeURIComponent(dbName!)}/${encodeURIComponent(tableName)}`;
                          window.history.replaceState({}, '', newPath);
                        } else {
                          // Fallback for native - use router but mark as internal
                          const newPath = `/db-browser/${encodeURIComponent(dbName!)}/${encodeURIComponent(tableName)}`;
                          router.replace(newPath);
                        }
                        // Load table data immediately
                        loadTableData(tableName, false);
                      }}
                    />
                  );
                });
              }, [tables, tableRowCounts, currentTableName, dbName])}
            </ScrollView>
          </View>
        )}

        {/* Main content */}
        <View style={styles.mainContent}>
          {loading && !tableData ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#667eea" />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : tableData ? (
            <View style={styles.tableContainer}>
              <ScrollView horizontal style={styles.tableScroll}>
                <View>
                  {/* Header */}
                  <View style={styles.tableHeader}>
                    {getVisibleColumns().map((col) => (
                      <TouchableOpacity
                        key={col}
                        style={[styles.tableHeaderCell, { width: 150 }]}
                        onPress={() => handleSort(col)}
                      >
                        <View style={styles.headerCellContent}>
                          <Text style={styles.tableHeaderText} numberOfLines={1}>
                            {col}
                          </Text>
                          {sortBy === col && (
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
                    {tableData.rows.map((row) => (
                      <View key={row.id} style={styles.tableRow}>
                        {getVisibleColumns().map((col) => {
                          const value = row[col];
                          const isNull = isValueNull(value);
                          return (
                            <View key={col} style={[styles.tableCell, { width: 150 }]}>
                              <Text
                                style={[
                                  styles.tableCellText,
                                  isNull && styles.nullValueText,
                                ]}
                                numberOfLines={1}
                              >
                                {isNull ? '?' : formatValue(value)}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    ))}
                    {tableData.rows.length === 0 && (
                      <View style={styles.emptyRow}>
                        <Text style={styles.emptyText}>No rows found</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              </ScrollView>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No table data available</Text>
            </View>
          )}
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
              {tableData?.columns.map((col) => {
                const isVisible = !visibleColumns || visibleColumns.has(col);
                return (
                  <TouchableOpacity
                    key={col}
                    style={styles.columnMenuItem}
                    onPress={() => toggleColumnVisibility(col)}
                  >
                    <Text style={styles.columnMenuCheckbox}>
                      {isVisible ? '✓' : '○'}
                    </Text>
                    <Text style={styles.columnMenuText}>{col}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  // Show all columns
                  const params = new URLSearchParams();
                  params.set('page', String(page));
                  if (pageSize !== 50) params.set('pageSize', String(pageSize));
                  if (sortBy) {
                    params.set('sortBy', sortBy);
                    params.set('sortOrder', sortOrder);
                  }
                  if (filterText) params.set('filter', filterText);
                  // Don't include visibleColumns to show all
                  router.push(`/db-browser/${encodeURIComponent(dbName!)}/${encodeURIComponent(tableName!)}?${params.toString()}`);
                  setShowColumnMenu(false);
                }}
              >
                <Text style={styles.modalButtonText}>Show All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 0,
    minWidth: 200,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 0,
    minWidth: 100,
    justifyContent: 'flex-end',
  },
  headerButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerInfo: {
    minWidth: 100,
    maxWidth: 200,
  },
  headerDbName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  headerTableName: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  headerFilterInput: {
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 14,
    backgroundColor: '#fff',
    minHeight: 32,
  },
  headerPagination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerPaginationButton: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerPaginationButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.5,
  },
  headerPaginationButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  headerPaginationText: {
    fontSize: 11,
    color: '#666',
    minWidth: 50,
    textAlign: 'center',
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
  backButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#667eea',
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  filterContainer: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },
  filterInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 8,
    fontSize: 14,
    backgroundColor: '#fff',
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 200,
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  sidebarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  sidebarToggleButton: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarToggleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  tableList: {
    flex: 1,
  },
  tableItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tableItemEmpty: {
    opacity: 0.5,
    backgroundColor: '#f9f9f9',
  },
  tableItemSelected: {
    backgroundColor: '#667eea',
    opacity: 1,
  },
  tableItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  tableItemText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  tableItemTextEmpty: {
    color: '#999',
    fontStyle: 'italic',
  },
  tableItemTextSelected: {
    color: '#fff',
    fontWeight: '500',
    fontStyle: 'normal',
  },
  tableItemCount: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  tableItemCountEmpty: {
    color: '#bbb',
  },
  tableItemCountSelected: {
    color: '#fff',
    opacity: 0.8,
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#fff',
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

