import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { IconButton, useTheme, Text, Card, Chip } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { getAllUsers, getUserByUsername, User } from '../../src/services/storage/userStorage';
import { getAllRounds, Round } from '../../src/services/storage/roundStorage';
import { getAllCourses, Course } from '../../src/services/storage/courseStorage';
import { getShadowStyle } from '../../src/utils';

interface CourseScore {
  course: Course;
  bestScore: number;
  roundCount: number;
  bestRoundId: string;
}

export default function PlayerDetailScreen() {
  const { id: playerNameParam } = useLocalSearchParams<{ id: string }>();
  const [player, setPlayer] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [courseScores, setCourseScores] = useState<CourseScore[]>([]);
  const [playerRounds, setPlayerRounds] = useState<Round[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);

  // Load player data and calculate course scores
  useEffect(() => {
    const loadPlayerData = async () => {
      if (!playerNameParam) {
        setTimeout(() => router.push('/players'), 1000);
        return;
      }

      try {
        // Decode the username from URL (username is used as the route parameter)
        const username = decodeURIComponent(playerNameParam);
        // Load player by username
        const foundPlayer = await getUserByUsername(username);
        if (!foundPlayer) {
          setTimeout(() => router.push('/players'), 1000);
          return;
        }
        setPlayer(foundPlayer);

        // Load all rounds and courses
        const allRounds = await getAllRounds();
        const loadedCourses = await getAllCourses();
        setAllCourses(loadedCourses);

        // Find all rounds where this player participated
        // Match by username only
        const playerRounds = allRounds.filter(round => {
          const playerInRound = round.players.find(p => p.username === foundPlayer.username);
          return playerInRound && round.scores && round.scores.length > 0;
        });

        // Group by course and calculate best score per course
        const courseScoreMap = new Map<string, { course: Course; bestScore: number; roundCount: number; bestRoundId: string }>();
        
        // First, count rounds per course (using trimmed names for consistency)
        const courseRoundCounts = new Map<string, number>();
        playerRounds.forEach(round => {
          if (round.courseName) {
            const trimmedName = round.courseName.trim();
            courseRoundCounts.set(trimmedName, (courseRoundCounts.get(trimmedName) || 0) + 1);
          }
        });
        
        playerRounds.forEach(round => {
          if (!round.courseName) return;
          
          // Find the course (trim whitespace for robustness)
          const roundCourseName = round.courseName.trim();
          const course = loadedCourses.find(c => c.name.trim() === roundCourseName);
          if (!course) {
            console.log(`Course not found for round "${round.id}": "${roundCourseName}"`);
            console.log('Available courses:', loadedCourses.map(c => c.name));
            return;
          }

          // Find the player in this round (match by username only)
          const playerInRound = round.players.find(p => p.username === foundPlayer.username);
          if (!playerInRound) {
            console.log(`Player "${foundPlayer.username}" not found in round "${round.id}"`);
            return;
          }

          // Calculate player's score for this round (match by player ID from the round)
          const playerScores = round.scores!.filter(s => s.playerId === playerInRound.id);
          const total = playerScores.reduce((sum, s) => sum + s.throws, 0);

          // Update best score for this course (use trimmed name as key)
          const existing = courseScoreMap.get(roundCourseName);
          const roundCount = courseRoundCounts.get(roundCourseName) || 0;
          
          if (!existing || total < existing.bestScore) {
            courseScoreMap.set(roundCourseName, {
              course,
              bestScore: total,
              roundCount,
              bestRoundId: round.id,
            });
          } else if (existing.roundCount !== roundCount) {
            // Update round count if it changed
            existing.roundCount = roundCount;
          }
        });

        // Convert to array and sort by course name
        const courseScoresArray = Array.from(courseScoreMap.values())
          .sort((a, b) => a.course.name.localeCompare(b.course.name));
        
        setCourseScores(courseScoresArray);
        setPlayerRounds(playerRounds.sort((a, b) => b.date - a.date));
      } catch (error) {
        console.error('Error loading player data:', error);
        setTimeout(() => router.push('/players'), 1000);
      } finally {
        setLoading(false);
      }
    };

    if (playerNameParam) {
      loadPlayerData();
    }
  }, [playerNameParam]);

  const theme = useTheme();

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!player) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header with Back Button and Player Name */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <IconButton
          icon="arrow-left"
          size={24}
          iconColor={theme.colors.onSurface}
          onPress={() => router.push('/players')}
          style={styles.backButton}
        />
        <View style={styles.headerContent}>
          <Text style={[styles.headerName, { color: theme.colors.onSurface }]}>
            {player.name}
          </Text>
          {player.isCurrentUser && (
            <Chip style={styles.currentUserChip} icon="account">
              You
            </Chip>
          )}
        </View>
      </View>
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* Courses Section */}
        {courseScores.length > 0 ? (
          <View style={styles.coursesSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Courses ({courseScores.length})
            </Text>
            <View style={styles.coursesList}>
              {courseScores.map(({ course, bestScore, roundCount, bestRoundId }) => {
                const holeCount = Array.isArray(course.holes) 
                  ? course.holes.length 
                  : (course.holes as unknown as number || 0);
                
                return (
                  <TouchableOpacity
                    key={course.id}
                    onPress={() => {
                      const encodedCourseName = encodeURIComponent(course.name);
                      router.push(`/course/${encodedCourseName}`);
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
                              router.push(`/${bestRoundId}/play`);
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
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.colors.onSurface }]}>
              No courses played yet
            </Text>
          </View>
        )}

        {/* Rounds Section */}
        {playerRounds.length > 0 && (
          <View style={styles.roundsSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Rounds ({playerRounds.length})
            </Text>
            <View style={styles.roundsList}>
              {playerRounds.map((round) => {
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

                // Find the player in this round (match by username only)
                const playerInRound = round.players.find(p => p.username === player!.username);
                const playerScores = playerInRound 
                  ? round.scores!.filter(s => s.playerId === playerInRound.id)
                  : [];
                const playerTotal = playerScores.reduce((sum, s) => sum + s.throws, 0);

                // Calculate all player scores for display
                const allPlayerScores = round.players.map((p) => {
                  const total = round.scores
                    ? round.scores
                        .filter((s) => s.playerId === p.id)
                        .reduce((sum, s) => sum + s.throws, 0)
                    : 0;
                  return { player: p, total };
                });

                // Find winner
                const winnerScore = Math.min(...allPlayerScores.map((ps) => ps.total));
                const winner = allPlayerScores.find((ps) => ps.total === winnerScore);

                // Get hole count
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
                  <TouchableOpacity
                    key={round.id}
                    onPress={() => router.push(`/${round.id}/overview`)}
                  >
                    <Card style={[styles.roundCard, { backgroundColor: theme.colors.surface }, getShadowStyle(2)]}>
                      <Card.Content>
                        <View style={styles.roundHeader}>
                          <Text style={[styles.roundDate, { color: theme.colors.onSurface }]}>
                            {dateStr} {timeStr}
                          </Text>
                          {round.courseName && (
                            <Text style={[styles.roundLocation, { color: theme.colors.onSurface }]}>
                              @ {round.courseName} {holesCount > 0 && `(${holesCount} ⛳)`}
                            </Text>
                          )}
                        </View>
                        {allPlayerScores.length > 0 && (
                          <View style={styles.roundPlayers}>
                            {allPlayerScores.map(({ player: p, total }) => {
                              const isWinner = winner && p.id === winner.player.id;
                              const isCurrentPlayer = p.id === playerInRound?.id;
                              return (
                                <Chip
                                  key={p.id}
                                  style={[
                                    styles.playerChip,
                                    isWinner && styles.winnerChip,
                                    isCurrentPlayer && styles.currentPlayerChip,
                                  ]}
                                  textStyle={[
                                    styles.playerChipText,
                                    isWinner && styles.winnerChipText,
                                    isCurrentPlayer && !isWinner && styles.currentPlayerChipText,
                                  ]}
                                  icon={isWinner ? 'crown' : undefined}
                                  onPress={() => router.push(`/${round.id}/play`)}
                                >
                                  {p.name}: {total}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingLeft: 4,
    paddingRight: 16,
    paddingBottom: 8,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    margin: 0,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 8,
    gap: 12,
  },
  headerName: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  currentUserChip: {
    height: 28,
  },
  coursesSection: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 12,
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
    marginBottom: 4,
  },
  roundLocation: {
    fontSize: 14,
    color: '#666',
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
  currentPlayerChip: {
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  currentPlayerChipText: {
    fontWeight: '600',
  },
});

