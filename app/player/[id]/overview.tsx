import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme, Text, Card, Chip } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { getAllUsers, getUserById, User } from '@/services/storage/userStorage';
import { getAllRounds } from '@/services/storage/roundStorage';
import { Round, Player, Score } from '@/types';
import { getAllCourses, Course } from '@/services/storage/courseStorage';
import { getShadowStyle } from '@/utils';
import { exportPlayer } from '@/services/playerExport';
import {
  DetailPageLayout,
  SectionTitle,
  RoundCard,
  ErrorDialog,
} from '@/components/common';
import { useExport } from '@/hooks/useExport';
import { encodeNameForUrl } from '@/utils/urlEncoding';
import { detailPageStyles } from '@/styles/detailPageStyles';

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
  const [courseScores, setCourseScores] = useState<CourseScore[]>([]);
  const [playerRounds, setPlayerRounds] = useState<Round[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [errorDialog, setErrorDialog] = useState({ visible: false, title: '', message: '' });
  
  const { exportToClipboard } = useExport();

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

  // Load player data and calculate course scores
  useEffect(() => {
    const loadPlayerData = async () => {
      if (!playerNameParam) {
        setTimeout(() => router.push('/player/list'), 1000);
        return;
      }

      try {
        const { decodeNameFromUrl } = await import('@/utils/urlEncoding');
        const playerName = decodeNameFromUrl(playerNameParam);
        const { getUserByName } = await import('@/services/storage/userStorage');
        const foundPlayer = await getUserByName(playerName);
        
        if (!foundPlayer) {
          setTimeout(() => router.push('/player/list'), 1000);
          return;
        }
        setPlayer(foundPlayer);

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

  return (
    <DetailPageLayout
      loading={loading || !player}
      onBack={() => router.push('/player/list')}
      headerContent={
        player ? (
          <>
            <View style={styles.headerNameRow}>
              <Text style={[styles.headerName, { color: theme.colors.onSurface }]}>
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
});
