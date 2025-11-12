import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, Platform, Alert } from 'react-native';
import { useTheme, Text, Card, Chip, Button, Dialog, Portal } from 'react-native-paper';
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
  CourseCard,
  ErrorDialog,
  NotesSection,
  CardModeToggle,
  CardMode,
} from '@/components/common';
import { useExport } from '@/hooks/useExport';
import { encodeNameForUrl } from '@/utils/urlEncoding';
import { detailPageStyles } from '@/styles/detailPageStyles';
import { loadPhotosByStorageKey, savePhotosByStorageKey } from '@/utils/photoStorage';
import { getCachedCardMode, loadCardMode, saveCardMode } from '@/services/storage/cardModeStorage';
import { exportAllDataAsJson, importAllData, parseExportJson } from '@/services/bulkExport';
import { clear } from '@/services/storage/storageAdapter';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { useDialogStyle } from '@/hooks/useDialogStyle';

interface CourseScore {
  course: Course;
  bestScore: number;
  roundCount: number;
  bestRoundId: string;
}

export default function PlayerDetailScreen() {
  const { id: playerNameParam } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const dialogStyle = useDialogStyle();
  const [player, setPlayer] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [courseScores, setCourseScores] = useState<CourseScore[]>([]);
  const [playerRounds, setPlayerRounds] = useState<Round[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [errorDialog, setErrorDialog] = useState({ visible: false, title: '', message: '' });
  const [courseCardMode, setCourseCardMode] = useState<CardMode>(() => getCachedCardMode('player_overview_courses'));
  const [roundCardMode, setRoundCardMode] = useState<CardMode>(() => getCachedCardMode('player_overview_rounds'));
  
  const { exportToClipboard } = useExport();
  const [isUpdating, setIsUpdating] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('Loading...');
  const [copySuccess, setCopySuccess] = useState(false);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<any>(null);
  const [importDialogVisible, setImportDialogVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<any>(null);

  const handleExport = useCallback(async () => {
    if (!player) return;
    try {
      const exportText = await exportPlayer(player.id);
      await exportToClipboard(exportText, player.name);
      setCopySuccess(true);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => setCopySuccess(false), 1500);
    } catch (error) {
      console.error('Error exporting player:', error);
      setErrorDialog({ visible: true, title: 'Error', message: 'Failed to export player' });
      setCopySuccess(false);
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
      } else {
        // On mobile, show a placeholder or get from native
        setAppVersion('Mobile App');
      }
    };
    loadAppVersion();
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
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

  useEffect(() => {
    let isMounted = true;
    loadCardMode('player_overview_courses').then((storedMode) => {
      if (isMounted) {
        setCourseCardMode((prev) => (prev === storedMode ? prev : storedMode));
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    loadCardMode('player_overview_rounds').then((storedMode) => {
      if (isMounted) {
        setRoundCardMode((prev) => (prev === storedMode ? prev : storedMode));
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCourseCardModeChange = useCallback((mode: CardMode) => {
    setCourseCardMode((prev) => {
      if (prev === mode) {
        return prev;
      }
      saveCardMode('player_overview_courses', mode).catch((error) => {
        console.error('Error saving player overview course card mode:', error);
      });
      return mode;
    });
  }, []);

  const handleRoundCardModeChange = useCallback((mode: CardMode) => {
    setRoundCardMode((prev) => {
      if (prev === mode) {
        return prev;
      }
      saveCardMode('player_overview_rounds', mode).catch((error) => {
        console.error('Error saving player overview round card mode:', error);
      });
      return mode;
    });
  }, []);

  const handleExportAllData = useCallback(async () => {
    setIsExporting(true);
    try {
      const jsonData = await exportAllDataAsJson();
      
      if (Platform.OS === 'web') {
        // Create a blob and download it
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `gulfer-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        Alert.alert('Success', 'All data exported successfully');
      } else {
        // On mobile, use share API
        const { Share } = require('react-native');
        await Share.share({
          message: jsonData,
          title: 'Gulfer Data Export',
        });
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      setErrorDialog({
        visible: true,
        title: 'Export Error',
        message: error instanceof Error ? error.message : 'Failed to export data',
      });
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleImportAllData = useCallback(async () => {
    if (Platform.OS === 'web') {
      // Trigger file input
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    } else {
      // On mobile, use document picker
      try {
        setIsImporting(true);
        const result = await DocumentPicker.getDocumentAsync({
          type: 'application/json',
          copyToCacheDirectory: true,
        });

        if (result.canceled) {
          setIsImporting(false);
          return;
        }

        const file = result.assets[0];
        if (!file) {
          setIsImporting(false);
          return;
        }

        console.log('[Import] Reading file from:', file.uri);
        
        // Read the file content
        const fileContent = await FileSystem.readAsStringAsync(file.uri);
        console.log('[Import] File read, parsing JSON...');
        
        const exportData = parseExportJson(fileContent);
        console.log('[Import] JSON parsed successfully');
        
        // Store the data and show confirmation dialog
        setPendingImportData(exportData);
        setImportDialogVisible(true);
        setIsImporting(false);
      } catch (error) {
        console.error('[Import] Error picking/reading file:', error);
        setIsImporting(false);
        setErrorDialog({
          visible: true,
          title: 'Import Error',
          message: error instanceof Error ? error.message : 'Failed to read import file',
        });
      }
    }
  }, []);

  const handleFileSelected = useCallback(async (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      console.log('[Import] Reading file...');
      const text = await file.text();
      console.log('[Import] File read, parsing JSON...');
      const exportData = parseExportJson(text);
      console.log('[Import] JSON parsed successfully');
      
      // Store the data and show confirmation dialog
      setPendingImportData(exportData);
      setImportDialogVisible(true);
    } catch (error) {
      console.error('[Import] Error reading file:', error);
      setErrorDialog({
        visible: true,
        title: 'Import Error',
        message: error instanceof Error ? error.message : 'Failed to read import file',
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, []);

  const handleConfirmImport = useCallback(async () => {
    if (!pendingImportData) return;
    
    console.log('[Import] User confirmed import, starting process...');
    setImportDialogVisible(false);
    setIsImporting(true);
    
    try {
      console.log('[Import] Starting import process...');
      console.log('[Import] Calling importAllData...');
      const summary = await importAllData(pendingImportData, {
        overwriteExisting: false,
        skipDuplicates: true,
      });
      console.log('[Import] Import complete:', summary);
      
      const summaryText = [
        `Rounds: ${summary.rounds.imported} imported, ${summary.rounds.skipped} skipped`,
        `Players: ${summary.players.imported} imported, ${summary.players.skipped} skipped`,
        `Courses: ${summary.courses.imported} imported, ${summary.courses.skipped} skipped`,
        `Photos: ${summary.photos.imported} imported, ${summary.photos.skipped} skipped`,
        `Images: ${summary.images.imported} imported, ${summary.images.skipped} skipped`,
      ].join('\n');
      
      setIsImporting(false);
      setPendingImportData(null);
      
      console.log('[Import] Import successful, reloading page...');
      
      // Reload the page immediately to show the imported data
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.reload();
      } else {
        // On mobile, show success message and reload the current route
        Alert.alert(
          'Import Successful',
          `Rounds: ${summary.rounds.imported} imported\nPlayers: ${summary.players.imported} imported\nCourses: ${summary.courses.imported} imported`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Refresh the current route to show imported data
                if (playerNameParam) {
                  router.replace(`/player/${playerNameParam}/overview`);
                } else {
                  router.push('/player/list');
                }
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('[Import] Error importing data:', error);
      console.error('[Import] Error stack:', error instanceof Error ? error.stack : 'No stack');
      setIsImporting(false);
      setPendingImportData(null);
      setErrorDialog({
        visible: true,
        title: 'Import Error',
        message: error instanceof Error ? error.message : 'Failed to import data',
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [pendingImportData, playerNameParam]);

  const handleCancelImport = useCallback(() => {
    console.log('[Import] User cancelled import');
    setImportDialogVisible(false);
    setPendingImportData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleDeleteAllData = useCallback(() => {
    setDeleteDialogVisible(true);
  }, []);

  const handleConfirmDeleteAllData = useCallback(async () => {
    setDeleteDialogVisible(false);
    setIsDeleting(true);
    
    try {
      console.log('[Delete] Starting delete all data...');
      
      // Clear all storage (this will delete rounds, players, courses, photos, images from storage)
      await clear();
      
      // On mobile, also delete image files from file system
      if (Platform.OS !== 'web') {
        try {
          const IMAGE_DIR = `${FileSystem.documentDirectory}images/`;
          const dirInfo = await FileSystem.getInfoAsync(IMAGE_DIR);
          if (dirInfo.exists) {
            await FileSystem.deleteAsync(IMAGE_DIR, { idempotent: true });
            console.log('[Delete] Deleted image directory');
          }
        } catch (error) {
          console.error('[Delete] Error deleting image directory:', error);
          // Continue even if image directory deletion fails
        }
      }
      
      console.log('[Delete] All data deleted successfully');
      
      // Show success message and reload
      Alert.alert('Success', 'All data has been deleted. The app will reload.', [
        {
          text: 'OK',
          onPress: () => {
            // Reload the page
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              window.location.reload();
            }
          },
        },
      ]);
    } catch (error) {
      console.error('[Delete] Error deleting all data:', error);
      setErrorDialog({
        visible: true,
        title: 'Delete Error',
        message: error instanceof Error ? error.message : 'Failed to delete all data',
      });
    } finally {
      setIsDeleting(false);
    }
  }, []);

  const handleCancelDelete = useCallback(() => {
    setDeleteDialogVisible(false);
  }, []);

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
      headerAction={
        player
          ? {
              icon: copySuccess ? 'check' : 'share-variant',
              iconColor: copySuccess ? theme.colors.primary : undefined,
              onPress: handleExport,
            }
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
          <View style={styles.sectionHeaderRow}>
            <SectionTitle>Courses ({courseScores.length})</SectionTitle>
            <CardModeToggle mode={courseCardMode} onModeChange={handleCourseCardModeChange} />
          </View>
          <View style={styles.coursesList}>
            {courseScores.map(({ course, bestScore, roundCount }) => {
              const summary = `Best: ${bestScore} • ${roundCount} ${roundCount === 1 ? 'round' : 'rounds'}`;
              const notes = course.notes ? `${course.notes}\n${summary}` : summary;
              const displayCourse: Course = {
                ...course,
                notes,
              };
              const bestScores = player
                ? [{ player: { id: player.id, name: player.name }, score: bestScore }]
                : [];

              return (
                <CourseCard
                  key={course.id}
                  course={displayCourse}
                  photos={[]}
                  showPhotos={courseCardMode !== 'list' && courseCardMode !== 'small'}
                  bestScores={bestScores}
                  mode={courseCardMode}
                  onPress={() => router.push(`/course/${encodeNameForUrl(course.name)}/overview`)}
                />
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
          <View style={styles.sectionHeaderRow}>
            <SectionTitle>Rounds ({playerRounds.length})</SectionTitle>
            <CardModeToggle mode={roundCardMode} onModeChange={handleRoundCardModeChange} />
          </View>
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
                  showPhotos={roundCardMode !== 'list' && roundCardMode !== 'small'}
                  mode={roundCardMode}
                />
              );
            })}
          </View>
        </View>
      )}

      {/* Update App Section - Show for current user */}
      {player && player.isCurrentUser && (
        <View style={detailPageStyles.section}>
          <SectionTitle>App Settings</SectionTitle>
          
          {/* Data Export/Import Card */}
          <Card style={[styles.updateCard, { backgroundColor: theme.colors.surface }, getShadowStyle(2)]}>
            <Card.Content>
              <Text style={[styles.updateTitle, { color: theme.colors.onSurface }]}>
                Data Export & Import
              </Text>
              <Text style={[styles.updateDescription, { color: theme.colors.onSurfaceVariant }]}>
                Export all your data (rounds, players, courses, and photos) to a file, or import data from a previous export.
              </Text>
              <Button
                mode="contained"
                icon="download"
                onPress={handleExportAllData}
                loading={isExporting}
                disabled={isExporting || isImporting || isDeleting}
                style={styles.dataButton}
              >
                {isExporting ? 'Exporting...' : 'Export All Data'}
              </Button>
              <Button
                mode="outlined"
                icon="upload"
                onPress={handleImportAllData}
                loading={isImporting}
                disabled={isExporting || isImporting || isDeleting}
                style={styles.dataButton}
              >
                {isImporting ? 'Importing...' : 'Import Data'}
              </Button>
              <Button
                mode="outlined"
                icon="delete"
                onPress={handleDeleteAllData}
                loading={isDeleting}
                disabled={isExporting || isImporting || isDeleting}
                style={[styles.deleteButton, { borderColor: theme.colors.error }]}
                textColor={theme.colors.error}
                labelStyle={{ color: theme.colors.error }}
              >
                {isDeleting ? 'Deleting...' : 'Delete All Data'}
              </Button>
              {Platform.OS === 'web' && (
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={handleFileSelected}
                />
              )}
            </Card.Content>
          </Card>

          {/* Update App Card */}
          <Card style={[styles.updateCard, { backgroundColor: theme.colors.surface }, getShadowStyle(2)]}>
            <Card.Content>
              <Text style={[styles.updateTitle, { color: theme.colors.onSurface }]}>
                Update App
              </Text>
              {Platform.OS === 'web' ? (
                <>
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
                </>
              ) : (
                <>
                  <Text style={[styles.updateDescription, { color: theme.colors.onSurfaceVariant }]}>
                    App updates are handled automatically through the app store. To get the latest version, check for updates in your device's app store.
                  </Text>
                  <Button
                    mode="contained"
                    icon="refresh"
                    disabled={true}
                    style={styles.updateButton}
                  >
                    Update via App Store
                  </Button>
                </>
              )}
              <View style={styles.linksContainer}>
                <View style={styles.linkRow}>
                  <Button
                    mode="text"
                    onPress={() => router.push('/terms')}
                    textColor={theme.colors.primary}
                    style={styles.linkButton}
                    compact
                  >
                    Terms of Service
                  </Button>
                  <Text style={[styles.linkSeparator, { color: theme.colors.onSurfaceVariant }]}>•</Text>
                  <Button
                    mode="text"
                    onPress={() => router.push('/privacy')}
                    textColor={theme.colors.primary}
                    style={styles.linkButton}
                    compact
                  >
                    Privacy Policy
                  </Button>
                </View>
                <View style={styles.linkRow}>
                  <Button
                    mode="text"
                    onPress={() => router.push('/about')}
                    textColor={theme.colors.primary}
                    style={styles.linkButton}
                    compact
                  >
                    About
                  </Button>
                  <Text style={[styles.linkSeparator, { color: theme.colors.onSurfaceVariant }]}>•</Text>
                  <Button
                    mode="text"
                    onPress={() => router.push('/contact-us')}
                    textColor={theme.colors.primary}
                    style={styles.linkButton}
                    compact
                  >
                    Contact Us
                  </Button>
                </View>
              </View>
            </Card.Content>
          </Card>
        </View>
      )}

      {/* Import Confirmation Dialog */}
      <Portal>
        <Dialog visible={importDialogVisible} onDismiss={handleCancelImport} style={dialogStyle}>
          <Dialog.Title>Import Data</Dialog.Title>
          <Dialog.Content>
            <Text style={{ marginBottom: 16 }}>
              This will import:
            </Text>
            {pendingImportData && (
              <>
                <Text>• {pendingImportData.rounds?.length || 0} rounds</Text>
                <Text>• {pendingImportData.players?.length || 0} players</Text>
                <Text>• {pendingImportData.courses?.length || 0} courses</Text>
                <Text>• {Object.keys(pendingImportData.photos || {}).length} photo collections</Text>
                <Text>• {Object.keys(pendingImportData.images || {}).length} images</Text>
              </>
            )}
            <Text style={{ marginTop: 16 }}>
              Existing data with the same IDs will be skipped unless you choose to overwrite.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleCancelImport}>Cancel</Button>
            <Button mode="contained" onPress={handleConfirmImport}>
              Import
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Delete All Data Confirmation Dialog */}
      <Portal>
        <Dialog visible={deleteDialogVisible} onDismiss={handleCancelDelete} style={dialogStyle}>
          <Dialog.Title>Delete All Data</Dialog.Title>
          <Dialog.Content>
            <Text style={{ marginBottom: 16, color: theme.colors.error, fontWeight: '600' }}>
              Warning: This action cannot be undone!
            </Text>
            <Text style={{ marginBottom: 16 }}>
              This will permanently delete:
            </Text>
            <Text>• All rounds</Text>
            <Text>• All players</Text>
            <Text>• All courses</Text>
            <Text>• All photos</Text>
            <Text>• All images</Text>
            <Text style={{ marginTop: 16, fontWeight: '600' }}>
              Make sure you have exported your data if you want to keep a backup.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleCancelDelete}>Cancel</Button>
            <Button
              mode="contained"
              onPress={handleConfirmDeleteAllData}
              buttonColor={theme.colors.error}
              textColor="#fff"
            >
              Delete All Data
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
    height: 32, // Increased height to prevent text clipping
    justifyContent: 'center', // Center text vertically
    alignItems: 'center', // Center text horizontally
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  linksContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  linkButton: {
    minWidth: 0,
  },
  linkSeparator: {
    fontSize: 14,
    opacity: 0.6,
  },
  dataButton: {
    marginTop: 12,
    width: '100%',
  },
  deleteButton: {
    marginTop: 12,
    width: '100%',
  },
});
