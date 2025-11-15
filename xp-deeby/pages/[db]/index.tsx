/**
 * Database Browser - Detail Page
 *
 * Displays tables and data for a specific database.
 */

import React, { useState, useEffect, useCallback} from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {getAdapterByType, getRegistryEntries} from "../../adapters";
import {sql} from "drizzle-orm";
import DatabaseBrowserLayout from '../../components/DatabaseBrowserLayout';



export default function XpDeebyDatabase() {
    const router = useRouter();
    const { db: dbName_ } = useLocalSearchParams<{ db: string }>();
    const dbName = dbName_ ? decodeURIComponent(dbName_) : null;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tables, setTables] = useState<string[]>([]);

    // Load table list (just for count display, actual sidebar is handled by DatabaseBrowserLayout)
    const loadDatabase = useCallback(async (name: string) => {
        try {
            setLoading(true);
            setError(null);

            const entries = await getRegistryEntries();
            const entry = entries.find(e => e.name === name);

            if (!entry) {
                const errorMsg = `Database ${name} not found in registry.`;
                setError(errorMsg);
                setLoading(false);
                return;
            }

            const adapter = await getAdapterByType(entry.adapterType);

            if (!adapter.getDatabaseByName || !adapter.getTableNames) {
                const errorMsg = `Adapter ${entry.adapterType} does not support required operations`;
                setError(errorMsg);
                setLoading(false);
                return;
            }

            const database = await adapter.getDatabaseByName(name);
            const tableNames = await adapter.getTableNames(database);
            setTables(tableNames);
        } catch (err) {
            console.error(`[db-browser] Error loading database:`, err);
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

    // Redirect to table view - show first table if available, otherwise stay on index with empty state
    useEffect(() => {
        if (dbName && !loading) {
            if (tables.length > 0) {
                // Redirect to the first table
                router.replace(`/db-browser/${encodeURIComponent(dbName)}/${encodeURIComponent(tables[0])}`);
            }
            // If no tables, stay on index page (will show empty state)
        }
    }, [dbName, tables, loading, router]);

    // Removed loadTableData - navigation now goes to [table] route



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
            headerTitle={dbName}
            headerSubtitle={`Tables (${tables.length})`}
            onBack={() => router.push('/db-browser/list')}
        >
            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Error: {error}</Text>
                </View>
            )}

            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#667eea" />
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            )}

            {!loading && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>
                            Select a table from the sidebar to view its data
                        </Text>
                    <TouchableOpacity
                        style={styles.queryToolButton}
                        onPress={() => router.push(`/db-browser/${encodeURIComponent(dbName)}/query`)}
                    >
                        <Text style={styles.queryToolButtonText}>Open Query Tool</Text>
                    </TouchableOpacity>
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
        marginBottom: 20,
    },
    queryToolButton: {
        marginTop: 20,
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: '#667eea',
        borderRadius: 6,
        alignItems: 'center',
    },
    queryToolButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

