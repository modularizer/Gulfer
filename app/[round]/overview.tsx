import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Button, TextInput, Dialog, Portal, IconButton, useTheme, Text, Chip } from 'react-native-paper';
import { Player, Round } from '../../src/types';
import PhotoGallery from '../../src/components/common/PhotoGallery';
import CourseSelector from '../../src/components/common/CourseSelector';
import PlayerSelector from '../../src/components/common/PlayerSelector';
import { getRoundById, saveRound } from '../../src/services/storage/roundStorage';
import { getCurrentUserName } from '../../src/services/storage/userStorage';
import { getAllCourses } from '../../src/services/storage/courseStorage';
import { router, useLocalSearchParams } from 'expo-router';
import { useFooterCenterButton } from '../../src/components/common/Footer';

const { width, height } = Dimensions.get('window');

export default function RoundOverviewScreen() {
  const { round: roundId } = useLocalSearchParams<{ round: string }>();
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


  // Load current user name and update "You" player
  useEffect(() => {
    const loadCurrentUserName = async () => {
      try {
        const currentUserName = await getCurrentUserName();
        if (currentUserName) {
          // Update the "You" player if it exists
          setPlayers((prev) =>
            prev.map((p) =>
              p.id === 'player_1' || p.name === 'You'
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
      if (!roundId) {
        setErrorDialog({ visible: true, title: 'Error', message: 'Round ID is missing' });
        setTimeout(() => router.push('/'), 1000);
        return;
      }

      try {
        const loadedRound = await getRoundById(roundId);
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
        
        // Course selection will be handled by CourseSelector component
        // Just store the course name for initial matching
        setSelectedCourseId(null);
        setNumberOfHoles('9');
      } catch (error) {
        console.error('Error loading round:', error);
        setErrorDialog({ visible: true, title: 'Error', message: 'Failed to load round' });
        setTimeout(() => router.push('/'), 1000);
      } finally {
        setLoading(false);
      }
    };

    if (roundId) {
      loadRound();
    }
  }, [roundId]);

  // Save round data
  const saveRoundData = useCallback(async () => {
    if (!round) return;

    // Get course name from selected course ID
    const { getAllCourses } = await import('../../src/services/storage/courseStorage');
    let courseName: string | undefined;
    if (selectedCourseId) {
      const courses = await getAllCourses();
      const selectedCourse = courses.find((c: { id: string }) => c.id === selectedCourseId);
      courseName = selectedCourse ? selectedCourse.name : undefined;
    }

    const updatedRound: Round = {
      ...round,
      players,
      notes: notes.trim() || undefined,
      photos: photos.length > 0 ? photos : undefined,
      courseName,
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

  const handleStartRound = useCallback(() => {
    if (!roundId) return;
    router.push(`/${roundId}/play`);
  }, [roundId]);

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
            storageKey={roundId}
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
        {round.scores && round.scores.length > 0 ? (
          // Show player badges with scores if game has been played
          <View style={styles.playersSection}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                Players
              </Text>
            </View>
            {(() => {
              // Calculate total score for each player
              const playerScores = players.map((player) => {
                const total = round.scores!
                  .filter((s) => s.playerId === player.id)
                  .reduce((sum, s) => sum + s.throws, 0);
                return { player, total };
              });

              // Find winner (lowest score wins in golf/disc golf)
              const winnerScore = Math.min(...playerScores.map((ps) => ps.total));
              const winner = playerScores.find((ps) => ps.total === winnerScore);

              return (
                <View style={styles.playersContainer}>
                  {playerScores.map(({ player, total }) => {
                    const isWinner = winner && player.id === winner.player.id;
                    return (
                      <Chip
                        key={player.id}
                        style={[
                          styles.playerChip,
                          isWinner && styles.winnerChip,
                        ]}
                        textStyle={[
                          styles.playerChipText,
                          isWinner && styles.winnerChipText,
                        ]}
                        icon={isWinner ? 'crown' : undefined}
                        onPress={() => router.push(`/player/${encodeURIComponent(player.username || player.name)}`)}
                      >
                        {player.name}: {total}
                      </Chip>
                    );
                  })}
                </View>
              );
            })()}
          </View>
        ) : (
          // Show PlayerSelector for editing when no scores
          <PlayerSelector
            players={players}
            onPlayersChange={handlePlayersChange}
          />
        )}

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
  },
  playerChip: {
    height: 36,
    borderRadius: 8,
  },
  winnerChip: {
    backgroundColor: '#FFD700',
  },
  playerChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  winnerChipText: {
    color: '#000',
    fontWeight: 'bold',
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

