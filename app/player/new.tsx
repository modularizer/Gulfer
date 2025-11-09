import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Dialog, Portal, TextInput, useTheme, Text } from 'react-native-paper';
import { router } from 'expo-router';
import { User } from '@/services/storage/userStorage';
import { saveUser, generateUserId } from '@/services/storage/userStorage';
import { ErrorDialog } from '@/components/common';

export default function NewPlayerScreen() {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [errorDialog, setErrorDialog] = useState({ visible: false, title: '', message: '' });

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
          New Player
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
      </View>

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
});

