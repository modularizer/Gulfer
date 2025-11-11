import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { useTheme, Text } from 'react-native-paper';
import { Course, Round, Player } from '@/types';
import { getCourseById, getCourseByName, saveCourse } from '@/services/storage/courseStorage';
import { getAllRounds } from '@/services/storage/roundStorage';
import { exportCourse } from '@/services/courseExport';
import { router, useLocalSearchParams } from 'expo-router';
import { decodeNameFromUrl } from '@/utils/urlEncoding';
import {
  DetailPageLayout,
  HeroSection,
  SectionTitle,
  RoundCard,
  PlayerChip,
  ErrorDialog,
  NotesSection,
} from '@/components/common';
import { useExport } from '@/hooks/useExport';
import { detailPageStyles } from '@/styles/detailPageStyles';
import { listPageStyles } from '@/styles/listPageStyles';
import { loadPhotosByStorageKey, savePhotosByStorageKey } from '@/utils/photoStorage';

const { width, height } = Dimensions.get('window');

export default function CourseDetailScreen() {
  const { id: encodedNameParam } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [rounds, setRounds] = useState<Round[]>([]);
  const [bestScores, setBestScores] = useState<Map<string, { player: Player; score: number }>>(new Map());
  const [errorDialog, setErrorDialog] = useState({ visible: false, title: '', message: '' });
  
  const { exportToClipboard } = useExport();

  // Load course data
  useEffect(() => {
    const loadCourse = async () => {
      if (!encodedNameParam) {
        setErrorDialog({ visible: true, title: 'Error', message: 'Course name is missing' });
        setTimeout(() => router.push('/course/list'), 1000);
        return;
      }

      try {
        const courseName = decodeNameFromUrl(encodedNameParam);
        
        const loadedCourse = await getCourseByName(courseName);
        if (!loadedCourse) {
          setErrorDialog({ visible: true, title: 'Error', message: 'Course not found' });
          setTimeout(() => router.push('/course/list'), 1000);
          return;
        }

        setCourse(loadedCourse);
        // Load photos from storage
        const loadedPhotos = await loadPhotosByStorageKey(loadedCourse.id);
        setPhotos(loadedPhotos);
        setNotes(loadedCourse.notes || '');
        
        const allRounds = await getAllRounds();
        const courseRounds = allRounds.filter(r => {
          const roundCourseName = r.courseName?.trim();
          const trimmedCourseName = loadedCourse.name.trim();
          return roundCourseName === trimmedCourseName;
        });
        
        setRounds(courseRounds);
        
        const bestScoresMap = new Map<string, { player: Player; score: number }>();
        await Promise.all(courseRounds.map(async (round) => {
          if (round.scores && round.scores.length > 0 && round.players) {
            await Promise.all(round.players.map(async (player) => {
              const playerScores = round.scores!.filter(s => s.playerId === player.id);
              const total = playerScores.reduce((sum, s) => sum + s.throws, 0);
              
              const key = player.id;
              const existing = bestScoresMap.get(key);
              if (!existing || total < existing.score) {
                bestScoresMap.set(key, { player, score: total });
              }
            }));
          }
        }));
        setBestScores(bestScoresMap);
      } catch (error) {
        console.error('Error loading course:', error);
        setErrorDialog({ visible: true, title: 'Error', message: 'Failed to load course' });
        setTimeout(() => router.push('/course/list'), 1000);
      } finally {
        setLoading(false);
      }
    };

    if (encodedNameParam) {
      loadCourse();
    }
  }, [encodedNameParam]);

  const handlePhotosChange = useCallback(async (newPhotos: string[]) => {
    setPhotos(newPhotos);
    if (course) {
      try {
        await savePhotosByStorageKey(course.id, newPhotos);
      } catch (error) {
        console.error('Error saving course photos:', error);
      }
    }
  }, [course]);

  const handleNotesChange = useCallback(async (newNotes: string) => {
    setNotes(newNotes);
    if (course) {
      try {
        const updatedCourse = { ...course, notes: newNotes };
        await saveCourse(updatedCourse);
        setCourse(updatedCourse);
      } catch (error) {
        console.error('Error saving course notes:', error);
      }
    }
  }, [course]);


  const handleExport = useCallback(async () => {
    if (!course) return;
    try {
      const exportText = await exportCourse(course.id);
      await exportToClipboard(exportText, course.name);
    } catch (error) {
      console.error('Error exporting course:', error);
      setErrorDialog({ visible: true, title: 'Error', message: 'Failed to export course' });
    }
  }, [course, exportToClipboard]);

  if (!course) {
    return null;
  }

  const holeCount = Array.isArray(course.holes) ? course.holes.length : (course.holes as unknown as number || 0);

  return (
    <DetailPageLayout
      loading={loading}
      onBack={() => router.replace('/course/list')}
      headerMenuItems={[
        {
          title: 'Export Course',
          icon: 'export',
          onPress: handleExport,
        },
      ]}
      errorDialog={{
        visible: errorDialog.visible,
        title: errorDialog.title,
        message: errorDialog.message,
        onDismiss: () => setErrorDialog({ visible: false, title: '', message: '' }),
      }}
    >
      <HeroSection
        photos={photos}
        onPhotosChange={handlePhotosChange}
        storageKey={course.id}
        isEditable={true}
      />

      <View style={detailPageStyles.nameSection}>
        <Text style={[detailPageStyles.nameText, { color: theme.colors.onSurface }]}>
          {course.name} ({holeCount} {holeCount === 1 ? 'hole' : 'holes'})
        </Text>
      </View>

      {/* Notes Section */}
      <NotesSection
        value={notes}
        onChangeText={handleNotesChange}
        placeholder="Add any notes about this course..."
      />

      <View style={detailPageStyles.section}>
        <SectionTitle>Best Scores</SectionTitle>
        {bestScores.size > 0 ? (
          <View style={listPageStyles.bestScoresContainer}>
            {Array.from(bestScores.values())
              .sort((a, b) => a.score - b.score)
              .map(({ player, score }) => {
                const allScores = Array.from(bestScores.values());
                const winnerScore = Math.min(...allScores.map(ps => ps.score));
                const isWinner = score === winnerScore;
                
                return (
                  <PlayerChip
                    key={player.id}
                    player={player}
                    score={score}
                    isWinner={isWinner}
                  />
                );
              })}
          </View>
        ) : (
          <Text style={[detailPageStyles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
            No scores recorded yet
          </Text>
        )}
      </View>

      {rounds.length > 0 && (
        <View style={detailPageStyles.section}>
          <SectionTitle>Rounds ({rounds.length})</SectionTitle>
          <View style={detailPageStyles.roundsList}>
            {rounds
              .sort((a, b) => b.date - a.date)
              .map((round) => (
                <RoundCard
                  key={round.id}
                  round={round}
                  showCourse={false}
                />
              ))}
          </View>
        </View>
      )}
    </DetailPageLayout>
  );
}


