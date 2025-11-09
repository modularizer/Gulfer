import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { IconButton, Text, Menu, Dialog, Portal, Button, useTheme, Surface } from 'react-native-paper';
import { Player } from '../../types';
import { getAllUsers, saveUser, saveCurrentUserName, getCurrentUserName, generateUserId, getUserIdForPlayerName, User } from '../../services/storage/userStorage';
import { getShadowStyle } from '../../utils';
import NameUsernameDialog from './NameUsernameDialog';

interface PlayerSelectorProps {
  players: Player[];
  onPlayersChange: (players: Player[]) => void;
  hideHeader?: boolean;
}

export default function PlayerSelector({
  players,
  onPlayersChange,
  hideHeader = false,
}: PlayerSelectorProps) {
  const theme = useTheme();
  const [knownUsers, setKnownUsers] = useState<User[]>([]);
  const [addPlayerMenuVisible, setAddPlayerMenuVisible] = useState(false);
  const [playerDialog, setPlayerDialog] = useState({ visible: false, playerId: '', isEditing: false, initialName: '', initialUsername: '', excludeUserId: undefined as string | undefined });
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

  const handleEditPlayer = useCallback(async (playerId: number) => {
    const player = players.find((p) => p.id === playerId);
    if (player) {
      setPlayerDialog({ 
        visible: true, 
        playerId: playerId.toString(), 
        isEditing: true,
        initialName: player.name,
        initialUsername: '', // Deprecated, no longer used
        excludeUserId: undefined,
      });
    }
  }, [players]);

  const handleSavePlayer = useCallback(async (name: string, username: string) => {
    // username parameter is ignored, but kept for backward compatibility
    if (playerDialog.isEditing && playerDialog.playerId) {
      const player = players.find((p) => p.id === parseInt(playerDialog.playerId, 10));
      
      // Check if this is the "You" player (name matches current user)
      const currentUserName = await getCurrentUserName();
      const isCurrentUser = 
        player?.name === 'You' || 
        (currentUserName && player?.name === currentUserName);
      
      if (isCurrentUser) {
        // Save to current user storage
        await saveCurrentUserName(name);
      }
      
      // Update player with new name
      const updatedPlayers = players.map((p) => {
        if (p.id === parseInt(playerDialog.playerId, 10)) {
          return { ...p, name };
        }
        return p;
      });
      onPlayersChange(updatedPlayers);
    } else {
      // Save to known users first
      const playerId = await getUserIdForPlayerName(name);
      const newUser: User = {
        id: playerId,
        name,
      };
      await saveUser(newUser);
      
      const newPlayer: Player = {
        id: playerId,
        name,
      };
      onPlayersChange([...players, newPlayer]);
      
      // Reload known users
      const updatedUsers = await getAllUsers();
      setKnownUsers(updatedUsers);
    }
    setPlayerDialog({ visible: false, playerId: '', isEditing: false, initialName: '', initialUsername: '', excludeUserId: undefined });
  }, [playerDialog.isEditing, playerDialog.playerId, players, onPlayersChange]);

  const handleRemovePlayer = useCallback((playerId: number) => {
    if (players.length === 1) {
      setWarningDialog({ visible: true, message: 'You must have at least one player' });
      return;
    }
    onPlayersChange(players.filter((p) => p.id !== playerId));
  }, [players, onPlayersChange]);

  const handleAddPlayerPress = useCallback(() => {
    // Filter out current user and players already in the current round
    const unusedUsers = knownUsers.filter(
      (user) => !user.isCurrentUser && !players.some((p) => p.name === user.name)
    );

    // If there are no unused known players, directly open the dialog
    if (unusedUsers.length === 0) {
      setPlayerDialog({ visible: true, playerId: '', isEditing: false, initialName: '', initialUsername: '', excludeUserId: undefined });
    } else {
      // Otherwise, show the menu with known players
      setAddPlayerMenuVisible(true);
    }
  }, [knownUsers, players]);

  const addPlayerMenu = (
    <Menu
      visible={addPlayerMenuVisible}
      onDismiss={() => setAddPlayerMenuVisible(false)}
      anchor={
        <Button
          mode="text"
          icon="account-plus"
          onPress={handleAddPlayerPress}
          textColor={theme.colors.primary}
          compact
        >
          Add
        </Button>
      }
    >
      {knownUsers
        .filter((user) => !user.isCurrentUser && !players.some((p) => p.name === user.name)) // Exclude current user and players already in round
        .map((user) => (
          <Menu.Item
            key={user.id}
            onPress={async () => {
              const newPlayer: Player = {
                id: user.id,
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
          setPlayerDialog({ visible: true, playerId: '', isEditing: false, initialName: '', initialUsername: '', excludeUserId: undefined });
          setAddPlayerMenuVisible(false);
        }}
        title="+ Add New Player"
        titleStyle={{ color: theme.colors.primary }}
      />
    </Menu>
  );

  return (
    <>
      <View style={styles.playersSection}>
        {!hideHeader && (
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Players
            </Text>
            {addPlayerMenu}
          </View>
        )}
        {hideHeader && (
          <View style={styles.addButtonContainer}>
            {addPlayerMenu}
          </View>
        )}
        
        {!hideHeader && (
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
        )}
      </View>

      {/* Add/Edit Player Dialog */}
      <NameUsernameDialog
        visible={playerDialog.visible}
        title={playerDialog.isEditing ? 'Edit Player' : 'Add Player'}
        nameLabel="Player Name"
        initialName={playerDialog.initialName}
        initialUsername={playerDialog.initialUsername}
        excludeUserId={playerDialog.excludeUserId}
        onDismiss={() => setPlayerDialog({ visible: false, playerId: '', isEditing: false, initialName: '', initialUsername: '', excludeUserId: undefined })}
        onSave={handleSavePlayer}
      />

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
  addButtonContainer: {
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
});

