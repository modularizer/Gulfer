/**
 * Database Browser - Detail Page
 * 
 * Displays tables and data for a specific database.
 */

import React, { useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getDatabaseByName, getTableNames, getAdapterByType, registerDatabaseName, getDatabaseRegistryEntries } from '../../storage/adapters';
import * as schema from '../../storage/schema/generic-sports-data/tables';
import * as accountsSchema from '../../storage/schema/accounts/schema/tables';

// Map table names to their schema objects
const getTableSchema = (tableName: string): any => {
  // Generic sports data tables
  const sportsTableMap: Record<string, any> = {
    sports: schema.sports,
    score_formats: schema.scoreFormats,
    event_formats: schema.eventFormats,
    event_format_stages: schema.eventFormatStages,
    venues: schema.venues,
    venue_event_formats: schema.venueEventFormats,
    venue_event_format_stages: schema.venueEventFormatStages,
    events: schema.events,
    event_stages: schema.eventStages,
    participants: schema.participants,
    event_participants: schema.eventParticipants,
    participant_event_stage_scores: schema.participantEventStageScores,
    team_members: schema.teamMembers,
    photos: schema.photos,
  };
  
  // Accounts tables
  const accountsTableMap: Record<string, any> = {
    accounts: accountsSchema.accounts,
    account_settings: accountsSchema.accountSettings,
    account_setting_options: accountsSchema.accountSettingOptions,
  };
  
  return sportsTableMap[tableName] || accountsTableMap[tableName] || null;
};

export default function DbBrowserDetail() {
  const router = useRouter();
  const { dbname } = useLocalSearchParams<{ dbname: string }>();
  const dbName = dbname ? decodeURIComponent(dbname) : null;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [tableRowCounts, setTableRowCounts] = useState<Record<string, number>>({});
  const [db, setDb] = useState<any>(null);

  const loadTableRowCounts = useCallback(async (database: any, tableNames: string[]) => {
    if (!database || tableNames.length === 0) return;
    
    try {
      console.log(`[db-browser] Loading row counts for ${tableNames.length} tables...`);
      const counts: Record<string, number> = {};
      
      // Get row counts for all tables in parallel
      await Promise.all(
        tableNames.map(async (tableName) => {
          try {
            const countResult = await database.execute(sql.raw(`
              SELECT COUNT(*) as count FROM "${tableName}"
            `)) as any[];
            
            const count = countResult[0]?.count || countResult[0]?.['count'] || countResult[0]?.[0] || 0;
            counts[tableName] = typeof count === 'number' ? count : parseInt(String(count), 10);
            console.log(`[db-browser] Table ${tableName}: ${counts[tableName]} rows`);
          } catch (err) {
            console.warn(`[db-browser] Could not get row count for ${tableName}:`, err);
            counts[tableName] = 0;
          }
        })
      );
      
      console.log(`[db-browser] Row counts loaded:`, counts);
      setTableRowCounts(counts);
    } catch (err) {
      console.error(`[db-browser] Error loading row counts:`, err);
      // Don't fail the whole load, just set empty counts
      setTableRowCounts({});
    }
  }, []);

  const loadDatabase = useCallback(async (name: string) => {
    try {
      console.log(`[db-browser] Loading database: ${name}`);
      setLoading(true);
      setError(null);
      
      // Get adapter type from registry
      console.log(`[db-browser] Getting registry entries...`);
      const entries = await getDatabaseRegistryEntries();
      console.log(`[db-browser] Registry entries:`, entries);
      const entry = entries.find(e => e.name === name);
      console.log(`[db-browser] Found entry for ${name}:`, entry);
      
      if (!entry) {
        const errorMsg = `Database ${name} not found in registry. Please run a test first to create the database.`;
        console.error(`[db-browser] ${errorMsg}`);
        setError(errorMsg);
        setLoading(false);
        return;
      }
      
      // Use the exact adapter type from registry
      console.log(`[db-browser] Getting adapter type: ${entry.adapterType}`);
      const adapter = await getAdapterByType(entry.adapterType);
      console.log(`[db-browser] Adapter obtained:`, adapter);
      console.log(`[db-browser] Adapter capabilities:`, adapter.getCapabilities());
      
      // Connect to existing database using the correct adapter
      if (!adapter.getDatabaseByName) {
        const errorMsg = `Adapter ${entry.adapterType} does not support getDatabaseByName`;
        console.error(`[db-browser] ${errorMsg}`);
        setError(errorMsg);
        setLoading(false);
        return;
      }
      console.log(`[db-browser] Connecting to database ${name}...`);
      const database = await adapter.getDatabaseByName(name);
      console.log(`[db-browser] Database connection obtained:`, database);
      setDb(database);
      
      // Get table names using the correct adapter
      if (!adapter.getTableNames) {
        const errorMsg = `Adapter ${entry.adapterType} does not support getTableNames`;
        console.error(`[db-browser] ${errorMsg}`);
        setError(errorMsg);
        setLoading(false);
        return;
      }
      console.log(`[db-browser] Getting table names...`);
      const tableNames = await adapter.getTableNames(database);
      console.log(`[db-browser] Table names retrieved:`, tableNames);
      console.log(`[db-browser] Table count: ${tableNames.length}`);
      setTables(tableNames);
      
      // Get row counts for all tables
      await loadTableRowCounts(database, tableNames);
    } catch (err) {
      console.error(`[db-browser] Error loading database:`, err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [loadTableRowCounts]);

  useEffect(() => {
    if (dbName) {
      loadDatabase(dbName);
    }
  }, [dbName, loadDatabase]);

  // Removed loadTableData - navigation now goes to [table] route



  if (!dbName) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No database name provided</Text>
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
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.push('/db-browser/list')}
        >
          <Text style={styles.headerButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerTopRow}>
            <Text style={styles.headerDbName} numberOfLines={1}>{dbName}</Text>
            <Text style={styles.headerTableCount}>Tables ({tables.length})</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => dbName && loadDatabase(dbName)}
          disabled={loading}
        >
          <Text style={styles.headerButtonText}>↻</Text>
        </TouchableOpacity>
      </View>

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

      <View style={styles.content}>
        <View style={styles.sidebar}>
          <ScrollView style={styles.tableList}>
            {(() => {
              // Sort tables: non-empty first, then empty tables
              const sortedTables = [...tables].sort((a, b) => {
                const countA = tableRowCounts[a] ?? 0;
                const countB = tableRowCounts[b] ?? 0;
                // If both are empty or both have rows, maintain original order
                if ((countA === 0 && countB === 0) || (countA > 0 && countB > 0)) {
                  return 0;
                }
                // Empty tables go to bottom
                return countA === 0 ? 1 : -1;
              });
              
              return sortedTables.map((table) => {
                const rowCount = tableRowCounts[table] ?? null;
                const isEmpty = rowCount === 0;
                return (
                  <TouchableOpacity
                    key={table}
                    style={[
                      styles.tableItem,
                      isEmpty && styles.tableItemEmpty,
                    ]}
                    onPress={() => router.push(`/db-browser/${encodeURIComponent(dbName)}/${encodeURIComponent(table)}`)}
                  >
                    <View style={styles.tableItemContent}>
                      <Text
                      style={[
                        styles.tableItemText,
                        isEmpty && styles.tableItemTextEmpty,
                      ]}
                      >
                        {table}
                      </Text>
                      {rowCount !== null && (
                        <Text
                      style={[
                        styles.tableItemCount,
                        isEmpty && styles.tableItemCountEmpty,
                      ]}
                        >
                          {rowCount.toLocaleString()}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              });
            })()}
          </ScrollView>
        </View>

        <View style={styles.mainContent}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              Select a table from the sidebar to view its data
            </Text>
          </View>
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fafafa',
    gap: 12,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerDbName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  headerTableCount: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  headerTableName: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
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
  tableHeaderText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  emptyRow: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
    fontStyle: 'italic',
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
});

