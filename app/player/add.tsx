import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Button, Dialog, Portal, TextInput, useTheme, Text } from 'react-native-paper';
import { router } from 'expo-router';
import { User } from '@/services/storage/userStorage';
import { saveUser, generateUserId, getUserById } from '@/services/storage/userStorage';
import { importPlayer } from '@/services/playerExport';
import { ErrorDialog, ImportDialog } from '@/components/common';

export default function AddPlayerScreen() {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [errorDialog, setErrorDialog] = useState({ visible: false, title: '', message: '' });
  const [importDialogVisible, setImportDialogVisible] = useState(false);
  const [importText, setImportText] = useState('');

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setErrorDialog({ visible: true, title: 'Error', message: 'Player name is required' });
      return;
    }

    try {
      const newUser: User = {
        id: await generateUserId(),
        name: name.trim(),
      };

      await saveUser(newUser);
      const { encodeNameForUrl } = await import('@/utils/urlEncoding');
      router.push(`/player/${encodeNameForUrl(newUser.name)}/overview`);
    } catch (error) {
      console.error('Error saving player:', error);
      setErrorDialog({ visible: true, title: 'Error', message: 'Failed to save player' });
    }
  }, [name]);

  const handleImport = useCallback(async () => {
    if (!importText.trim()) {
      Alert.alert('Error', 'Please paste the player export text');
      return;
    }

    try {
      const newPlayerId = await importPlayer(importText);
      setImportText('');
      setImportDialogVisible(false);
      const { encodeNameForUrl } = await import('@/utils/urlEncoding');
      const importedPlayer = await getUserById(newPlayerId);
      if (importedPlayer) {
        router.push(`/player/${encodeNameForUrl(importedPlayer.name)}/overview`);
      }
    } catch (error) {
      console.error('Error importing player:', error);
      setErrorDialog({
        visible: true,
        title: 'Import Error',
        message: error instanceof Error ? error.message : 'Failed to import player',
      });
    }
  }, [importText]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Button
          icon="arrow-left"
          onPress={() => router.back()}
          textColor={theme.colors.onSurface}
        >
          Back
        </Button>
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          Add Player
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <TextInput
          label="Player Name"
          value={name}
          onChangeText={setName}
          mode="outlined"
          style={styles.input}
          placeholder="Enter player name"
          autoFocus
        />
        <Button
          mode="contained"
          onPress={handleSave}
          style={styles.saveButton}
        >
          Save Player
        </Button>
        <Button
          mode="outlined"
          icon="import"
          onPress={() => setImportDialogVisible(true)}
          style={styles.importButton}
        >
          Import Player
        </Button>
      </View>

      <ImportDialog
        visible={importDialogVisible}
        title="Import Player"
        helpText="Paste the player export text below."
        importText={importText}
        onImportTextChange={setImportText}
        onDismiss={() => {
          setImportDialogVisible(false);
          setImportText('');
        }}
        onConfirm={handleImport}
      />

      <ErrorDialog
        visible={errorDialog.visible}
        title={errorDialog.title}
        message={errorDialog.message}
        onDismiss={() => setErrorDialog({ visible: false, title: '', message: '' })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerSpacer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    padding: 24,
  },
  input: {
    marginBottom: 16,
  },
  saveButton: {
    marginTop: 8,
  },
  importButton: {
    marginTop: 8,
  },
});

