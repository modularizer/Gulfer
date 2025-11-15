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
    SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getAdapterByType, getDatabaseRegistryEntries } from '../../adapters';
import { sql } from 'drizzle-orm';
import TableViewer from '../..//components/TableViewer';
import { useTableData } from '../../hooks/useTableData';

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

export default function XpDeebyTableView() {
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

    // Use the table data hook - handles all database operations
    const tableData = useTableData({
        dbName: dbName || '',
        tableName: tableName || '',
        page,
        pageSize,
        sortBy,
        sortOrder,
        filter: filterParam,
    });

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

    // Sync filterText with URL param when it changes externally
    useEffect(() => {
        setFilterText(filterParam);
    }, [filterParam]);

    const loadTableList = useCallback(async () => {
        if (!dbName || loadingTableListRef.current) return;

        try {
            loadingTableListRef.current = true;

            // Get adapter type from registry
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



    const handleSort = useCallback((column: string) => {
        const newSortOrder = sortBy === column && sortOrder === 'asc' ? 'desc' : 'asc';
        const params = new URLSearchParams();
        params.set('page', '1');
        if (pageSize !== 50) params.set('pageSize', String(pageSize));
        params.set('sortBy', column);
        params.set('sortOrder', newSortOrder);
        if (filterText) params.set('filter', filterText);
        if (visibleColumns) params.set('visibleColumns', Array.from(visibleColumns).join(','));

        router.push(`/db-browser/${encodeURIComponent(dbName!)}/${encodeURIComponent(tableName!)}?${params.toString()}`);
    }, [sortBy, sortOrder, pageSize, filterText, visibleColumns, dbName, tableName, router]);

    const toggleColumnVisibility = useCallback((column: string) => {
        const newVisible = visibleColumns ? new Set(visibleColumns) : new Set(tableData.columns.map(c => c.name));

        if (newVisible.has(column)) {
            newVisible.delete(column);
        } else {
            newVisible.add(column);
        }

        // If all columns are visible, don't include visibleColumns param
        const allColumns = tableData.columns.map(c => c.name);
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
    }, [visibleColumns, tableData.columns, page, pageSize, sortBy, sortOrder, filterText, dbName, tableName, router]);

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

    const handlePageChange = useCallback((newPage: number) => {
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
    }, [pageSize, sortBy, sortOrder, filterText, visibleColumns, dbName, tableName, router]);

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

                {/* Center section - Database/Table name takes full space */}
                <View style={styles.headerInfo}>
                    <Text style={styles.headerDbName} numberOfLines={1}>{dbName}</Text>
                    <Text style={styles.headerTableName} numberOfLines={1}>{tableName}</Text>
                </View>
            </View>

            {tableData.error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Error: {tableData.error}</Text>
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
                                                // Table data will be loaded automatically by the hook when tableName changes
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
                    <TableViewer
                        columns={tableData.columns}
                        rows={tableData.rows}
                        totalRowCount={tableData.totalRowCount}
                        loading={tableData.loading}
                        error={tableData.error}
                        page={page}
                        pageSize={pageSize}
                        onPageChange={handlePageChange}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                        filterText={filterText}
                        onFilterChange={handleFilterChange}
                        visibleColumns={visibleColumns}
                        onToggleColumnVisibility={toggleColumnVisibility}
                    />
                </View>
            </View>

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

