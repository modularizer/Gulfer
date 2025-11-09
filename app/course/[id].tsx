import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Button, Dialog, Portal, IconButton, useTheme, Text, Card, Chip } from 'react-native-paper';
import { TouchableOpacity } from 'react-native';
import { Course, Hole, Round, Player, Score } from '../../src/types';
import PhotoGallery from '../../src/components/common/PhotoGallery';
import PlayerChip from '../../src/components/common/PlayerChip';
import { getCourseByName, saveCourse } from '../../src/services/storage/courseStorage';
import { getAllRounds } from '../../src/services/storage/roundStorage';
import { ensurePlayerHasUsername } from '../../src/services/storage/userStorage';
import { router, useLocalSearchParams } from 'expo-router';
import { useFooterCenterButton } from '../../src/components/common/Footer';

const { width, height } = Dimensions.get('window');

export default function CourseDetailScreen() {
  const { id: courseNameParam } = useLocalSearchParams<{ id: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<string[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [bestScores, setBestScores] = useState<Map<string, { player: Player; score: number }>>(new Map());
  const [errorDialog, setErrorDialog] = useState({ visible: false, title: '', message: '' });

  // Load course data
  useEffect(() => {
    const loadCourse = async () => {
      if (!courseNameParam) {
        setErrorDialog({ visible: true, title: 'Error', message: 'Course name is missing' });
        setTimeout(() => router.push('/courses'), 1000);
        return;
      }

      try {
        // Decode the course name from URL
        const courseName = decodeURIComponent(courseNameParam);
        const loadedCourse = await getCourseByName(courseName);
        if (!loadedCourse) {
          setErrorDialog({ visible: true, title: 'Error', message: 'Course not found' });
          setTimeout(() => router.push('/courses'), 1000);
          return;
        }

        setCourse(loadedCourse);
        // TODO: Load photos when Course type supports it
        setPhotos([]);
        
        // Load rounds for this course
        const allRounds = await getAllRounds();
        // Match course name (trim whitespace for robustness)
        const courseRounds = allRounds.filter(r => {
          const roundCourseName = r.courseName?.trim();
          const trimmedCourseName = courseName.trim();
          return roundCourseName === trimmedCourseName;
        });
        
        console.log(`Course "${courseName}": Found ${courseRounds.length} rounds`);
        console.log('All rounds:', allRounds.map(r => ({ id: r.id, courseName: r.courseName })));
        
        setRounds(courseRounds);
        
        // Calculate best scores per player
        const bestScoresMap = new Map<string, { player: Player; score: number }>();
        await Promise.all(courseRounds.map(async (round) => {
          if (round.scores && round.scores.length > 0 && round.players) {
            await Promise.all(round.players.map(async (player) => {
              const playerScores = round.scores!.filter(s => s.playerId === player.id);
              const total = playerScores.reduce((sum, s) => sum + s.throws, 0);
              
              // Ensure player has username
              const playerWithUsername = await ensurePlayerHasUsername(player);
              if (!playerWithUsername.username) {
                console.error('Player missing username:', player);
                return;
              }
              
              const key = playerWithUsername.username;
              const existing = bestScoresMap.get(key);
              if (!existing || total < existing.score) {
                bestScoresMap.set(key, { player: { ...player, username: playerWithUsername.username }, score: total });
              }
            }));
          }
        }));
        setBestScores(bestScoresMap);
      } catch (error) {
        console.error('Error loading course:', error);
        setErrorDialog({ visible: true, title: 'Error', message: 'Failed to load course' });
        setTimeout(() => router.push('/courses'), 1000);
      } finally {
        setLoading(false);
      }
    };

    if (courseNameParam) {
      loadCourse();
    }
  }, [courseNameParam]);

  // Save course data
  const saveCourseData = useCallback(async () => {
    if (!course) return;

    const updatedCourse: Course = {
      ...course,
    };

    await saveCourse(updatedCourse);
    setCourse(updatedCourse);
  }, [course]);

  const handlePhotosChange = useCallback((newPhotos: string[]) => {
    setPhotos(newPhotos);
    // TODO: Save photos to course when Course type supports it
  }, []);

  // Set up footer center button to navigate to holes table
  const { registerCenterButtonHandler } = useFooterCenterButton();
  useEffect(() => {
    if (courseNameParam) {
      registerCenterButtonHandler(() => {
        router.push(`/course/${courseNameParam}/holes`);
      });
    }
    return () => {
      registerCenterButtonHandler(null);
    };
  }, [courseNameParam, registerCenterButtonHandler]);

  const theme = useTheme();

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!course) {
    return null;
  }

  const holeCount = Array.isArray(course.holes) ? course.holes.length : (course.holes as unknown as number || 0);
  const holes = Array.isArray(course.holes) ? course.holes : Array.from({ length: holeCount }, (_, i) => ({ number: i + 1 }));

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Back Button */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          iconColor={theme.colors.onSurface}
          onPress={() => router.push('/courses')}
          style={styles.backButton}
        />
      </View>
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image Section */}
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
            storageKey={course?.id || ''}
          />
        </View>

        {/* Course Name */}
        <View style={styles.nameSection}>
          <Text style={[styles.nameText, { color: theme.colors.onSurface }]}>
            {course.name} ({holeCount} {holeCount === 1 ? 'hole' : 'holes'})
          </Text>
        </View>

        {/* Best Scores Section */}
        <View style={styles.bestScoresSection}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Best Scores
          </Text>
          {bestScores.size > 0 ? (
            <View style={styles.bestScoresContainer}>
              {Array.from(bestScores.values())
                .sort((a, b) => a.score - b.score)
                .map(({ player, score }) => {
                  if (!player.username) {
                    console.error('Player missing username:', player);
                    return null;
                  }
                  const playerUsername = player.username; // TypeScript guard
                  // Find winner (lowest score)
                  const allScores = Array.from(bestScores.values());
                  const winnerScore = Math.min(...allScores.map(ps => ps.score));
                  const isWinner = score === winnerScore;
                  
                  return (
                    <PlayerChip
                      key={playerUsername}
                      player={player}
                      score={score}
                      isWinner={isWinner}
                      onPress={() => router.push(`/player/${encodeURIComponent(playerUsername)}`)}
                    />
                  );
                })
                .filter(Boolean)}
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
              No scores recorded yet
            </Text>
          )}
        </View>

        {/* Rounds Section */}
        {rounds.length > 0 && (
          <View style={styles.roundsSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Rounds ({rounds.length})
            </Text>
            <View style={styles.roundsList}>
              {rounds
                .sort((a, b) => b.date - a.date)
                .map((round) => {
                  // Format date
                  const date = new Date(round.date);
                  const dateStr = date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'numeric',
                    day: 'numeric',
                    year: '2-digit',
                  });
                  const timeStr = date.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  });

                  // Calculate player scores
                  const playerScores = round.players.map((player) => {
                    const total = round.scores
                      ? round.scores
                          .filter((s) => s.playerId === player.id)
                          .reduce((sum, s) => sum + s.throws, 0)
                      : 0;
                    return { player, total };
                  });

                  // Find winner
                  const winnerScore = Math.min(...playerScores.map((ps) => ps.total));
                  const winner = playerScores.find((ps) => ps.total === winnerScore);

                  return (
                    <TouchableOpacity
                      key={round.id}
                      onPress={() => router.push(`/${round.id}/overview`)}
                    >
                      <Card style={[styles.roundCard, { backgroundColor: theme.colors.surface }]}>
                        <Card.Content>
                          <View style={styles.roundHeader}>
                            <Text style={[styles.roundDate, { color: theme.colors.onSurface }]}>
                              {dateStr} {timeStr}
                            </Text>
                          </View>
                          {playerScores.length > 0 && (
                            <View style={styles.roundPlayers}>
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
                                    onPress={() => router.push(`/${round.id}/play`)}
                                  >
                                    {player.name}: {total}
                                  </Chip>
                                );
                              })}
                            </View>
                          )}
                        </Card.Content>
                      </Card>
                    </TouchableOpacity>
                  );
                })}
            </View>
          </View>
        )}

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
  nameSection: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  nameText: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bestScoresSection: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  bestScoresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  roundsSection: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  roundsList: {
    gap: 12,
  },
  roundCard: {
    marginBottom: 8,
  },
  roundHeader: {
    marginBottom: 8,
  },
  roundDate: {
    fontSize: 16,
    fontWeight: '600',
  },
  roundPlayers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  playerChip: {
    height: 32,
  },
  playerChipText: {
    fontSize: 14,
  },
  winnerChip: {
    backgroundColor: '#FFD700',
  },
  winnerChipText: {
    color: '#000',
    fontWeight: 'bold',
  },
});

