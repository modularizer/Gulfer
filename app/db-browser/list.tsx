/**
 * Database Browser - List Page
 * 
 * Lists all available databases and allows selecting one to view.
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
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { listDatabasesWeb, registerDatabaseName, getDatabaseMetadata, deleteDatabaseByName, type DatabaseMetadata } from '../../storage/adapters';

interface DatabaseInfo {
  name: string;
  metadata: DatabaseMetadata | null;
  loading: boolean;
}

export default function DbBrowserList() {
  const router = useRouter();
  const [availableDatabases, setAvailableDatabases] = useState<DatabaseInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [newDbName, setNewDbName] = useState('');

  useEffect(() => {
    loadAvailableDatabases();
    
    // Poll for new databases periodically
    const interval = setInterval(() => {
      loadAvailableDatabases();
    }, 2000); // Check every 2 seconds
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  const loadAvailableDatabases = async () => {
    try {
      const databaseNames = await listDatabasesWeb();
      
      // Update state, refetching metadata but only updating if it changed
      setAvailableDatabases(prev => {
        const existingMap = new Map(prev.map(db => [db.name, db]));
        const newDatabases: DatabaseInfo[] = databaseNames.map(name => {
          const existing = existingMap.get(name);
          // Mark as loading if we need to fetch metadata
          return {
            name,
            metadata: existing?.metadata || null,
            loading: existing?.metadata === null,
          };
        });
        
        // Always refetch metadata for all databases (but use cached connections)
        Promise.all(
          newDatabases.map(async (db) => {
            try {
              const metadata = await getDatabaseMetadata(db.name);
              // Only update state if metadata actually changed
              setAvailableDatabases(current => {
                const existing = current.find(d => d.name === db.name);
                const metadataChanged = !existing?.metadata || 
                  existing.metadata.tableCount !== metadata.tableCount ||
                  existing.metadata.totalRowCount !== metadata.totalRowCount;
                
                // Only update if metadata changed or was missing
                if (metadataChanged || !existing?.metadata) {
                  return current.map(d => 
                    d.name === db.name 
                      ? { ...d, metadata, loading: false }
                      : d
                  );
                }
                // No change, return same array reference to avoid re-render
                return current;
              });
            } catch (err) {
              console.error(`Error loading metadata for ${db.name}:`, err);
              setAvailableDatabases(current => {
                const existing = current.find(d => d.name === db.name);
                const defaultMetadata = { tableCount: 0, totalRowCount: 0 };
                const metadataChanged = !existing?.metadata || 
                  existing.metadata.tableCount !== defaultMetadata.tableCount ||
                  existing.metadata.totalRowCount !== defaultMetadata.totalRowCount;
                
                if (metadataChanged || !existing?.metadata) {
                  return current.map(d => 
                    d.name === db.name 
                      ? { ...d, metadata: defaultMetadata, loading: false }
                      : d
                  );
                }
                return current;
              });
            }
          })
        );
        
        return newDatabases;
      });
    } catch (err) {
      console.error('Error loading databases:', err);
    }
  };

  const handleSelectDatabase = (name: string) => {
    router.push(`/db-browser/${encodeURIComponent(name)}`);
  };

  const handleConnectToNewDatabase = () => {
    if (newDbName.trim()) {
      const name = newDbName.trim();
      registerDatabaseName(name);
      setNewDbName('');
      router.push(`/db-browser/${encodeURIComponent(name)}`);
    }
  };

  const handleDeleteDatabase = async (name: string, event: any) => {
    event.stopPropagation(); // Prevent selecting the database
    
    Alert.alert(
      'Delete Database',
      `Delete database "${name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await deleteDatabaseByName(name);
              // Reload the list
              await loadAvailableDatabases();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : String(err));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.selectorHeader}>
        <Text style={styles.selectorTitle}>Select Database</Text>
        <TouchableOpacity
          style={styles.refreshButtonSmall}
          onPress={loadAvailableDatabases}
          disabled={loading}
        >
          <Text style={styles.refreshButtonTextSmall}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.databaseListCompact}>
        {availableDatabases.length === 0 && (
          <Text style={styles.emptyTextSmall}>No databases found</Text>
        )}
        <View style={styles.databaseGrid}>
          {availableDatabases.map((dbInfo) => (
            <View key={dbInfo.name} style={styles.databaseItemCompact}>
              <TouchableOpacity
                style={styles.databaseItemContent}
                onPress={() => handleSelectDatabase(dbInfo.name)}
              >
                <Text style={styles.databaseItemTextCompact} numberOfLines={1}>
                  {dbInfo.name}
                </Text>
                {dbInfo.loading ? (
                  <ActivityIndicator size="small" color="#667eea" />
                ) : dbInfo.metadata ? (
                  <Text style={styles.databaseItemMetadataCompact}>
                    {dbInfo.metadata.tableCount}t • {dbInfo.metadata.totalRowCount.toLocaleString()}r
                  </Text>
                ) : null}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={(e) => handleDeleteDatabase(dbInfo.name, e)}
                disabled={loading}
              >
                <Text style={styles.deleteButtonText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={styles.newDatabaseSectionCompact}>
          <View style={styles.newDatabaseInputCompact}>
            <TextInput
              style={styles.textInputCompact}
              placeholder="New database name"
              value={newDbName}
              onChangeText={setNewDbName}
              onSubmitEditing={handleConnectToNewDatabase}
            />
            <TouchableOpacity
              style={styles.connectButtonCompact}
              onPress={handleConnectToNewDatabase}
              disabled={!newDbName.trim() || loading}
            >
              <Text style={styles.connectButtonTextCompact}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  selectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },
  selectorTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  refreshButtonSmall: {
    backgroundColor: '#667eea',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  refreshButtonTextSmall: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  databaseListCompact: {
    flex: 1,
    padding: 8,
  },
  databaseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  databaseItemCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    width: '48%',
    minWidth: 150,
  },
  databaseItemContent: {
    flex: 1,
    flexDirection: 'column',
  },
  databaseItemTextCompact: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
    marginBottom: 2,
  },
  databaseItemMetadataCompact: {
    fontSize: 10,
    color: '#666',
  },
  deleteButton: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  deleteButtonText: {
    fontSize: 20,
    color: '#f44336',
    fontWeight: 'bold',
    lineHeight: 20,
  },
  newDatabaseSectionCompact: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  newDatabaseInputCompact: {
    flexDirection: 'row',
    gap: 6,
  },
  textInputCompact: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    padding: 8,
    fontSize: 13,
    backgroundColor: '#fff',
  },
  connectButtonCompact: {
    backgroundColor: '#667eea',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 4,
    justifyContent: 'center',
    minWidth: 40,
  },
  connectButtonTextCompact: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  emptyTextSmall: {
    color: '#999',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
});

