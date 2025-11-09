import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Button, TextInput, Dialog, Portal, IconButton, useTheme, Text } from 'react-native-paper';
import { Player, Round } from '../../src/types';
import PhotoGallery from '../../src/components/common/PhotoGallery';
import CourseSelector from '../../src/components/common/CourseSelector';
import PlayerChip from '../../src/components/common/PlayerChip';
import NameUsernameDialog from '../../src/components/common/NameUsernameDialog';
import { getRoundById, saveRound } from '../../src/services/storage/roundStorage';
import { getCurrentUserName, getAllUsers, saveUser, generateUserId, getUserIdForPlayerName, User } from '../../src/services/storage/userStorage';
import { getAllCourses } from '../../src/services/storage/courseStorage';
import { exportRound } from '../../src/services/roundExport';
import { router, useLocalSearchParams } from 'expo-router';
import { useFooterCenterButton } from '../../src/components/common/Footer';
import { Platform, Share, Alert, Clipboard } from 'react-native';

const { width, height } = Dimensions.get('window');

export default function RoundOverviewScreen() {
  const { round: roundIdParam } = useLocalSearchParams<{ round: string }>();
  const { registerCenterButtonHandler } = useFooterCenterButton();
  const [round, setRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [numberOfHoles, setNumberOfHoles] = useState('9');
  const [courses, setCourses] = useState<any[]>([]);
  const [errorDialog, setErrorDialog] = useState({ visible: false, title: '', message: '' });
  const [warningDialog, setWarningDialog] = useState({ visible: false, message: '' });
  const [addPlayerDialogVisible, setAddPlayerDialogVisible] = useState(false);
  const [editPlayerDialog, setEditPlayerDialog] = useState<{ visible: boolean; playerId: number | null; initialName: string }>({ visible: false, playerId: null, initialName: '' });
  const [copySuccess, setCopySuccess] = useState(false);


  // Load current user name and update "You" player
  useEffect(() => {
    const loadCurrentUserName = async () => {
      try {
        const currentUserName = await getCurrentUserName();
        if (currentUserName) {
          // Update the "You" player if it exists
          setPlayers((prev) =>
            prev.map((p) =>
              p.name === 'You'
                ? { ...p, name: currentUserName }
                : p
            )
          );
        }
      } catch (error) {
        console.error('Error loading current user name:', error);
      }
    };

    loadCurrentUserName();
  }, []);

  // Load round data
  useEffect(() => {
    const loadRound = async () => {
      if (!roundIdParam) {
        setErrorDialog({ visible: true, title: 'Error', message: 'Round ID is missing' });
        setTimeout(() => router.push('/'), 1000);
        return;
      }

      try {
        // Use UUID directly from URL
        const loadedRound = await getRoundById(roundIdParam);
        if (!loadedRound) {
          setErrorDialog({ visible: true, title: 'Error', message: 'Round not found' });
          setTimeout(() => router.push('/'), 1000);
          return;
        }

        setRound(loadedRound);
        setPlayers(loadedRound.players);
        setNotes(loadedRound.notes || '');
        const loadedPhotos = loadedRound.photos || [];
        setPhotos(loadedPhotos);
        
        // Load courses to get hole count
        const loadedCourses = await getAllCourses();
        setCourses(loadedCourses);
        
        // If round has a courseName, find and set the selectedCourseId immediately
        if (loadedRound.courseName) {
          const matchingCourse = loadedCourses.find(c => c.name.trim() === loadedRound.courseName!.trim());
          if (matchingCourse) {
            setSelectedCourseId(matchingCourse.id);
            const holeCount = Array.isArray(matchingCourse.holes) 
              ? matchingCourse.holes.length 
              : (matchingCourse.holes as unknown as number || 0);
            setNumberOfHoles(holeCount.toString());
          } else {
            // Course not found, let CourseSelector handle default selection
            setSelectedCourseId(null);
            setNumberOfHoles('9');
          }
        } else {
          // No courseName, let CourseSelector handle default selection
          setSelectedCourseId(null);
          setNumberOfHoles('9');
        }
      } catch (error) {
        console.error('Error loading round:', error);
        setErrorDialog({ visible: true, title: 'Error', message: 'Failed to load round' });
        setTimeout(() => router.push('/'), 1000);
      } finally {
        setLoading(false);
      }
    };

    if (roundIdParam) {
      loadRound();
    }
  }, [roundIdParam]);

  // Save round data
  const saveRoundData = useCallback(async () => {
    if (!round) return;

    // Get course name from selected course ID
    const { getAllCourses } = await import('../../src/services/storage/courseStorage');
    let courseName: string | undefined = round.courseName; // Preserve existing courseName
    if (selectedCourseId) {
      const courses = await getAllCourses();
      const selectedCourse = courses.find((c) => c.id === selectedCourseId);
      courseName = selectedCourse ? selectedCourse.name.trim() : round.courseName;
    }

    const updatedRound: Round = {
      ...round,
      players,
      notes: notes.trim() || undefined,
      photos: photos.length > 0 ? photos : undefined,
      courseName: courseName?.trim() || undefined,
    };

    await saveRound(updatedRound);
    setRound(updatedRound);
  }, [round, players, notes, photos, selectedCourseId]);

  // Auto-save when data changes
  useEffect(() => {
    if (round && !loading) {
      const timeoutId = setTimeout(() => {
        saveRoundData();
      }, 500); // Debounce saves

      return () => clearTimeout(timeoutId);
    }
  }, [players, notes, photos, selectedCourseId, round, loading, saveRoundData]);
  


  const handlePlayersChange = useCallback((newPlayers: Player[]) => {
    setPlayers(newPlayers);
  }, []);

  const handleSaveNewPlayer = useCallback(async (name: string, username: string) => {
    try {
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
      setPlayers([...players, newPlayer]);
      setAddPlayerDialogVisible(false);
    } catch (error) {
      console.error('Error saving player:', error);
      setErrorDialog({ visible: true, title: 'Error', message: 'Failed to save player' });
    }
  }, [players]);

  const handleSaveEditPlayer = useCallback(async (name: string, username: string) => {
    try {
      if (editPlayerDialog.playerId === null) return;
      const updatedPlayers = players.map((p) => {
        if (p.id === editPlayerDialog.playerId) {
          return { ...p, name };
        }
        return p;
      });
      setPlayers(updatedPlayers);
      setEditPlayerDialog({ visible: false, playerId: null, initialName: '' });
    } catch (error) {
      console.error('Error updating player:', error);
      setErrorDialog({ visible: true, title: 'Error', message: 'Failed to update player' });
    }
  }, [players, editPlayerDialog.playerId]);

  const handleEditPlayer = useCallback((playerId: number) => {
    const player = players.find((p) => p.id === playerId);
    if (player) {
      setEditPlayerDialog({
        visible: true,
        playerId: playerId,
        initialName: player.name,
      });
    }
  }, [players]);

  const handleRemovePlayer = useCallback((playerId: number) => {
    if (players.length === 1) {
      setWarningDialog({ visible: true, message: 'You must have at least one player' });
      return;
    }
    setPlayers(players.filter((p) => p.id !== playerId));
  }, [players]);

  const handleExportRound = useCallback(async () => {
    if (!round) return;
    
    try {
      const exportedText = await exportRound(round.id);
      
      // Copy to clipboard
      if (Platform.OS === 'web') {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(exportedText);
        } else {
          // Fallback for older browsers
          const textArea = document.createElement('textarea');
          textArea.value = exportedText;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
      } else {
        // React Native
        Clipboard.setString(exportedText);
      }
      
      // Show success feedback
      setCopySuccess(true);
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Error exporting round:', error);
      setErrorDialog({ visible: true, title: 'Export Error', message: error instanceof Error ? error.message : 'Failed to export round' });
    }
  }, [round]);

  const handleStartRound = useCallback(() => {
    if (!round) return;
    router.push(`/${round.id}/play`);
  }, [round]);

  // Register the start round handler with the footer
  useEffect(() => {
    registerCenterButtonHandler(handleStartRound);
    return () => {
      registerCenterButtonHandler(null);
    };
  }, [handleStartRound, registerCenterButtonHandler]);

  const handlePhotosChange = useCallback((newPhotos: string[]) => {
    setPhotos(newPhotos);
  }, []);


  const theme = useTheme();

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!round) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Back Button */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          iconColor={theme.colors.onSurface}
          onPress={() => router.push('/rounds')}
          style={styles.backButton}
        />
      </View>
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image Section with Logo */}
        <View style={styles.heroSection}>
          {photos.length === 0 && (
            <View style={styles.logoContainer}>
              <Image 
                source={require('../../assets/favicon.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          )}
          <PhotoGallery
            images={photos}
            isEditable={true}
            onImagesChange={handlePhotosChange}
            storageKey={round?.id || roundIdParam || ''}
          />
        </View>

        {/* Date Display */}
        <View style={styles.dateSection}>
          <Text style={[styles.dateText, { color: theme.colors.onSurface }]}>
            {round.title}
          </Text>
        </View>

        {/* Location and Number of Holes Input */}
        <View style={styles.inputSection}>
          <View style={styles.inputRow}>
            <View style={styles.courseSelectorContainer}>
              <CourseSelector
                selectedCourseId={selectedCourseId}
                onCourseChange={setSelectedCourseId}
                onHolesChange={(holes) => setNumberOfHoles(holes.toString())}
                initialCourseName={round.courseName}
              />
              {round.courseName && (
                <IconButton
                  icon="arrow-right"
                  size={20}
                  iconColor={theme.colors.primary}
                  onPress={() => {
                    const encodedCourseName = encodeURIComponent(round.courseName!);
                    router.push(`/course/${encodedCourseName}`);
                  }}
                  style={styles.courseLinkIcon}
                />
              )}
            </View>
          </View>
        </View>

        {/* Players Section */}
        <View style={styles.playersSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Players
            </Text>
            <IconButton
              icon={copySuccess ? "check" : "content-copy"}
              size={20}
              iconColor={copySuccess ? theme.colors.primary : theme.colors.primary}
              onPress={handleExportRound}
              style={styles.exportButton}
            />
          </View>
          {(() => {
            // Calculate total score for each player (0 if no scores)
            const playerScores = players.map((player) => {
              const total = round.scores && round.scores.length > 0
                ? round.scores
                    .filter((s) => s.playerId === player.id)
                    .reduce((sum, s) => sum + s.throws, 0)
                : 0;
              return { player, total };
            });

            // Find winner (lowest score wins in golf/disc golf) - only if scores exist
            let winner: typeof playerScores[0] | undefined;
            if (round.scores && round.scores.length > 0 && playerScores.length > 0) {
              const winnerScore = Math.min(...playerScores.map((ps) => ps.total));
              winner = playerScores.find((ps) => ps.total === winnerScore);
            }

            const hasScores = round.scores && round.scores.length > 0;
            
            return (
              <>
                <View style={styles.playersContainer}>
                  {playerScores.map(({ player, total }) => {
                    const isWinner = winner && player.id === winner.player.id;
                    return (
                      <View key={player.id} style={styles.playerChipWrapper}>
                        <PlayerChip
                          player={player}
                          score={total}
                          isWinner={isWinner}
                          onPress={() => {
                            if (!round) return;
                            router.push(`/${round.id}/play`);
                          }}
                        />
                        {!hasScores && players.length > 1 && (
                          <IconButton
                            icon="close"
                            size={18}
                            iconColor={theme.colors.error}
                            onPress={() => handleRemovePlayer(player.id)}
                            style={styles.removeButton}
                          />
                        )}
                      </View>
                    );
                  })}
                </View>
                {/* Add button - only show if no scores */}
                {!hasScores && (
                  <View style={styles.addButtonRow}>
                    <Button
                      mode="text"
                      icon="account-plus"
                      onPress={() => setAddPlayerDialogVisible(true)}
                      textColor={theme.colors.primary}
                      compact
                    >
                      Add Player
                    </Button>
                  </View>
                )}
              </>
            );
          })()}
        </View>

        {/* Add Player Dialog */}
        <NameUsernameDialog
          visible={addPlayerDialogVisible}
          title="Add Player"
          nameLabel="Player Name"
          onDismiss={() => setAddPlayerDialogVisible(false)}
          onSave={handleSaveNewPlayer}
        />

        {/* Edit Player Dialog */}
        <NameUsernameDialog
          visible={editPlayerDialog.visible}
          title="Edit Player"
          nameLabel="Player Name"
          initialName={editPlayerDialog.initialName}
          initialUsername={''} // Deprecated, no longer used
          excludeUserId={undefined} // Deprecated, no longer used
          onDismiss={() => setEditPlayerDialog({ visible: false, playerId: null, initialName: '' })}
          onSave={handleSaveEditPlayer}
        />

        {/* Notes Section */}
        <View style={styles.notesSection}>
          <Text style={[styles.notesTitle, { color: theme.colors.onSurface }]}>
            Notes
          </Text>
          <TextInput
            mode="flat"
            value={notes}
            onChangeText={setNotes}
            placeholder="Add any notes about this round..."
            multiline
            numberOfLines={3}
            style={styles.notesInput}
            contentStyle={styles.notesContent}
            underlineColor="transparent"
            activeUnderlineColor={theme.colors.primary}
          />
        </View>
      </ScrollView>

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

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 8,
    paddingLeft: 8,
    zIndex: 10,
  },
  backButton: {
    margin: 0,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },
  heroSection: {
    width: '100%',
    paddingVertical: 4,
    paddingHorizontal: 16,
    position: 'relative',
    backgroundColor: '#f5f5f5',
  },
  logoContainer: {
    width: '100%',
    height: 170,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  dateSection: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  courseSelectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  courseLinkIcon: {
    margin: 0,
    padding: 0,
  },
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
  playersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  playerChipWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  removeButton: {
    margin: 0,
  },
  addButtonRow: {
    marginTop: 8,
  },
  exportButton: {
    margin: 0,
  },
  inputSection: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputFlex: {
    flex: 1,
  },
  flagIcon: {
    fontSize: 20,
    marginLeft: 12,
    marginRight: 8,
  },
  inputContent: {
    fontSize: 16,
    paddingVertical: 8,
  },
  notesSection: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  notesTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  notesInput: {
    backgroundColor: 'transparent',
    marginTop: 8,
  },
  notesContent: {
    fontSize: 16,
    paddingVertical: 8,
  },
  startButton: {
    marginHorizontal: 24,
    marginTop: 8,
    borderRadius: 16,
  },
  startButtonContent: {
    paddingVertical: 8,
  },
  startButtonLabel: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dialogInput: {
    marginBottom: 16,
  },
  photoDialogButton: {
    marginHorizontal: 4,
  },
});

