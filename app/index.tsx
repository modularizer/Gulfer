/**
 * Database Test Page
 * 
 * Standalone React Native page to test the storage system.
 * Only imports from the storage/ module.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { runGolfTest, runBasicPgliteTest } from '../storage/tests/golf';
import { deleteDatabaseByName } from '../xp-deeby/adapters';
import { useRouter } from 'expo-router';

interface LogEntry {
  type: 'log' | 'error' | 'success';
  message: string;
  timestamp: Date;
}

export default function DbTestPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const addLog = (message: string, type: 'log' | 'error' | 'success' = 'log') => {
    setLogs(prev => [...prev, { type, message, timestamp: new Date() }]);
  };

  const runTest = async () => {
    setIsRunning(true);
    setIsComplete(false);
    setLogs([]);

    try {
      await runGolfTest(addLog);
      setIsComplete(true);
    } catch (error) {
      addLog('❌ Test failed:', 'error');
      if (error instanceof Error) {
        addLog(`   Error message: ${error.message}`, 'error');
        if (error.stack) {
          addLog(`   Stack: ${error.stack}`, 'error');
        }
      } else {
        addLog(`   Error: ${JSON.stringify(error)}`, 'error');
      }
    } finally {
      setIsRunning(false);
    }
  };

  const runBasicTest = async () => {
    setIsRunning(true);
    setIsComplete(false);
    setLogs([]);

    try {
      await runBasicPgliteTest(addLog);
      setIsComplete(true);
    } catch (error) {
      addLog('❌ Test failed:', 'error');
      if (error instanceof Error) {
        addLog(`   Error message: ${error.message}`, 'error');
        if (error.stack) {
          addLog(`   Stack: ${error.stack}`, 'error');
        }
      } else {
        addLog(`   Error: ${JSON.stringify(error)}`, 'error');
      }
    } finally {
      setIsRunning(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setIsComplete(false);
  };

  const deleteDatabase = async () => {
    if (isRunning) return;
    
    try {
      setIsRunning(true);
      addLog('🗑️  Deleting database...', 'log');
      await deleteDatabaseByName('gulfer-test');
      addLog('✅ Database deleted successfully!', 'success');
      setLogs([]);
      setIsComplete(false);
    } catch (error) {
      addLog('❌ Failed to delete database:', 'error');
      if (error instanceof Error) {
        addLog(`   Error: ${error.message}`, 'error');
      } else {
        addLog(`   Error: ${JSON.stringify(error)}`, 'error');
      }
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Database Test</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, isRunning && styles.buttonDisabled]}
            onPress={runBasicTest}
            disabled={isRunning}
          >
            <Text style={styles.buttonText}>
              {isRunning ? 'Running...' : 'Basic Test'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary, isRunning && styles.buttonDisabled]}
            onPress={runTest}
            disabled={isRunning}
          >
            <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
              Full Test
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={clearLogs}
            disabled={isRunning}
          >
            <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
              Clear
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.buttonDanger]}
            onPress={deleteDatabase}
            disabled={isRunning}
          >
            <Text style={[styles.buttonText, styles.buttonTextDanger]}>
              Delete DB
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={() => router.push('/db-browser')}
            disabled={isRunning}
          >
            <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
              Browse DB
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {isRunning && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Running test...</Text>
        </View>
      )}

      {isComplete && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusSuccess}>✅ Test completed successfully!</Text>
        </View>
      )}

      <ScrollView style={styles.logContainer} contentContainerStyle={styles.logContent}>
        {logs.length === 0 && !isRunning && (
          <Text style={styles.emptyText}>Click "Run Test" to start</Text>
        )}
        {logs.map((log, index) => (
          <Text
            key={index}
            style={[
              styles.logLine,
              log.type === 'error' && styles.errorLine,
              log.type === 'success' && styles.successLine,
            ]}
          >
            {log.message}
          </Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  button: {
    backgroundColor: '#667eea',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    minWidth: 120,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#667eea',
  },
  buttonDanger: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f44336',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonTextSecondary: {
    color: '#667eea',
  },
  buttonTextDanger: {
    color: '#f44336',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  statusContainer: {
    padding: 15,
    backgroundColor: '#e8f5e9',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statusSuccess: {
    color: '#2e7d32',
    fontWeight: '500',
    textAlign: 'center',
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  logContent: {
    padding: 15,
  },
  logLine: {
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 4,
    color: '#d4d4d4',
  },
  errorLine: {
    color: '#f48771',
    fontWeight: '500',
  },
  successLine: {
    color: '#4ec9b0',
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    fontStyle: 'italic',
    marginTop: 20,
    fontSize: 14,
  },
});
