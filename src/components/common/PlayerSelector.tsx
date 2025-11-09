import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { IconButton, Text, Menu, Dialog, Portal, Button, TextInput, useTheme, Surface } from 'react-native-paper';
import { Player } from '../../types';
import { getAllUsers, saveUser, saveCurrentUserName, getCurrentUserName, generateUserId, User } from '../../services/storage/userStorage';
import { getShadowStyle } from '../../utils';

interface PlayerSelectorProps {
  players: Player[];
  onPlayersChange: (players: Player[]) => void;
}

export default function PlayerSelector({
  players,
  onPlayersChange,
}: PlayerSelectorProps) {
  const theme = useTheme();
  const [knownUsers, setKnownUsers] = useState<User[]>([]);
  const [addPlayerMenuVisible, setAddPlayerMenuVisible] = useState(false);
  const [playerNameDialog, setPlayerNameDialog] = useState({ visible: false, playerId: '', isEditing: false });
  const [newPlayerName, setNewPlayerName] = useState('');
  const [errorDialog, setErrorDialog] = useState({ visible: false, title: '', message: '' });
  const [warningDialog, setWarningDialog] = useState({ visible: false, message: '' });

  // Load known users
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const loadedUsers = await getAllUsers();
        setKnownUsers(loadedUsers);
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };

    loadUsers();
  }, []);

  const handleEditPlayer = useCallback(async (playerId: string) => {
    const player = players.find((p) => p.id === playerId);
    if (player) {
      setNewPlayerName(player.name);
      setPlayerNameDialog({ visible: true, playerId, isEditing: true });
    }
  }, [players]);

  const handleConfirmAddPlayer = useCallback(async () => {
    if (newPlayerName.trim()) {
      if (playerNameDialog.isEditing && playerNameDialog.playerId) {
        const updatedName = newPlayerName.trim();
        const player = players.find((p) => p.id === playerNameDialog.playerId);
        
        // Check if this is the "You" player (first player, ID is 'player_1', or name matches current user)
        const currentUserName = await getCurrentUserName();
        const isCurrentUser = 
          playerNameDialog.playerId === 'player_1' || 
          player?.name === 'You' || 
          (players.length > 0 && players[0].id === playerNameDialog.playerId) ||
          (currentUserName && player?.name === currentUserName);
        
        if (isCurrentUser) {
          // Save to current user storage
          await saveCurrentUserName(updatedName);
        }
        
        const updatedPlayers = players.map((p) =>
          p.id === playerNameDialog.playerId
            ? { ...p, name: updatedName }
            : p
        );
        onPlayersChange(updatedPlayers);
      } else {
        const newPlayer: Player = {
          id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: newPlayerName.trim(),
        };
        onPlayersChange([...players, newPlayer]);
        
        // Save to known users
        const newUser: User = {
          id: generateUserId(),
          name: newPlayerName.trim(),
        };
        await saveUser(newUser);
        
        // Reload known users
        const updatedUsers = await getAllUsers();
        setKnownUsers(updatedUsers);
      }
      setNewPlayerName('');
    }
    setPlayerNameDialog({ visible: false, playerId: '', isEditing: false });
  }, [newPlayerName, playerNameDialog.isEditing, playerNameDialog.playerId, players, onPlayersChange]);

  const handleRemovePlayer = useCallback((playerId: string) => {
    if (players.length === 1) {
      setWarningDialog({ visible: true, message: 'You must have at least one player' });
      return;
    }
    onPlayersChange(players.filter((p) => p.id !== playerId));
  }, [players, onPlayersChange]);

  return (
    <>
      <View style={styles.playersSection}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Players
          </Text>
          <Menu
            visible={addPlayerMenuVisible}
            onDismiss={() => setAddPlayerMenuVisible(false)}
            anchor={
              <Button
                mode="text"
                icon="account-plus"
                onPress={() => setAddPlayerMenuVisible(true)}
                textColor={theme.colors.primary}
                compact
              >
                Add
              </Button>
            }
          >
            {knownUsers
              .filter((user) => !user.isCurrentUser) // Exclude current user from list
              .map((user) => (
                <Menu.Item
                  key={user.id}
                  onPress={async () => {
                    const newPlayer: Player = {
                      id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                      name: user.name,
                    };
                    onPlayersChange([...players, newPlayer]);
                    setAddPlayerMenuVisible(false);
                  }}
                  title={user.name}
                />
              ))}
            <Menu.Item
              onPress={() => {
                setNewPlayerName('');
                setPlayerNameDialog({ visible: true, playerId: '', isEditing: false });
                setAddPlayerMenuVisible(false);
              }}
              title="+ Add New Player"
              titleStyle={{ color: theme.colors.primary }}
            />
          </Menu>
        </View>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.playersList}
        >
          {players.map((player) => (
            <TouchableOpacity
              key={player.id}
              onPress={() => handleEditPlayer(player.id)}
              activeOpacity={0.7}
            >
              <Surface 
                style={[
                  styles.playerChip, 
                  { backgroundColor: theme.colors.surfaceVariant },
                  getShadowStyle(1),
                ]}
              >
                <Text style={[styles.playerName, { color: theme.colors.onSurfaceVariant }]}>
                  {player.name}
                </Text>
                {players.length > 1 && (
                  <IconButton
                    icon="close"
                    size={18}
                    iconColor={theme.colors.onSurfaceVariant}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleRemovePlayer(player.id);
                    }}
                    style={styles.removePlayerButton}
                  />
                )}
              </Surface>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Add/Edit Player Dialog */}
      <Portal>
        <Dialog
          visible={playerNameDialog.visible}
          onDismiss={() => setPlayerNameDialog({ visible: false, playerId: '', isEditing: false })}
        >
          <Dialog.Title>{playerNameDialog.isEditing ? 'Edit Player' : 'Add Player'}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Player Name"
              value={newPlayerName}
              onChangeText={setNewPlayerName}
              mode="outlined"
              style={styles.dialogInput}
              placeholder="Enter player name"
              autoFocus
              onSubmitEditing={handleConfirmAddPlayer}
              returnKeyType="done"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setPlayerNameDialog({ visible: false, playerId: '', isEditing: false })}
            >
              Cancel
            </Button>
            <Button onPress={handleConfirmAddPlayer} mode="contained">
              {playerNameDialog.isEditing ? 'Save' : 'Add'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Error Dialog */}
      <Portal>
        <Dialog
          visible={errorDialog.visible}
          onDismiss={() => setErrorDialog({ visible: false, title: '', message: '' })}
        >
          <Dialog.Title>{errorDialog.title}</Dialog.Title>
          <Dialog.Content>
            <Text>{errorDialog.message}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setErrorDialog({ visible: false, title: '', message: '' })}>
              OK
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Warning Dialog */}
      <Portal>
        <Dialog
          visible={warningDialog.visible}
          onDismiss={() => setWarningDialog({ visible: false, message: '' })}
        >
          <Dialog.Title>Warning</Dialog.Title>
          <Dialog.Content>
            <Text>{warningDialog.message}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setWarningDialog({ visible: false, message: '' })}>
              OK
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  playersSection: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  playersList: {
    gap: 12,
    paddingRight: 24,
    paddingVertical: 4,
  },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 24,
    gap: 6,
    margin: 2,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '500',
  },
  removePlayerButton: {
    margin: 0,
  },
  dialogInput: {
    marginBottom: 16,
  },
});

