import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useTheme, Text, Card, Chip, Button } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { getAllUsers, getUserById, getUserByName, User, saveUser } from '@/services/storage/userStorage';
import { getAllRounds } from '@/services/storage/roundStorage';
import { Round, Player, Score } from '@/types';
import { getAllCourses, Course } from '@/services/storage/courseStorage';
import { getShadowStyle, getAppVersion } from '@/utils';
import { exportPlayer } from '@/services/playerExport';
import { decodeNameFromUrl } from '@/utils/urlEncoding';
import {
  DetailPageLayout,
  HeroSection,
  SectionTitle,
  RoundCard,
  ErrorDialog,
  NotesSection,
} from '@/components/common';
import { useExport } from '@/hooks/useExport';
import { encodeNameForUrl } from '@/utils/urlEncoding';
import { detailPageStyles } from '@/styles/detailPageStyles';
import { loadPhotosByStorageKey, savePhotosByStorageKey } from '@/utils/photoStorage';

interface CourseScore {
  course: Course;
  bestScore: number;
  roundCount: number;
  bestRoundId: string;
}

export default function PlayerDetailScreen() {
  const { id: playerNameParam } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [player, setPlayer] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [courseScores, setCourseScores] = useState<CourseScore[]>([]);
  const [playerRounds, setPlayerRounds] = useState<Round[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [errorDialog, setErrorDialog] = useState({ visible: false, title: '', message: '' });
  
  const { exportToClipboard } = useExport();
  const [isUpdating, setIsUpdating] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('Loading...');

  const handleExport = useCallback(async () => {
    if (!player) return;
    try {
      const exportText = await exportPlayer(player.id);
      await exportToClipboard(exportText, player.name);
    } catch (error) {
      console.error('Error exporting player:', error);
      setErrorDialog({ visible: true, title: 'Error', message: 'Failed to export player' });
    }
  }, [player, exportToClipboard]);

  const handleUpdateApp = useCallback(async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setErrorDialog({ 
        visible: true, 
        title: 'Not Available', 
        message: 'App updates are only available on web.' 
      });
      return;
    }

    setIsUpdating(true);
    try {
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
        console.log('[UpdateApp] Cleared', cacheNames.length, 'caches');
      }

      // Update service worker if available
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            // Force service worker update
            await registration.update();
            console.log('[UpdateApp] Service worker update requested');
            
            // If there's a waiting worker, skip waiting
            if (registration.waiting) {
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
              console.log('[UpdateApp] Sent SKIP_WAITING to waiting worker');
            }
          }
        } catch (error) {
          console.error('[UpdateApp] Error updating service worker:', error);
        }
      }

      // Reload the page to get the latest version
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('[UpdateApp] Error updating app:', error);
      setErrorDialog({ 
        visible: true, 
        title: 'Update Error', 
        message: 'Failed to update app. Please try refreshing manually.' 
      });
      setIsUpdating(false);
    }
  }, []);

  // Load player data and calculate course scores
  useEffect(() => {
    const loadPlayerData = async () => {
      if (!playerNameParam) {
        setTimeout(() => router.push('/player/list'), 1000);
        return;
      }

      try {
        const playerName = decodeNameFromUrl(playerNameParam);
        const foundPlayer = await getUserByName(playerName);
        
        if (!foundPlayer) {
          setTimeout(() => router.push('/player/list'), 1000);
          return;
        }
        setPlayer(foundPlayer);
        // Load photos from storage
        const loadedPhotos = await loadPhotosByStorageKey(foundPlayer.id);
        setPhotos(loadedPhotos);
        setNotes(foundPlayer.notes || '');

        const allRounds = await getAllRounds();
        const loadedCourses = await getAllCourses();
        setAllCourses(loadedCourses);

        const foundPlayerId = foundPlayer.id;
        const playerRounds = allRounds.filter(round => {
          const playerInRound = round.players.find(p => p.id === foundPlayerId);
          return playerInRound && round.scores && round.scores.length > 0;
        });

        const courseScoreMap = new Map<string, { course: Course; bestScore: number; roundCount: number; bestRoundId: string }>();
        const courseRoundCounts = new Map<string, number>();
        
        playerRounds.forEach(round => {
          if (round.courseName) {
            const course = loadedCourses.find(c => c.name.trim() === round.courseName!.trim());
            if (course) {
              courseRoundCounts.set(course.id, (courseRoundCounts.get(course.id) || 0) + 1);
            }
          }
        });
        
        playerRounds.forEach(round => {
          if (!round.courseName) return;
          
          const roundCourseName = round.courseName.trim();
          const course = loadedCourses.find(c => c.name.trim() === roundCourseName);
          if (!course) return;

          const playerInRound = round.players.find(p => p.id === foundPlayerId);
          if (!playerInRound) return;

          const playerScores = round.scores!.filter(s => s.playerId === playerInRound.id);
          const total = playerScores.reduce((sum, s) => sum + s.throws, 0);

          const existing = courseScoreMap.get(course.id);
          const roundCount = courseRoundCounts.get(course.id) || 0;
          
          if (!existing || total < existing.bestScore) {
            courseScoreMap.set(course.id, {
              course,
              bestScore: total,
              roundCount,
              bestRoundId: round.id,
            });
          } else if (existing.roundCount !== roundCount) {
            existing.roundCount = roundCount;
          }
        });

        const courseScoresArray = Array.from(courseScoreMap.values())
          .sort((a, b) => a.course.name.localeCompare(b.course.name));
        
        setCourseScores(courseScoresArray);
        setPlayerRounds(playerRounds.sort((a, b) => b.date - a.date));
      } catch (error) {
        console.error('Error loading player data:', error);
        setTimeout(() => router.push('/player/list'), 1000);
      } finally {
        setLoading(false);
      }
    };

    if (playerNameParam) {
      loadPlayerData();
    }
  }, [playerNameParam]);

  // Load app version on mount
  useEffect(() => {
    const loadAppVersion = async () => {
      if (Platform.OS === 'web') {
        const version = await getAppVersion();
        setAppVersion(version);
      }
    };
    loadAppVersion();
  }, []);

  const handlePhotosChange = useCallback(async (newPhotos: string[]) => {
    setPhotos(newPhotos);
    if (player) {
      try {
        await savePhotosByStorageKey(player.id, newPhotos);
      } catch (error) {
        console.error('Error saving player photos:', error);
      }
    }
  }, [player]);

  const handleNotesChange = useCallback(async (newNotes: string) => {
    setNotes(newNotes);
    if (player) {
      try {
        const updatedPlayer = { ...player, notes: newNotes };
        await saveUser(updatedPlayer);
        setPlayer(updatedPlayer);
      } catch (error) {
        console.error('Error saving player notes:', error);
      }
    }
  }, [player]);

  return (
    <DetailPageLayout
      loading={loading || !player}
      onBack={() => router.push('/player/list')}
      headerContent={
        player ? (
          <>
            <View style={styles.headerNameRow}>
              <Text 
                style={[styles.headerName, { color: theme.colors.onSurface }]}
                numberOfLines={1}
              >
                {player.name}
              </Text>
              {playerRounds.length > 0 && (
                <Text style={[styles.roundsCount, { color: theme.colors.onSurfaceVariant }]}>
                  {playerRounds.length} {playerRounds.length === 1 ? 'round' : 'rounds'}
                </Text>
              )}
            </View>
            {player.isCurrentUser && (
              <Chip style={styles.currentUserChip} icon="account">
                You
              </Chip>
            )}
          </>
        ) : null
      }
      headerMenuItems={
        player
          ? [
              {
                title: 'Export Player',
                icon: 'export',
                onPress: handleExport,
              },
              ...(player.isCurrentUser && Platform.OS === 'web'
                ? [
                    {
                      title: 'Update App',
                      icon: 'refresh',
                      onPress: handleUpdateApp,
                    },
                  ]
                : []),
            ]
          : undefined
      }
      errorDialog={{
        visible: errorDialog.visible,
        title: errorDialog.title,
        message: errorDialog.message,
        onDismiss: () => setErrorDialog({ visible: false, title: '', message: '' }),
      }}
    >
      {player && (
        <>
          <HeroSection
            photos={photos}
            onPhotosChange={handlePhotosChange}
            storageKey={player.id}
            isEditable={true}
          />

          {/* Notes Section */}
          <NotesSection
            value={notes}
            onChangeText={handleNotesChange}
            placeholder="Add any notes about this player..."
          />
        </>
      )}

      {player && courseScores.length > 0 ? (
        <View style={detailPageStyles.section}>
          <SectionTitle>Courses ({courseScores.length})</SectionTitle>
          <View style={styles.coursesList}>
            {courseScores.map(({ course, bestScore, roundCount, bestRoundId }) => {
              const holeCount = Array.isArray(course.holes) 
                ? course.holes.length 
                : (course.holes as unknown as number || 0);
              
              return (
                <TouchableOpacity
                  key={course.id}
                  onPress={() => {
                    router.push(`/course/${encodeNameForUrl(course.name)}/overview`);
                  }}
                >
                  <Card style={[styles.courseCard, { backgroundColor: theme.colors.surface }, getShadowStyle(2)]}>
                    <Card.Content>
                      <View style={styles.courseHeader}>
                        <Text style={[styles.courseName, { color: theme.colors.onSurface }]}>
                          {course.name}
                        </Text>
                        <Chip style={styles.holeChip} icon="flag">
                          {holeCount} {holeCount === 1 ? 'hole' : 'holes'}
                        </Chip>
                      </View>
                      <View style={styles.courseStats}>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            router.push(`/round/${bestRoundId}/holes`);
                          }}
                        >
                          <Chip 
                            style={styles.scoreChip} 
                            icon="trophy"
                          >
                            Best: {bestScore}
                          </Chip>
                        </TouchableOpacity>
                        <Chip style={styles.roundChip}>
                          {roundCount} {roundCount === 1 ? 'round' : 'rounds'}
                        </Chip>
                      </View>
                    </Card.Content>
                  </Card>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : player ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.colors.onSurface }]}>
            No courses played yet
          </Text>
        </View>
      ) : null}

      {player && playerRounds.length > 0 && (
        <View style={detailPageStyles.section}>
          <SectionTitle>Rounds ({playerRounds.length})</SectionTitle>
          <View style={detailPageStyles.roundsList}>
            {playerRounds.map((round) => {
              let holesCount = 0;
              if (round.courseName) {
                const course = allCourses.find(c => c.name === round.courseName);
                if (course) {
                  holesCount = Array.isArray(course.holes) 
                    ? course.holes.length 
                    : (course.holes as unknown as number || 0);
                }
              }

              return (
                <RoundCard
                  key={round.id}
                  round={round}
                  courseHoleCount={holesCount}
                />
              );
            })}
          </View>
        </View>
      )}

      {/* Update App Section - Only show for current user on web */}
      {player && player.isCurrentUser && Platform.OS === 'web' && (
        <View style={detailPageStyles.section}>
          <SectionTitle>App Settings</SectionTitle>
          <Card style={[styles.updateCard, { backgroundColor: theme.colors.surface }, getShadowStyle(2)]}>
            <Card.Content>
              <Text style={[styles.updateTitle, { color: theme.colors.onSurface }]}>
                Update App
              </Text>
              <Text style={[styles.updateDescription, { color: theme.colors.onSurfaceVariant }]}>
                If you're not seeing the latest version of the app, tap this button to clear the cache and reload the latest version.
              </Text>
              <Text style={[styles.versionText, { color: theme.colors.onSurfaceVariant }]}>
                App Version: {appVersion}
              </Text>
              <Button
                mode="contained"
                icon="refresh"
                onPress={handleUpdateApp}
                loading={isUpdating}
                disabled={isUpdating}
                style={styles.updateButton}
              >
                {isUpdating ? 'Updating...' : 'Update App Now'}
              </Button>
            </Card.Content>
          </Card>
        </View>
      )}
    </DetailPageLayout>
  );
}

const styles = StyleSheet.create({
  headerNameRow: {
    flexDirection: 'column',
    flex: 1,
  },
  headerName: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  roundsCount: {
    fontSize: 14,
    marginTop: 2,
  },
  currentUserChip: {
    height: 28,
  },
  coursesSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  coursesList: {
    gap: 12,
  },
  courseCard: {
    marginBottom: 8,
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  courseName: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  holeChip: {
    height: 28,
  },
  courseStats: {
    flexDirection: 'row',
    gap: 8,
  },
  scoreChip: {
    height: 32,
  },
  roundChip: {
    height: 32,
  },
  emptyContainer: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  updateCard: {
    marginTop: 8,
  },
  updateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  updateDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  versionText: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 16,
    opacity: 0.7,
  },
  updateButton: {
    marginTop: 8,
  },
});
