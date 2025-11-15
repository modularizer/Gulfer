/**
 * Database Browser - Detail Page
 * 
 * Displays tables and data for a specific database.
 */

import React, { useState, useEffect } from 'react';
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
import { getDatabaseByName, getTableNames, getAdapterByType, registerDatabaseName } from '../../storage/adapters';
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

interface TableData {
  name: string;
  columns: string[];
  rows: any[];
  rowCount: number;
}

export default function DbBrowserDetail() {
  const router = useRouter();
  const { dbname } = useLocalSearchParams<{ dbname: string }>();
  const dbName = dbname ? decodeURIComponent(dbname) : null;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [db, setDb] = useState<any>(null);

  useEffect(() => {
    if (dbName) {
      loadDatabase(dbName);
    }
  }, [dbName]);

  const loadDatabase = async (name: string) => {
    try {
      setLoading(true);
      setError(null);
      setTableData(null);
      setSelectedTable(null);
      
      // Register the database name so it appears in the list
      registerDatabaseName(name);
      
      // Set the adapter type to match what the test uses
      await getAdapterByType('pglite');
      // Connect to existing database (don't set up schema)
      const database = await getDatabaseByName(name);
      setDb(database);
      
      const tableNames = await getTableNames(database);
      setTables(tableNames);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const loadTableData = async (tableName: string) => {
    if (!db) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const table = getTableSchema(tableName);
      
      let rows: any[] = [];
      let rowCount = 0;
      
      if (!table) {
        setError(`Table "${tableName}" not found in schema. Only tables defined in our schema can be browsed.`);
        setLoading(false);
        return;
      }
      
      // Use Drizzle query builder
      rows = await db.select().from(table).limit(100);
      
      // Get total count using Drizzle (fetch all to count, but limit display)
      const allRows = await db.select().from(table);
      rowCount = allRows.length;
      
      // Get column names from the first row
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      
      setTableData({
        name: tableName,
        columns,
        rows,
        rowCount: typeof rowCount === 'number' ? rowCount : parseInt(String(rowCount), 10),
      });
      setSelectedTable(tableName);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return String(value);
  };

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
          style={styles.backButton}
          onPress={() => router.push('/db-browser/list')}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Database Browser</Text>
        <Text style={styles.subtitle}>Database: {dbName}</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => dbName && loadDatabase(dbName)}
            disabled={loading}
          >
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      )}

      {loading && !tableData && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.sidebar}>
          <Text style={styles.sidebarTitle}>Tables ({tables.length})</Text>
          <ScrollView style={styles.tableList}>
            {tables.map((table) => (
              <TouchableOpacity
                key={table}
                style={[
                  styles.tableItem,
                  selectedTable === table && styles.tableItemSelected,
                ]}
                onPress={() => loadTableData(table)}
              >
                <Text
                  style={[
                    styles.tableItemText,
                    selectedTable === table && styles.tableItemTextSelected,
                  ]}
                >
                  {table}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.mainContent}>
          {tableData ? (
            <>
              <View style={styles.tableHeader}>
                <Text style={styles.tableName}>{tableData.name}</Text>
                <Text style={styles.tableCount}>
                  {tableData.rowCount} row{tableData.rowCount !== 1 ? 's' : ''}
                  {tableData.rows.length < tableData.rowCount && ` (showing first ${tableData.rows.length})`}
                </Text>
              </View>
              <ScrollView horizontal style={styles.tableScroll}>
                <View style={styles.table}>
                  <View style={styles.tableRowHeader}>
                    {tableData.columns.map((col) => (
                      <View key={col} style={styles.tableCellHeader}>
                        <Text style={styles.tableCellHeaderText}>{col}</Text>
                      </View>
                    ))}
                  </View>
                  {tableData.rows.map((row, rowIndex) => (
                    <View key={rowIndex} style={styles.tableRow}>
                      {tableData.columns.map((col) => (
                        <View key={col} style={styles.tableCell}>
                          <Text style={styles.tableCellText} numberOfLines={2}>
                            {formatValue(row[col])}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                  {tableData.rows.length === 0 && (
                    <View style={styles.emptyRow}>
                      <Text style={styles.emptyText}>No rows found</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Select a table from the sidebar to view its data
              </Text>
            </View>
          )}
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
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 5,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  refreshButton: {
    backgroundColor: '#667eea',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  backButton: {
    backgroundColor: '#999',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
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
  sidebarTitle: {
    padding: 15,
    fontSize: 16,
    fontWeight: '600',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tableList: {
    flex: 1,
  },
  tableItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tableItemSelected: {
    backgroundColor: '#667eea',
  },
  tableItemText: {
    fontSize: 14,
    color: '#333',
  },
  tableItemTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  mainContent: {
    flex: 1,
    backgroundColor: '#fff',
  },
  tableHeader: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },
  tableName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
  },
  tableCount: {
    fontSize: 14,
    color: '#666',
  },
  tableScroll: {
    flex: 1,
  },
  table: {
    minWidth: '100%',
  },
  tableRowHeader: {
    flexDirection: 'row',
    backgroundColor: '#667eea',
    borderBottomWidth: 2,
    borderBottomColor: '#5568d3',
  },
  tableCellHeader: {
    padding: 12,
    minWidth: 120,
    borderRightWidth: 1,
    borderRightColor: '#5568d3',
  },
  tableCellHeaderText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tableCell: {
    padding: 12,
    minWidth: 120,
    borderRightWidth: 1,
    borderRightColor: '#f0f0f0',
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

