/**
 * Database Browser - Query Tool Page
 *
 * Allows writing and executing SQL queries and viewing results.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getAdapterByType, getRegistryEntries } from '../../adapters';
import { sql } from 'drizzle-orm';
import TableViewer, { TableViewerColumn, TableViewerRow } from '../../components/TableViewer';
import QueryEditor from '../../components/QueryEditor';
import DatabaseBrowserLayout, { SidebarContext } from '../../components/DatabaseBrowserLayout';

export default function XpDeebyQueryTool() {
    const router = useRouter();
    const { db: dbName_, q } = useLocalSearchParams<{ db: string; q?: string }>();
    const dbName = dbName_ ? decodeURIComponent(dbName_) : null;
    const initialQuery = q ? decodeURIComponent(q) : '';

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [db, setDb] = useState<any>(null);
    const [queryText, setQueryText] = useState<string>(initialQuery);
    const [queryHistory, setQueryHistory] = useState<string[]>([]);
    const [results, setResults] = useState<{
        columns: TableViewerColumn[];
        rows: TableViewerRow[];
    } | null>(null);

    // Pagination state
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(100);
    const [sortBy, setSortBy] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [filterText, setFilterText] = useState('');
    const [visibleColumns, setVisibleColumns] = useState<Set<string> | null>(null);
    const [columnOrder, setColumnOrder] = useState<string[]>([]);
    const [columnWidths, setColumnWidths] = useState<Map<string, number>>(new Map());

    const loadDatabase = useCallback(async (name: string) => {
        try {
            console.log(`[query-tool] Loading database: ${name}`);
            setLoading(true);
            setError(null);

            // Get adapter type from registry
            const entries = await getRegistryEntries();
            const entry = entries.find(e => e.name === name);

            if (!entry) {
                const errorMsg = `Database ${name} not found in registry.`;
                console.error(`[query-tool] ${errorMsg}`);
                setError(errorMsg);
                setLoading(false);
                return;
            }

            // Use the exact adapter type from registry
            const adapter = await getAdapterByType(entry.adapterType);

            // Connect to existing database using the correct adapter
            if (!adapter.getDatabaseByName) {
                const errorMsg = `Adapter ${entry.adapterType} does not support getDatabaseByName`;
                console.error(`[query-tool] ${errorMsg}`);
                setError(errorMsg);
                setLoading(false);
                return;
            }

            const database = await adapter.getDatabaseByName(name);
            console.log(`[query-tool] Database connection obtained`);
            setDb(database);
        } catch (err) {
            console.error(`[query-tool] Error loading database:`, err);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (dbName) {
            loadDatabase(dbName);
        }
    }, [dbName, loadDatabase]);

    // Update query text if provided via URL parameter
    useEffect(() => {
        if (initialQuery && initialQuery !== queryText) {
            setQueryText(initialQuery);
        }
    }, [initialQuery]);

    // Auto-execute query when database loads and we have a query from URL
    useEffect(() => {
        if (db && initialQuery && initialQuery.trim() && !results) {
            // Small delay to ensure state is ready
            const timeoutId = setTimeout(() => {
                // Use the current queryText state (which should be set from initialQuery)
                if (queryText.trim()) {
                    executeQuery();
                }
            }, 100);
            return () => clearTimeout(timeoutId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, initialQuery, queryText]);

    // Helper function to extract column names from query result
    const extractColumnNames = useCallback((result: any): string[] => {
        // Check if result has fields metadata (PostgreSQL/PGlite provides this)
        if (result?.fields && Array.isArray(result.fields)) {
            return result.fields.map((field: any) => field.name || field.fieldName || String(field));
        }

        // If result is an array of rows, check the first row
        const firstRow = Array.isArray(result) ? result[0] : (result?.rows?.[0] || result?.[0]);
        
        if (!firstRow) {
            return [];
        }

        // Extract column names from row object keys
        if (typeof firstRow === 'object' && firstRow !== null) {
            if (Array.isArray(firstRow)) {
                // Array-based result - use generic column names
                return Array.from({ length: firstRow.length }, (_, i) => `column_${i + 1}`);
            } else {
                // Object-based result - use object keys as column names
                // For PostgreSQL, this should work since rows are objects with column names as keys
                return Object.keys(firstRow);
            }
        } else {
            // Single value result
            return ['value'];
        }
    }, []);

    const executeQuery = useCallback(async () => {
        if (!db || !queryText.trim()) {
            return;
        }

        try {
            setLoading(true);
            setError(null);
            setResults(null);

            console.log(`[query-tool] Executing query:`, queryText);

            // Execute query - result may be array of rows or object with rows/fields
            const queryResult = await db.execute(sql.raw(queryText)) as any;
            
            console.log(`[query-tool] Query result:`, queryResult);

            // Handle different result formats
            let rows: any[] = [];
            let resultMetadata: any = null;

            if (Array.isArray(queryResult)) {
                // Direct array of rows
                rows = queryResult;
            } else if (queryResult?.rows) {
                // Object with rows property (PostgreSQL format)
                rows = queryResult.rows;
                resultMetadata = queryResult;
            } else if (queryResult) {
                // Single row or other format
                rows = [queryResult];
            }

            if (!rows || rows.length === 0) {
                setResults({
                    columns: [],
                    rows: [],
                });
                setLoading(false);
                return;
            }

            // Extract column names using metadata if available, otherwise from first row
            const columnNames = resultMetadata 
                ? extractColumnNames(resultMetadata)
                : extractColumnNames(rows);

            // Convert results to TableViewer format
            const columns: TableViewerColumn[] = columnNames.map(name => ({
                name,
                label: name,
            }));

            const tableRows: TableViewerRow[] = rows.map((row, index) => {
                const rowData: TableViewerRow = { id: `row_${index}` };

                if (typeof row === 'object' && row !== null) {
                    if (Array.isArray(row)) {
                        // Array-based row - map by index
                        columnNames.forEach((colName, colIndex) => {
                            rowData[colName] = row[colIndex];
                        });
                    } else {
                        // Object-based row - copy all properties
                        // For PostgreSQL, column names should match the keys
                        Object.keys(row).forEach(key => {
                            rowData[key] = row[key];
                        });
                    }
                } else {
                    // Single value result
                    rowData[columnNames[0] || 'value'] = row;
                }

                return rowData;
            });

            setResults({ columns, rows: tableRows });
            setVisibleColumns(new Set(columnNames));
            setColumnOrder(columnNames);
            setPage(1);
            setSortBy(null);
            setSortOrder('asc');
            setFilterText('');

            // Add to history (keep last 10)
            setQueryHistory(prev => {
                const newHistory = [queryText, ...prev.filter(q => q !== queryText)];
                return newHistory.slice(0, 10);
            });
        } catch (err) {
            console.error(`[query-tool] Error executing query:`, err);
            setError(err instanceof Error ? err.message : String(err));
            setResults(null);
        } finally {
            setLoading(false);
        }
    }, [db, queryText, extractColumnNames]);

    const handleToggleColumnVisibility = useCallback((column: string) => {
        setVisibleColumns(prev => {
            const newSet = new Set(prev || []);
            if (newSet.has(column)) {
                newSet.delete(column);
            } else {
                newSet.add(column);
            }
            return newSet;
        });
    }, []);

    const handleSort = useCallback((column: string) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('asc');
        }
    }, [sortBy, sortOrder]);

    if (!dbName) {
        return (
            <DatabaseBrowserLayout dbName="" headerTitle="Error">
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>No database name provided</Text>
                </View>
            </DatabaseBrowserLayout>
        );
    }

    return (
        <DatabaseBrowserLayout
            dbName={dbName}
            headerTitle="Query Tool"
            headerSubtitle={dbName}
            onBack={() => router.push(`/db-browser/${encodeURIComponent(dbName)}`)}
        >
            {/* Query Editor */}
            <SidebarContext.Consumer>
                {({ sidebarCollapsed, toggleSidebar }) => (
                    <QueryEditor
                        value={queryText}
                        onChangeText={setQueryText}
                        onExecute={executeQuery}
                        placeholder="Enter SQL query..."
                        disabled={!db}
                        loading={loading}
                        showExpandButton={sidebarCollapsed}
                        onExpand={toggleSidebar}
                    />
                )}
            </SidebarContext.Consumer>

            {/* Error - shown where results would be */}
            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Error: {error}</Text>
                </View>
            )}

            {/* Results */}
            {results && (
                <View style={styles.resultsContainer}>
                    <TableViewer
                        columns={results.columns}
                        rows={results.rows}
                        totalRowCount={results.rows.length}
                        loading={loading}
                        error={null}
                        page={page}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                        sortDisabled={false}
                        filterText={filterText}
                        onFilterChange={setFilterText}
                        filterDisabled={false}
                        visibleColumns={visibleColumns}
                        onToggleColumnVisibility={handleToggleColumnVisibility}
                        columnOrder={columnOrder}
                        onColumnOrderChange={setColumnOrder}
                        columnWidths={columnWidths}
                        onColumnWidthsChange={setColumnWidths}
                    />
                </View>
            )}
        </DatabaseBrowserLayout>
    );
}

const styles = StyleSheet.create({
    errorContainer: {
        backgroundColor: '#ffebee',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    errorText: {
        color: '#c62828',
        fontSize: 14,
        fontFamily: 'monospace',
    },
    resultsContainer: {
        flex: 1,
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
    backButton: {
        marginTop: 12,
        padding: 12,
        backgroundColor: '#667eea',
        borderRadius: 6,
        alignItems: 'center',
    },
    backButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});

