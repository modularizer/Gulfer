/**
 * Import Mapping Dialog
 * Concise modal for mapping foreign entities to local entities
 * One row per entity with a dropdown selector
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Dialog, Portal, Button, Text, useTheme, Menu } from 'react-native-paper';

interface EntityMapping {
  foreignId: string;
  foreignName: string;
  localId: string | null; // null = create new
  suggestedLocalId: string | null;
}

interface ImportMappingDialogProps {
  visible: boolean;
  foreignCourse: EntityMapping | null;
  foreignPlayers: EntityMapping[];
  localCourses: Array<{ id: string; name: string }>;
  localPlayers: Array<{ id: string; name: string }>;
  onDismiss: () => void;
  onConfirm: (mappings: {
    courseMapping?: { foreignCourseId: string; localCourseId: string | null };
    playerMappings: Array<{ foreignPlayerId: string; localPlayerId: string | null }>;
  }) => void;
}

export default function ImportMappingDialog({
  visible,
  foreignCourse,
  foreignPlayers,
  localCourses,
  localPlayers,
  onDismiss,
  onConfirm,
}: ImportMappingDialogProps) {
  const theme = useTheme();
  
  // Course mapping state
  const [courseLocalId, setCourseLocalId] = useState<string | null>(null);
  const [courseMenuVisible, setCourseMenuVisible] = useState(false);
  
  // Player mapping state
  const [playerLocalIds, setPlayerLocalIds] = useState<Map<string, string | null>>(new Map());
  const [playerMenuVisible, setPlayerMenuVisible] = useState<Map<string, boolean>>(new Map());

  // Initialize mappings when dialog opens
  useEffect(() => {
    if (visible) {
      // Initialize course mapping with suggestion
      if (foreignCourse) {
        setCourseLocalId(foreignCourse.suggestedLocalId);
      }
      
      // Initialize player mappings with suggestions
      const initialPlayerIds = new Map<string, string | null>();
      foreignPlayers.forEach(player => {
        initialPlayerIds.set(player.foreignId, player.suggestedLocalId);
      });
      setPlayerLocalIds(initialPlayerIds);
    }
  }, [visible, foreignCourse, foreignPlayers]);

  const getCourseDisplayName = (courseId: string | null): string => {
    if (!courseId) return 'Record as New Course';
    const course = localCourses.find(c => c.id === courseId);
    return course ? course.name : 'Unknown';
  };

  const getPlayerDisplayName = (playerId: string | null): string => {
    if (!playerId) return 'Record as New Player';
    const player = localPlayers.find(p => p.id === playerId);
    return player ? player.name : 'Unknown';
  };

  const handleConfirm = () => {
    const mappings: {
      courseMapping?: { foreignCourseId: string; localCourseId: string | null };
      playerMappings: Array<{ foreignPlayerId: string; localPlayerId: string | null }>;
    } = {
      playerMappings: Array.from(playerLocalIds.entries()).map(([foreignId, localId]) => ({
        foreignPlayerId: foreignId,
        localPlayerId: localId,
      })),
    };
    
    if (foreignCourse) {
      mappings.courseMapping = {
        foreignCourseId: foreignCourse.foreignId,
        localCourseId: courseLocalId,
      };
    }
    
    onConfirm(mappings);
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title>Map Imported Entities</Dialog.Title>
        <Dialog.Content style={styles.content}>
          {/* Course Mapping */}
          {foreignCourse && (
            <View style={styles.row}>
              <Text style={[styles.label, { color: theme.colors.onSurface }]} numberOfLines={1}>
                {foreignCourse.foreignName}
              </Text>
              <Menu
                visible={courseMenuVisible}
                onDismiss={() => setCourseMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setCourseMenuVisible(true)}
                    style={styles.dropdown}
                    contentStyle={styles.dropdownContent}
                  >
                    {getCourseDisplayName(courseLocalId)}
                  </Button>
                }
              >
                <Menu.Item
                  onPress={() => {
                    setCourseLocalId(null);
                    setCourseMenuVisible(false);
                  }}
                  title="Record as New Course"
                />
                {localCourses.map(course => (
                  <Menu.Item
                    key={course.id}
                    onPress={() => {
                      setCourseLocalId(course.id);
                      setCourseMenuVisible(false);
                    }}
                    title={course.name}
                  />
                ))}
              </Menu>
            </View>
          )}

          {/* Player Mappings */}
          {foreignPlayers.map(player => {
            const localId = playerLocalIds.get(player.foreignId) ?? null;
            const menuKey = `player-${player.foreignId}`;
            const isMenuVisible = playerMenuVisible.get(menuKey) || false;
            
            return (
              <View key={player.foreignId} style={styles.row}>
                <Text style={[styles.label, { color: theme.colors.onSurface }]} numberOfLines={1}>
                  {player.foreignName}
                </Text>
                <Menu
                  visible={isMenuVisible}
                  onDismiss={() => {
                    const newMap = new Map(playerMenuVisible);
                    newMap.set(menuKey, false);
                    setPlayerMenuVisible(newMap);
                  }}
                  anchor={
                    <Button
                      mode="outlined"
                      onPress={() => {
                        const newMap = new Map(playerMenuVisible);
                        newMap.set(menuKey, true);
                        setPlayerMenuVisible(newMap);
                      }}
                      style={styles.dropdown}
                      contentStyle={styles.dropdownContent}
                    >
                      {getPlayerDisplayName(localId)}
                    </Button>
                  }
                >
                  <Menu.Item
                    onPress={() => {
                      setPlayerLocalIds(prev => {
                        const newMap = new Map(prev);
                        newMap.set(player.foreignId, null);
                        return newMap;
                      });
                      const newMap = new Map(playerMenuVisible);
                      newMap.set(menuKey, false);
                      setPlayerMenuVisible(newMap);
                    }}
                    title="Record as New Player"
                  />
                  {localPlayers.map(localPlayer => (
                    <Menu.Item
                      key={localPlayer.id}
                      onPress={() => {
                        setPlayerLocalIds(prev => {
                          const newMap = new Map(prev);
                          newMap.set(player.foreignId, localPlayer.id);
                          return newMap;
                        });
                        const newMap = new Map(playerMenuVisible);
                        newMap.set(menuKey, false);
                        setPlayerMenuVisible(newMap);
                      }}
                      title={localPlayer.name}
                    />
                  ))}
                </Menu>
              </View>
            );
          })}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button mode="contained" onPress={handleConfirm}>
            Import
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxWidth: 500,
  },
  content: {
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  dropdown: {
    flex: 1,
    minWidth: 200,
  },
  dropdownContent: {
    justifyContent: 'flex-start',
  },
});
