import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Button, TextInput, Dialog, Portal, IconButton, useTheme, Text } from 'react-native-paper';
import { Player, Round } from '@/types';
import PhotoGallery from '@/components/common/PhotoGallery';
import CourseSelector from '@/components/common/CourseSelector';
import PlayerChip from '@/components/common/PlayerChip';
import NameUsernameDialog from '@/components/common/NameUsernameDialog';
import { getRoundById, saveRound, generateRoundTitle, deleteRound } from '@/services/storage/roundStorage';
import { getCurrentUserName, getAllUsers, saveUser, generateUserId, getUserIdForPlayerName, User } from '@/services/storage/userStorage';
import { getAllCourses } from '@/services/storage/courseStorage';
import { exportRound } from '@/services/roundExport';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { useFooterCenterButton } from '@/components/common/Footer';
import { Platform, Share, Alert, Clipboard } from 'react-native';

// Conditional DateTimePicker import for native platforms
let DateTimePicker: any;
if (Platform.OS !== 'web') {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
}

const { width, height } = Dimensions.get('window');

export default function RoundOverviewScreen() {
  const { id: roundIdParam } = useLocalSearchParams<{ id: string }>();
  const pathname = usePathname();
  const { registerCenterButtonHandler } = useFooterCenterButton();
  const [round, setRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [numberOfHoles, setNumberOfHoles] = useState('9');
  const [courses, setCourses] = useState<any[]>([]);
  const [errorDialog, setErrorDialog] = useState({ visible: false, title: '', message: '' });
  const [warningDialog, setWarningDialog] = useState({ visible: false, message: '' });
  const [addPlayerDialogVisible, setAddPlayerDialogVisible] = useState(false);
  const [editPlayerDialog, setEditPlayerDialog] = useState<{ visible: boolean; playerId: string | null; initialName: string }>({ visible: false, playerId: null, initialName: '' });
  const [copySuccess, setCopySuccess] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());


  // Load current user name and update "You" player
  useEffect(() => {
    const loadCurrentUserName = async () => {
      try {
        const currentUserName = await getCurrentUserName();
        if (currentUserName) {
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
        const loadedRound = await getRoundById(roundIdParam);
        if (!loadedRound) {
          // Round was deleted (likely auto-deleted), navigate away silently
          router.replace('/round/list');
          return;
        }

        setRound(loadedRound);
        setPlayers(loadedRound.players);
        setNotes(loadedRound.notes || '');
        const loadedPhotos = loadedRound.photos || [];
        setPhotos(loadedPhotos);
        // Initialize selected date from round date
        setSelectedDate(new Date(loadedRound.date));
        
        const loadedCourses = await getAllCourses();
        setCourses(loadedCourses);
        
        if (loadedRound.courseName) {
          const matchingCourse = loadedCourses.find(c => c.name.trim() === loadedRound.courseName!.trim());
          if (matchingCourse) {
            setSelectedCourseId(matchingCourse.id);
            const holeCount = Array.isArray(matchingCourse.holes) 
              ? matchingCourse.holes.length 
              : (matchingCourse.holes as unknown as number || 0);
            setNumberOfHoles(holeCount.toString());
          } else {
            setSelectedCourseId(null);
            setNumberOfHoles('9');
          }
        } else {
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

    // Verify the round still exists in storage before saving
    // This prevents auto-save from restoring deleted rounds
    const existingRound = await getRoundById(round.id);
    if (!existingRound) {
      // Round was deleted, don't save it back - silently skip
      return;
    }

    let courseName: string | undefined = round.courseName;
    if (selectedCourseId) {
      const courses = await getAllCourses();
      const selectedCourse = courses.find((c) => c.id === selectedCourseId);
      courseName = selectedCourse ? selectedCourse.name.trim() : round.courseName;
    }

    // Use selectedDate for the round date, or keep existing date
    const roundDate = selectedDate.getTime();
    const updatedTitle = generateRoundTitle(roundDate);

    const updatedRound: Round = {
      ...round,
      date: roundDate,
      title: updatedTitle,
      players,
      notes: notes.trim() || undefined,
      photos: photos.length > 0 ? photos : undefined,
      courseName: courseName?.trim() || undefined,
    };

    await saveRound(updatedRound);
    setRound(updatedRound);
  }, [round, players, notes, photos, selectedCourseId, selectedDate]);

  // Auto-save when data changes (including date changes)
  useEffect(() => {
    if (round && !loading) {
      const timeoutId = setTimeout(() => {
        saveRoundData();
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [players, notes, photos, selectedCourseId, selectedDate, round, loading, saveRoundData]);

  // Check if round should be auto-deleted when navigating away
  const roundIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (round) {
      roundIdRef.current = round.id;
    }
  }, [round]);

  useEffect(() => {
    if (!round || loading) return;

    const checkAndDeleteEmptyRound = async (roundId: string) => {
      try {
        // Reload the round to get the latest state (including scores)
        const latestRound = await getRoundById(roundId);
        if (!latestRound) return; // Round already deleted

        const hasPhotos = latestRound.photos && latestRound.photos.length > 0;
        const hasCourse = !!latestRound.courseName;
        const hasMultiplePlayers = latestRound.players.length > 1;
        const hasNotes = !!latestRound.notes && latestRound.notes.trim().length > 0;
        const hasScores = latestRound.scores && latestRound.scores.length > 0;

        // Check if round is empty (no meaningful content)
        const isEmpty = !hasPhotos && !hasCourse && !hasMultiplePlayers && !hasNotes && !hasScores;

        // Check if round is >5 hours old with no scores
        const roundAge = Date.now() - latestRound.date;
        const fiveHoursInMs = 5 * 60 * 60 * 1000;
        const isOldAndEmpty = roundAge > fiveHoursInMs && !hasScores;

        // Delete if either condition is met
        if (isEmpty || isOldAndEmpty) {
          console.log(`Auto-deleting round ${latestRound.id}: isEmpty=${isEmpty}, isOldAndEmpty=${isOldAndEmpty}`);
          await deleteRound(latestRound.id);
        }
      } catch (error) {
        console.error('Error checking/deleting empty round:', error);
      }
    };

    // Check when pathname changes to something that's not this round's pages
    const isOnThisRoundPage = pathname?.includes(`/round/${round.id}/`);
    const isLeavingThisRound = pathname && !isOnThisRoundPage;

    if (isLeavingThisRound) {
      checkAndDeleteEmptyRound(round.id);
    }

    // Also check on unmount (when component is being removed)
    return () => {
      const roundId = roundIdRef.current;
      if (roundId) {
        // Use a small delay to ensure we're actually navigating away
        setTimeout(() => {
          checkAndDeleteEmptyRound(roundId);
        }, 100);
      }
    };
  }, [pathname, round, loading]);
  

  const handlePlayersChange = useCallback((newPlayers: Player[]) => {
    setPlayers(newPlayers);
  }, []);

  const handleSaveNewPlayer = useCallback(async (name: string, username: string) => {
    try {
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

  const handleEditPlayer = useCallback((playerId: string) => {
    const player = players.find((p) => p.id === playerId);
    if (player) {
      setEditPlayerDialog({
        visible: true,
        playerId: playerId,
        initialName: player.name,
      });
    }
  }, [players]);

  const handleRemovePlayer = useCallback((playerId: string) => {
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
      
      if (Platform.OS === 'web') {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(exportedText);
        } else {
          const textArea = document.createElement('textarea');
          textArea.value = exportedText;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
      } else {
        Clipboard.setString(exportedText);
      }
      
      setCopySuccess(true);
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Error exporting round:', error);
      setErrorDialog({ visible: true, title: 'Export Error', message: error instanceof Error ? error.message : 'Failed to export round' });
    }
  }, [round]);

  // Register footer button to navigate to holes - only on overview page
  useEffect(() => {
    const isOverviewPage = pathname?.includes('/overview') && !pathname?.includes('/holes');
    
    if (!round || loading || !isOverviewPage) {
      registerCenterButtonHandler(null);
      return;
    }
    
    const handler = () => {
      router.push(`/round/${round.id}/holes`);
    };
    
    registerCenterButtonHandler(handler);
    
    return () => {
      registerCenterButtonHandler(null);
    };
  }, [round, loading, pathname, registerCenterButtonHandler]);

  const handlePhotosChange = useCallback((newPhotos: string[]) => {
    setPhotos(newPhotos);
  }, []);

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      // Preserve the time when changing date
      const newDate = new Date(date);
      newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
      setSelectedDate(newDate);
    }
  };

  const handleTimeChange = (event: any, date?: Date) => {
    setShowTimePicker(false);
    if (date) {
      // Preserve the date when changing time
      const newDate = new Date(selectedDate);
      newDate.setHours(date.getHours(), date.getMinutes());
      setSelectedDate(newDate);
    }
  };

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
      {/* Back Button and Copy Button */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          iconColor={theme.colors.onSurface}
          onPress={() => router.push('/round/list')}
          style={styles.backButton}
        />
        <IconButton
          icon={copySuccess ? "check" : "content-copy"}
          size={24}
          iconColor={copySuccess ? theme.colors.primary : theme.colors.onSurface}
          onPress={handleExportRound}
          style={styles.headerCopyButton}
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
                source={require('../../../assets/favicon.png')}
                style={styles.logoImage}
                contentFit="contain"
                cachePolicy="memory-disk"
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

        {/* Date Display - Editable */}
        <TouchableOpacity 
          style={styles.dateSection}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.7}
        >
          <View style={styles.dateContent}>
            <IconButton
              icon="calendar"
              size={20}
              iconColor={theme.colors.primary}
              style={styles.dateIcon}
            />
            <Text style={[styles.dateText, { color: theme.colors.onSurface }]}>
              {round.title}
            </Text>
            <IconButton
              icon="pencil"
              size={18}
              iconColor={theme.colors.onSurfaceVariant}
              style={styles.editIcon}
            />
          </View>
        </TouchableOpacity>

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
                    const { encodeNameForUrl } = require('@/utils/urlEncoding');
                    const encodedCourseName = encodeNameForUrl(round.courseName!);
                    router.push(`/course/${encodedCourseName}/overview`);
                  }}
                  style={styles.courseLinkIcon}
                />
              )}
            </View>
          </View>
        </View>

        {/* Players Section */}
        <View style={styles.playersSection}>
          {(() => {
            const hasScores = round.scores && round.scores.length > 0;
            const playerScores = players.map((player) => {
              const total = round.scores && round.scores.length > 0
                ? round.scores
                    .filter((s) => s.playerId === player.id)
                    .reduce((sum, s) => sum + s.throws, 0)
                : 0;
              return { player, total };
            });

            let winner: typeof playerScores[0] | undefined;
            if (round.scores && round.scores.length > 0 && playerScores.length > 0) {
              const winnerScore = Math.min(...playerScores.map((ps) => ps.total));
              winner = playerScores.find((ps) => ps.total === winnerScore);
            }
            
            return (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                    Players
                  </Text>
                  {!hasScores && (
                    <Button
                      mode="text"
                      icon="account-plus"
                      onPress={() => setAddPlayerDialogVisible(true)}
                      textColor={theme.colors.primary}
                      compact
                      style={styles.addPlayerButton}
                    >
                      Add Player
                    </Button>
                  )}
                </View>
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
                            console.log('Navigating to holes page via PlayerChip click');
                            router.push(`/round/${round.id}/holes`);
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
          initialUsername={''}
          excludeUserId={undefined}
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

      {/* Date/Time Picker Dialogs */}
      <Portal>
        <Dialog
          visible={showDatePicker}
          onDismiss={() => setShowDatePicker(false)}
        >
          <Dialog.Title>Select Date</Dialog.Title>
          <Dialog.Content>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={selectedDate.toISOString().split('T')[0]}
                onChange={(e) => {
                  if (e.target.value) {
                    const newDate = new Date(e.target.value);
                    newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
                    setSelectedDate(newDate);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '16px',
                  border: `1px solid ${theme.colors.outline}`,
                  borderRadius: '4px',
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.onSurface,
                }}
              />
            ) : (
              <View>
                {showDatePicker && DateTimePicker && (
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                  />
                )}
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDatePicker(false)}>Cancel</Button>
            <Button 
              mode="contained" 
              onPress={() => {
                setShowDatePicker(false);
                setShowTimePicker(true);
              }}
            >
              Next: Time
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={showTimePicker}
          onDismiss={() => setShowTimePicker(false)}
        >
          <Dialog.Title>Select Time</Dialog.Title>
          <Dialog.Content>
            {Platform.OS === 'web' ? (
              <input
                type="time"
                value={selectedDate.toTimeString().slice(0, 5)}
                onChange={(e) => {
                  if (e.target.value) {
                    const [hours, minutes] = e.target.value.split(':');
                    const newDate = new Date(selectedDate);
                    newDate.setHours(parseInt(hours), parseInt(minutes));
                    setSelectedDate(newDate);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '16px',
                  border: `1px solid ${theme.colors.outline}`,
                  borderRadius: '4px',
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.onSurface,
                }}
              />
            ) : (
              <View>
                {showTimePicker && DateTimePicker && (
                  <DateTimePicker
                    value={selectedDate}
                    mode="time"
                    display="default"
                    onChange={handleTimeChange}
                    is24Hour={false}
                  />
                )}
              </View>
            )}
            <Text style={[styles.previewText, { color: theme.colors.onSurfaceVariant, marginTop: 16 }]}>
              {selectedDate.toLocaleString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowTimePicker(false)}>Cancel</Button>
            <Button 
              mode="contained" 
              onPress={() => {
                setShowTimePicker(false);
                // Date/time is already updated in selectedDate state
                // Auto-save will handle saving it
              }}
            >
              Save
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
    paddingHorizontal: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  backButton: {
    margin: 0,
  },
  headerCopyButton: {
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
  dateContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateIcon: {
    margin: 0,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    flex: 1,
  },
  editIcon: {
    margin: 0,
  },
  previewText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
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
  addPlayerButton: {
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

