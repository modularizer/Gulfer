import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, Image} from 'react-native';
import { Button, TextInput, Dialog, Portal, IconButton, useTheme, Text } from 'react-native-paper';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/App';
import { Scorecard } from '../components/Scorecard';
import Footer from '../components/common/Footer';
import { 
  RoundInsert, 
  PlayerRoundInsert, 
  ScoreInsert,
  saveRound, 
  savePlayerRoundsForRound,
  saveScoresForRound,
  generateRoundId 
} from '@services/storage/roundStorage';
import type { ScorecardScore } from '@/components/Scorecard/Scorecard';
import { saveUser, generateUserId, getUserByName } from '@services/storage/userStorage';
import { saveCourse, getCourseByName, getAllHolesForCourse, saveHolesForCourse, generateCourseId, HoleInsert } from '@services/storage/courseStorage';
import { takePhoto, pickPhoto } from '@services/photos/photoService';
import { getImageByHash } from '@services/storage/photoStorage';
import { schema, getDatabase } from '@services/storage/db';
import { eq } from 'drizzle-orm';
import { useDialogStyle } from '@/hooks';
import { generateUUID } from '@/utils/uuid';

type ScorecardScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Scorecard'
>;

interface Props {
  navigation: ScorecardScreenNavigationProp;
}

// Simple Player type for the scorecard (just id and name)
type Player = { id: string; name: string };

export default function ScorecardScreen({ navigation }: Props) {
  const [isLandingPage, setIsLandingPage] = useState(true);
  const [players, setPlayers] = useState<Player[]>([
    { id: 'player_1', name: 'You' },
  ]);
  const [holes, setHoles] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  // Scores state - using 'score' to match database and Scorecard
  const [scores, setScores] = useState<Array<{ playerId: string; holeNumber: number; score: number }>>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [roundTitle, setRoundTitle] = useState('');
  const [courseName, setCourseName] = useState('');
  const [notes, setNotes] = useState('');
  const [photoHashes, setPhotoHashes] = useState<string[]>([]);
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [playerNameDialog, setPlayerNameDialog] = useState({ visible: false, playerId: '' });
  const [newPlayerName, setNewPlayerName] = useState('');

  // Auto-fill date and time
  const currentDate = new Date();
  const dateString = currentDate.toLocaleDateString();
  const timeString = currentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleScoreChange = useCallback((playerId: string, holeNumber: number, score: number) => {
    setScores((prev) => {
      const existing = prev.findIndex(
        (s) => s.playerId === playerId && s.holeNumber === holeNumber
      );
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { playerId, holeNumber, score };
        return updated;
      }
      return [...prev, { playerId, holeNumber, score }];
    });
  }, []);

  const handleAddPlayer = useCallback(() => {
    setPlayerNameDialog({ visible: true, playerId: '' });
  }, []);

  const handleConfirmAddPlayer = useCallback(() => {
    if (newPlayerName.trim()) {
      const newPlayer: Player = {
        id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: newPlayerName.trim(),
      };
      setPlayers((prev) => [...prev, newPlayer]);
      setNewPlayerName('');
    }
    setPlayerNameDialog({ visible: false, playerId: '' });
  }, [newPlayerName]);

  const handleRemovePlayer = useCallback((playerId: string) => {
    if (players.length === 1) {
      Alert.alert('Cannot Remove', 'You must have at least one player');
      return;
    }
    setPlayers((prev) => prev.filter((p) => p.id !== playerId));
    setScores((prev) => prev.filter((s) => s.playerId !== playerId));
  }, [players.length]);

  const handleAddHole = useCallback(() => {
    const maxHole = Math.max(...holes, 0);
    setHoles((prev) => [...prev, maxHole + 1]);
  }, [holes]);

  const handleRemoveHole = useCallback((holeNumber: number) => {
    if (holes.length === 1) {
      Alert.alert('Cannot Remove', 'You must have at least one hole');
      return;
    }
    setHoles((prev) => prev.filter((h) => h !== holeNumber));
    setScores((prev) => prev.filter((s) => s.holeNumber !== holeNumber));
  }, [holes.length]);

  const handleStartRound = useCallback(() => {
    setIsLandingPage(false);
  }, []);

  const handleSave = useCallback(() => {
    if (!roundTitle.trim()) {
      Alert.alert('Title Required', 'Please enter a title for this round');
      return;
    }
    setShowSaveDialog(true);
  }, [roundTitle]);

  const handleConfirmSave = useCallback(async () => {
    try {
      const roundId = generateRoundId(); // Synchronous now
      
      // Ensure all players exist in the database
      const playerIds: string[] = [];
      for (const player of players) {
        let userId: string;
        // Check if player already exists
        const existing = await getUserByName(player.name);
        if (existing) {
          userId = existing.id;
        } else {
          // Create new user/player
          userId = generateUserId();
          await saveUser({
            id: userId,
            name: player.name,
            notes: null,
            latitude: null,
            longitude: null,
            isTeam: false,
          });
        }
        playerIds.push(userId);
      }
      
      // Handle course - get or create
      let courseId: string | null = null;
      if (courseName.trim()) {
        let course = await getCourseByName(courseName.trim());
        if (!course) {
          // Create new course
          courseId = generateCourseId();
          await saveCourse({
            id: courseId,
            name: courseName.trim(),
            notes: null,
            latitude: null,
            longitude: null,
          });
          
          // Create holes for the course based on the holes we have
          const holeInserts: HoleInsert[] = holes.map(holeNum => ({
            id: generateUUID(),
            name: `Hole ${holeNum}`,
            courseId: courseId!,
            number: holeNum,
            par: null,
            distance: null,
            notes: null,
            latitude: null,
            longitude: null,
          }));
          await saveHolesForCourse(courseId, holeInserts);
        } else {
          courseId = course.id;
          // Ensure holes exist for this course
          const existingHoles = await getAllHolesForCourse(courseId);
          const existingHoleNumbers = new Set(existingHoles.map(h => h.number));
          const missingHoles = holes.filter(num => !existingHoleNumbers.has(num));
          if (missingHoles.length > 0) {
            const newHoles: HoleInsert[] = missingHoles.map(holeNum => ({
              id: generateUUID(),
              name: `Hole ${holeNum}`,
              courseId: courseId!,
              number: holeNum,
              par: null,
              distance: null,
              notes: null,
              latitude: null,
              longitude: null,
            }));
            await saveHolesForCourse(courseId, [...existingHoles.map(h => ({
              id: h.id,
              name: h.name,
              courseId: h.courseId,
              number: h.number,
              par: h.par,
              distance: h.distance,
              notes: h.notes,
              latitude: h.latitude,
              longitude: h.longitude,
            })), ...newHoles]);
          }
        }
      }
      
      // Save the round
      const roundInsert: RoundInsert = {
        id: roundId,
        name: roundTitle.trim(),
        date: currentDate.getTime(),
        courseId: courseId,
        notes: notes.trim() || null,
        latitude: null,
        longitude: null,
      };
      await saveRound(roundInsert);
      
      // Save playerRounds
      const playerRoundInserts: PlayerRoundInsert[] = players.map((player, index) => ({
        id: generateUUID(),
        name: player.name,
        roundId: roundId,
        playerId: playerIds[index],
        notes: null,
        latitude: null,
        longitude: null,
        frozen: false,
      }));
      await savePlayerRoundsForRound(roundId, playerRoundInserts);
      
      // Save scores - need to map holeNumber to holeId and playerId
      if (courseId && scores.length > 0) {
        const courseHoles = await getAllHolesForCourse(courseId);
        const holeMap = new Map(courseHoles.map(h => [h.number, h.id]));
        
        // Create a map from temporary player IDs to database player IDs
        const playerIdMap = new Map(players.map((player, index) => [player.id, playerIds[index]]));
        
        const scoreInserts: ScoreInsert[] = scores.map(score => {
          // Map temporary playerId to database playerId
          const dbPlayerId = playerIdMap.get(score.playerId);
          if (!dbPlayerId) {
            throw new Error(`Player ID not found for score: ${score.playerId}`);
          }
          
          // Get holeId from the map, or generate a placeholder if not found
          const holeId = holeMap.get(score.holeNumber) || generateUUID();
          return {
            id: generateUUID(),
            playerId: dbPlayerId,
            roundId: roundId,
            holeId: holeId,
            holeNumber: score.holeNumber,
            score: score.score,
            complete: true,
          };
        });
        await saveScoresForRound(roundId, scoreInserts);
      }
      
      // Link photos to the round
      if (photoHashes.length > 0) {
        const db = await getDatabase();
        
        for (const hash of photoHashes) {
          // Update photo record to link it to this round
          await db.update(schema.photos)
            .set({ 
              refId: roundId,
              refTable: 'rounds',
            })
            .where(eq(schema.photos.hash, hash));
        }
      }
      
      setShowSaveDialog(false);
      Alert.alert('Success', 'Round saved successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Home'),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to save round. Please try again.');
      console.error('Error saving round:', error);
    }
      }, [roundTitle, courseName, notes, players, scores, holes, photoHashes, navigation, currentDate]);

  const handleAddPhoto = useCallback(async () => {
    Alert.alert(
      'Add Photo',
      'Choose an option',
      [
        { text: 'Camera', onPress: async () => {
          const photo = await takePhoto();
          if (photo) {
            // Get URI for display
            const uri = await getImageByHash(photo.hash);
            if (uri) {
              setPhotoHashes((prev) => [...prev, photo.hash]);
              setPhotoUris((prev) => [...prev, uri]);
            }
          }
        }},
        { text: 'Gallery', onPress: async () => {
          const photo = await pickPhoto();
          if (photo) {
            // Get URI for display
            const uri = await getImageByHash(photo.hash);
            if (uri) {
              setPhotoHashes((prev) => [...prev, photo.hash]);
              setPhotoUris((prev) => [...prev, uri]);
            }
          }
        }},
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, []);

  const handleRemovePhoto = useCallback((index: number) => {
    setPhotoHashes((prev) => prev.filter((_, i) => i !== index));
    setPhotoUris((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const theme = useTheme();
  const dialogStyle = useDialogStyle();

  // Landing Page
  if (isLandingPage) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.landingContent}>
          <View style={styles.landingSection}>
            <Text style={[styles.label, { color: theme.colors.onSurface }]}>Date & Time</Text>
            <View style={styles.dateTimeContainer}>
              <Text style={[styles.dateTimeText, { color: theme.colors.onSurface }]}>
                {dateString} at {timeString}
              </Text>
            </View>
          </View>

          <View style={styles.landingSection}>
            <Text style={[styles.label, { color: theme.colors.onSurface }]}>Photos</Text>
            <View style={styles.photosSection}>
              {photoUris.length > 0 && (
                <View style={styles.photosContainer}>
                  {photoUris.map((uri, index) => (
                    <View key={index} style={styles.photoWrapper}>
                      <Image source={{ uri }} style={styles.photoPreview} />
                      <IconButton
                        icon="close"
                        size={20}
                        onPress={() => handleRemovePhoto(index)}
                        style={styles.removePhotoButton}
                      />
                    </View>
                  ))}
                </View>
              )}
              <Button
                mode="outlined"
                icon="camera"
                onPress={handleAddPhoto}
                style={styles.addPhotoButton}
              >
                {photoUris.length === 0 ? 'Add Photo' : 'Add Another Photo'}
              </Button>
            </View>
          </View>

          <View style={styles.landingSection}>
            <Text style={[styles.label, { color: theme.colors.onSurface }]}>Notes</Text>
            <TextInput
              mode="outlined"
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any notes about this round..."
              multiline
              numberOfLines={4}
              style={styles.notesInput}
            />
          </View>

          <View style={styles.landingSection}>
            <View style={styles.playersHeader}>
              <Text style={[styles.label, { color: theme.colors.onSurface }]}>Players</Text>
              <Button
                mode="outlined"
                icon="account-plus"
                onPress={handleAddPlayer}
                compact
              >
                Add Player
              </Button>
            </View>
            <View style={styles.playersList}>
              {players.map((player) => (
                <View key={player.id} style={styles.playerItem}>
                  <Text style={[styles.playerName, { color: theme.colors.onSurface }]}>
                    {player.name}
                  </Text>
                  {players.length > 1 && (
                    <IconButton
                      icon="close"
                      size={20}
                      onPress={() => handleRemovePlayer(player.id)}
                    />
                  )}
                </View>
              ))}
            </View>
          </View>

          <Button
            mode="contained"
            onPress={handleStartRound}
            style={styles.startButton}
            buttonColor={theme.colors.primary}
            textColor={theme.colors.onPrimary}
          >
            Start Round
          </Button>
        </ScrollView>

        <Footer />

        {/* Add Player Dialog */}
        <Portal>
          <Dialog
            visible={playerNameDialog.visible}
            onDismiss={() => setPlayerNameDialog({ visible: false, playerId: '' })}
          >
            <Dialog.Title>Add Player</Dialog.Title>
            <Dialog.Content>
              <TextInput
                label="Player Name"
                value={newPlayerName}
                onChangeText={setNewPlayerName}
                mode="outlined"
                style={styles.dialogInput}
                placeholder="Enter player name"
                autoFocus
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button
                onPress={() => setPlayerNameDialog({ visible: false, playerId: '' })}
              >
                Cancel
              </Button>
              <Button onPress={handleConfirmAddPlayer} mode="contained">
                Add
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </View>
    );
  }

  // Scorecard View
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView}>
        <Scorecard
          players={players}
          holes={holes}
          scores={scores}
          onScoreChange={handleScoreChange}
          onAddPlayer={handleAddPlayer}
          onRemovePlayer={handleRemovePlayer}
          onAddHole={handleAddHole}
          onRemoveHole={handleRemoveHole}
        />

        <View style={styles.actions}>
          <Button
            mode="outlined"
            onPress={handleAddHole}
            style={styles.actionButton}
          >
            Add Hole
          </Button>
          {holes.length > 1 && (
            <Button
              mode="outlined"
              onPress={() => handleRemoveHole(holes[holes.length - 1])}
              style={styles.actionButton}
            >
              Remove Last Hole
            </Button>
          )}
        </View>
      </ScrollView>

      <View style={[styles.saveButtonContainer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outlineVariant }]}>
        <Button
          mode="contained"
          onPress={handleSave}
          style={styles.saveButton}
          buttonColor={theme.colors.primary}
          textColor={theme.colors.onPrimary}
        >
          Save Round
        </Button>
      </View>

      <Footer />

      {/* Save Dialog */}
      <Portal>
        <Dialog visible={showSaveDialog} onDismiss={() => setShowSaveDialog(false)} style={dialogStyle}>
          <Dialog.Title>Save Round</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Round Title *"
              value={roundTitle}
              onChangeText={setRoundTitle}
              mode="outlined"
              style={styles.dialogInput}
              placeholder="e.g., Morning Round at Central Park"
            />
            <TextInput
              label="Course Name (optional)"
              value={courseName}
              onChangeText={setCourseName}
              mode="outlined"
              style={styles.dialogInput}
              placeholder="e.g., Central Park Disc Golf Course"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowSaveDialog(false)}>Cancel</Button>
            <Button onPress={handleConfirmSave} mode="contained">
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Add Player Dialog */}
      <Portal>
        <Dialog
          visible={playerNameDialog.visible}
          onDismiss={() => setPlayerNameDialog({ visible: false, playerId: '' })}
        >
          <Dialog.Title>Add Player</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Player Name"
              value={newPlayerName}
              onChangeText={setNewPlayerName}
              mode="outlined"
              style={styles.dialogInput}
              placeholder="Enter player name"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => setPlayerNameDialog({ visible: false, playerId: '' })}
            >
              Cancel
            </Button>
            <Button onPress={handleConfirmAddPlayer} mode="contained">
              Add
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
  scrollView: {
    flex: 1,
  },
  landingContent: {
    padding: 16,
  },
  landingSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  dateTimeContainer: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  dateTimeText: {
    fontSize: 16,
  },
  photosSection: {
    marginTop: 8,
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  photoWrapper: {
    position: 'relative',
  },
  photoPreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    margin: 0,
  },
  addPhotoButton: {
    marginTop: 8,
  },
  notesInput: {
    marginTop: 8,
  },
  playersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  playersList: {
    gap: 8,
  },
  playerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  playerName: {
    fontSize: 16,
  },
  startButton: {
    marginTop: 16,
    paddingVertical: 8,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
  saveButtonContainer: {
    padding: 16,
    borderTopWidth: 1,
  },
  saveButton: {
    paddingVertical: 4,
  },
  dialogInput: {
    marginBottom: 16,
  },
});
