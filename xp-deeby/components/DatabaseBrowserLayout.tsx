/**
 * Database Browser Layout Component
 * 
 * Shared layout component for database browser pages with sidebar and main content.
 * Used by [db]/[table] page (which handles both table view and query mode).
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    Modal,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getAdapterByType, getRegistryEntries, listDatabasesWeb, getDatabaseMetadata } from '../adapters';
import { sql } from 'drizzle-orm';

export type NavigateCallback = (dbName: string | null, tableName: string | null, searchParams: Record<string, string>) => void;

export interface DatabaseBrowserLayoutProps {
    dbName: string;
    onNavigate: NavigateCallback;
    children: React.ReactNode;
    onBack?: () => void;
    showSidebar?: boolean;
    currentTableName?: string | null;
    onTableSelect?: (tableName: string) => void;
}

// Table item component (memoized for performance)
const TableItem = React.memo<{
    table: string;
    rowCount: number | null;
    isEmpty: boolean;
    isSelected: boolean;
    onPress: (tableName: string) => void;
}>(({ table, rowCount, isEmpty, isSelected, onPress }) => {
    return (
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
                {rowCount !== null && (
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
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.table === nextProps.table &&
        prevProps.rowCount === nextProps.rowCount &&
        prevProps.isEmpty === nextProps.isEmpty &&
        prevProps.isSelected === nextProps.isSelected
    );
});

TableItem.displayName = 'TableItem';

// Context for sidebar state
export const SidebarContext = React.createContext<{
    sidebarCollapsed: boolean;
    toggleSidebar: () => void;
}>({
    sidebarCollapsed: false,
    toggleSidebar: () => {},
});

export default function DatabaseBrowserLayout({
    dbName,
    onNavigate,
    children,
    onBack,
    showSidebar = true,
    currentTableName = null,
    onTableSelect,
}: DatabaseBrowserLayoutProps) {
    const searchParams = useLocalSearchParams<{ sidebarCollapsed?: string }>();
    
    // Read collapsed state from URL, default to false
    const initialCollapsed = searchParams.sidebarCollapsed === 'true';
    const [sidebarCollapsed, setSidebarCollapsed] = useState(initialCollapsed);
    const [tables, setTables] = useState<string[]>([]);
    const [views, setViews] = useState<string[]>([]);
    const [materializedViews, setMaterializedViews] = useState<string[]>([]);
    const [tableRowCounts, setTableRowCounts] = useState<Record<string, number>>({});
    const [databases, setDatabases] = useState<string[]>([]);
    const [databaseTableCounts, setDatabaseTableCounts] = useState<Record<string, number>>({});
    const [showDatabaseDropdown, setShowDatabaseDropdown] = useState(false);
    const [isPostgres, setIsPostgres] = useState(false);
    const [sectionsCollapsed, setSectionsCollapsed] = useState<{
        tables: boolean;
        views: boolean;
        materializedViews: boolean;
    }>({
        tables: false,
        views: false,
        materializedViews: false,
    });
    const loadingTableListRef = useRef(false);

    // Sync with URL param changes only on initial mount or when db changes
    const hasInitializedRef = useRef(false);
    useEffect(() => {
        if (!hasInitializedRef.current) {
            hasInitializedRef.current = true;
            // Initial sync from URL
            const urlCollapsed = searchParams.sidebarCollapsed === 'true';
            if (urlCollapsed !== sidebarCollapsed) {
                setSidebarCollapsed(urlCollapsed);
            }
        } else if (dbName) {
            // Reset when db changes
            hasInitializedRef.current = false;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dbName]); // Only react to db changes, not URL param changes

    // Toggle sidebar and update URL via callback
    const toggleSidebar = useCallback(() => {
        const newCollapsed = !sidebarCollapsed;
        setSidebarCollapsed(newCollapsed);
        
        // Update URL via callback to cache collapsed state
        const searchParams: Record<string, string> = {};
        if (newCollapsed) {
            searchParams.sidebarCollapsed = 'true';
        }
        onNavigate(dbName || null, currentTableName, searchParams);
    }, [sidebarCollapsed, dbName, currentTableName, onNavigate]);

    const loadTableList = useCallback(async () => {
        if (!dbName || loadingTableListRef.current) return;

        try {
            loadingTableListRef.current = true;

            // Get adapter type from registry
            const entries = await getRegistryEntries();
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

            // Check if this is a PostgreSQL database
            const capabilities = adapter.getCapabilities();
            const isPostgresDb = capabilities.databaseType === 'postgres';
            setIsPostgres(isPostgresDb);

            const database = await adapter.getDatabaseByName(dbName);

            // Get table names
            const tableNames = await adapter.getTableNames(database);

            // Get view names if supported
            let viewNames: string[] = [];
            if (adapter.getViewNames) {
                try {
                    viewNames = await adapter.getViewNames(database);
                } catch (err) {
                    console.error(`[DatabaseBrowserLayout] Error loading view names:`, err);
                }
            }

            // Get materialized view names if supported (PostgreSQL only)
            let matViewNames: string[] = [];
            if (isPostgresDb && adapter.getMaterializedViewNames) {
                try {
                    matViewNames = await adapter.getMaterializedViewNames(database);
                } catch (err) {
                    console.error(`[DatabaseBrowserLayout] Error loading materialized view names:`, err);
                }
            }

            // Get row counts for all tables
            const counts: Record<string, number> = {};

            await Promise.all(
                tableNames.map(async (tableName) => {
                    try {
                        const countQuery = `SELECT COUNT(*) as count FROM "${tableName}"`;
                        const countResult = await database.execute(sql.raw(countQuery)) as any[];
                        const count = countResult[0]?.count || countResult[0]?.['count'] || countResult[0]?.[0] || 0;
                        const parsedCount = typeof count === 'number' ? count : parseInt(String(count), 10);
                        counts[tableName] = parsedCount;
                    } catch (err) {
                        console.error(`[DatabaseBrowserLayout] Error counting rows for ${tableName}:`, err);
                        counts[tableName] = 0;
                    }
                })
            );

            setTables(tableNames);
            setViews(viewNames);
            setMaterializedViews(matViewNames);
            setTableRowCounts(prevCounts => ({ ...prevCounts, ...counts }));
        } catch (err) {
            console.error(`[DatabaseBrowserLayout] Error loading table list:`, err);
        } finally {
            loadingTableListRef.current = false;
        }
    }, [dbName]);

    // Load databases list with table counts
    const loadingDatabasesRef = useRef(false);
    const loadDatabases = useCallback(async () => {
        if (loadingDatabasesRef.current) return;
        loadingDatabasesRef.current = true;
        try {
            const dbNames = await listDatabasesWeb();
            setDatabases(dbNames);
            
            // Load table counts for each database
            const counts: Record<string, number> = {};
            await Promise.all(
                dbNames.map(async (dbName) => {
                    try {
                        const metadata = await getDatabaseMetadata(dbName);
                        counts[dbName] = metadata.tableCount;
                    } catch (err) {
                        console.error(`[DatabaseBrowserLayout] Error loading table count for ${dbName}:`, err);
                        counts[dbName] = 0;
                    }
                })
            );
            setDatabaseTableCounts(counts);
        } catch (err) {
            console.error(`[DatabaseBrowserLayout] Error loading databases:`, err);
        } finally {
            loadingDatabasesRef.current = false;
        }
    }, []);

    // Load databases on mount only once
    const hasLoadedDatabasesRef = useRef(false);
    useEffect(() => {
        if (!hasLoadedDatabasesRef.current) {
            hasLoadedDatabasesRef.current = true;
            loadDatabases();
        }
    }, [loadDatabases]);

    // Load table list when dbName changes
    useEffect(() => {
        if (dbName) {
            loadTableList();
        }
    }, [dbName, loadTableList]);

    const handleDatabaseSelect = useCallback((selectedDbName: string) => {
        if (selectedDbName !== dbName) {
            setShowDatabaseDropdown(false);
            // Navigate to the database (no table selected initially)
            onNavigate(selectedDbName, null, {});
        } else {
            setShowDatabaseDropdown(false);
        }
    }, [dbName, onNavigate]);

    const handleTableSelect = useCallback((tableName: string) => {
        if (onTableSelect) {
            onTableSelect(tableName);
        } else {
            // Clear query parameters when switching tables
            onNavigate(dbName, tableName, {});
        }
    }, [dbName, onNavigate, onTableSelect]);

    const handleBack = useCallback(() => {
        if (onBack) {
            onBack();
        } else {
            // If no database selected, stay on current page (no-op)
            // Otherwise navigate to database list (which now shows the centered dropdown)
            if (dbName) {
                onNavigate(null, null, {});
            }
        }
    }, [onBack, dbName, onNavigate]);

    // Sort tables: non-empty first, then empty tables
    const sortedTables = useMemo(() => {
        const sorted = [...tables].sort((a, b) => {
            const countA = tableRowCounts[a] ?? 0;
            const countB = tableRowCounts[b] ?? 0;
            if ((countA === 0 && countB === 0) || (countA > 0 && countB > 0)) {
                return 0;
            }
            return countA === 0 ? 1 : -1;
        });
        return sorted;
    }, [tables, tableRowCounts]);

    // If no database selected, center the dropdown
    if (!dbName) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centeredContent}>
                    {/* Database Dropdown - Centered */}
                    <View style={styles.centeredDropdownContainer}>
                        <TouchableOpacity
                            style={styles.centeredDropdownButton}
                            onPress={() => setShowDatabaseDropdown(true)}
                        >
                            <View style={styles.databaseDropdownContent}>
                                <Text style={styles.databaseDropdownText} numberOfLines={1}>
                                    Select Database
                                </Text>
                            </View>
                            <Text style={styles.databaseDropdownIcon}>▼</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Database Dropdown Modal */}
                    <Modal
                        visible={showDatabaseDropdown}
                        transparent={true}
                        animationType="fade"
                        onRequestClose={() => setShowDatabaseDropdown(false)}
                    >
                        <TouchableOpacity
                            style={styles.centeredModalOverlay}
                            activeOpacity={1}
                            onPress={() => setShowDatabaseDropdown(false)}
                        >
                            <View style={styles.centeredDropdownListContainer}>
                                <ScrollView style={styles.dropdownScroll}>
                                    {databases.map((db) => (
                                        <TouchableOpacity
                                            key={db}
                                            style={styles.dropdownItem}
                                            onPress={() => handleDatabaseSelect(db)}
                                        >
                                            <Text style={styles.dropdownItemText}>
                                                {db} ({databaseTableCounts[db] ?? 0} tables)
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        </TouchableOpacity>
                    </Modal>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                {/* Sidebar */}
                {showSidebar && !sidebarCollapsed && (
                    <View style={styles.sidebar}>
                        {/* Collapse handle - two vertical bars on the edge */}
                        <TouchableOpacity
                            style={styles.sidebarCollapseHandle}
                            onPress={toggleSidebar}
                        >
                            <View style={styles.collapseHandleBars}>
                                <View style={styles.collapseHandleBar} />
                                <View style={styles.collapseHandleBar} />
                            </View>
                        </TouchableOpacity>
                        {/* Database Dropdown - First item */}
                        <View style={styles.databaseDropdownRow}>
                            <TouchableOpacity
                                style={styles.databaseDropdownButton}
                                onPress={() => setShowDatabaseDropdown(true)}
                            >
                                <View style={styles.databaseDropdownContent}>
                                    <Text style={styles.databaseDropdownText} numberOfLines={1}>
                                        {dbName || 'Select Database'}
                                    </Text>
                                    {dbName && (
                                        <Text style={styles.databaseDropdownSubtext}>
                                            ({databaseTableCounts[dbName] ?? tables.length} tables)
                                        </Text>
                                    )}
                                </View>
                                <Text style={styles.databaseDropdownIcon}>▼</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Database Dropdown Modal */}
                        <Modal
                            visible={showDatabaseDropdown}
                            transparent={true}
                            animationType="fade"
                            onRequestClose={() => setShowDatabaseDropdown(false)}
                        >
                            <TouchableOpacity
                                style={styles.modalOverlay}
                                activeOpacity={1}
                                onPress={() => setShowDatabaseDropdown(false)}
                            >
                                <View style={styles.dropdownContainer}>
                                    <ScrollView style={styles.dropdownScroll}>
                                        {databases.map((db) => (
                                            <TouchableOpacity
                                                key={db}
                                                style={[
                                                    styles.dropdownItem,
                                                    db === dbName && styles.dropdownItemSelected,
                                                ]}
                                                onPress={() => handleDatabaseSelect(db)}
                                            >
                                                <Text
                                                    style={[
                                                        styles.dropdownItemText,
                                                        db === dbName && styles.dropdownItemTextSelected,
                                                    ]}
                                                >
                                                    {db} ({databaseTableCounts[db] ?? 0} tables)
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            </TouchableOpacity>
                        </Modal>

                        <ScrollView style={styles.tableList}>
                            {/* Tables Section */}
                            {sortedTables.length > 0 && (
                                <>
                                    <TouchableOpacity
                                        style={styles.sectionHeader}
                                        onPress={() => setSectionsCollapsed(prev => ({
                                            ...prev,
                                            tables: !prev.tables
                                        }))}
                                    >
                                        <Text style={styles.sectionHeaderText}>Tables</Text>
                                        <Text style={styles.sectionHeaderIcon}>
                                            {sectionsCollapsed.tables ? '▶' : '▼'}
                                        </Text>
                                    </TouchableOpacity>
                                    {!sectionsCollapsed.tables && sortedTables.map((table) => {
                                        const rowCount = tableRowCounts[table] ?? null;
                                        const isEmpty = rowCount === 0;
                                        const isSelected = table === currentTableName;
                                        return (
                                            <TableItem
                                                key={table}
                                                table={table}
                                                rowCount={rowCount}
                                                isEmpty={isEmpty}
                                                isSelected={isSelected}
                                                onPress={handleTableSelect}
                                            />
                                        );
                                    })}
                                </>
                            )}

                            {/* Views Section */}
                            {views.length > 0 && (
                                <>
                                    <TouchableOpacity
                                        style={styles.sectionHeader}
                                        onPress={() => setSectionsCollapsed(prev => ({
                                            ...prev,
                                            views: !prev.views
                                        }))}
                                    >
                                        <Text style={styles.sectionHeaderText}>Views</Text>
                                        <Text style={styles.sectionHeaderIcon}>
                                            {sectionsCollapsed.views ? '▶' : '▼'}
                                        </Text>
                                    </TouchableOpacity>
                                    {!sectionsCollapsed.views && views.map((view) => {
                                        const isSelected = view === currentTableName;
                                        return (
                                            <TableItem
                                                key={view}
                                                table={view}
                                                rowCount={null}
                                                isEmpty={false}
                                                isSelected={isSelected}
                                                onPress={handleTableSelect}
                                            />
                                        );
                                    })}
                                </>
                            )}

                            {/* Materialized Views Section (PostgreSQL only) */}
                            {isPostgres && materializedViews.length > 0 && (
                                <>
                                    <TouchableOpacity
                                        style={styles.sectionHeader}
                                        onPress={() => setSectionsCollapsed(prev => ({
                                            ...prev,
                                            materializedViews: !prev.materializedViews
                                        }))}
                                    >
                                        <Text style={styles.sectionHeaderText}>Materialized Views</Text>
                                        <Text style={styles.sectionHeaderIcon}>
                                            {sectionsCollapsed.materializedViews ? '▶' : '▼'}
                                        </Text>
                                    </TouchableOpacity>
                                    {!sectionsCollapsed.materializedViews && materializedViews.map((matView) => {
                                        const isSelected = matView === currentTableName;
                                        return (
                                            <TableItem
                                                key={matView}
                                                table={matView}
                                                rowCount={null}
                                                isEmpty={false}
                                                isSelected={isSelected}
                                                onPress={handleTableSelect}
                                            />
                                        );
                                    })}
                                </>
                            )}
                        </ScrollView>
                    </View>
                )}

                {/* Main content */}
                <SidebarContext.Provider value={{ sidebarCollapsed, toggleSidebar }}>
                    <View style={styles.mainContent}>
                        {children}
                    </View>
                </SidebarContext.Provider>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
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
        position: 'relative',
    },
    sidebarCollapseHandle: {
        position: 'absolute',
        right: -12,
        top: 0,
        bottom: 0,
        width: 12,
        zIndex: 10,
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
    },
    collapseHandleBars: {
        flexDirection: 'row',
        gap: 2,
        alignItems: 'center',
    },
    collapseHandleBar: {
        width: 2,
        height: 20,
        backgroundColor: '#667eea',
        borderRadius: 1,
    },
    databaseDropdownRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        backgroundColor: '#dddfff',
        minHeight: 65,
    },
    databaseDropdownButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        justifyContent: 'space-between',
    },
    databaseDropdownContent: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
    },
    databaseDropdownText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    databaseDropdownSubtext: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    databaseDropdownIcon: {
        fontSize: 10,
        color: '#666',
        marginLeft: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'flex-start',
        paddingTop: 48,
        paddingLeft: 0,
    },
    dropdownContainer: {
        backgroundColor: '#fff',
        borderRightWidth: 1,
        borderRightColor: '#e0e0e0',
        width: 200,
        maxHeight: '80%',
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
    },
    dropdownScroll: {
        maxHeight: 400,
    },
    dropdownItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    dropdownItemSelected: {
        backgroundColor: '#e8f0ff',
    },
    dropdownItemText: {
        fontSize: 14,
        color: '#333',
    },
    dropdownItemTextSelected: {
        color: '#667eea',
        fontWeight: '600',
    },
    tableList: {
        flex: 1,
    },
    sectionHeader: {
        padding: 8,
        paddingLeft: 12,
        paddingTop: 12,
        paddingRight: 12,
        backgroundColor: '#f0f0f0',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectionHeaderText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#666',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        flex: 1,
    },
    sectionHeaderIcon: {
        fontSize: 10,
        color: '#666',
        marginLeft: 8,
    },
    tableItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        maxHeight: 36
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
        flexDirection: 'column',
    },
    centeredContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    centeredDropdownContainer: {
        width: 300,
        maxWidth: '80%',
    },
    centeredDropdownButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        justifyContent: 'space-between',
    },
    centeredModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    centeredDropdownListContainer: {
        backgroundColor: '#fff',
        borderRadius: 8,
        width: 300,
        maxWidth: '80%',
        maxHeight: '60%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
});

